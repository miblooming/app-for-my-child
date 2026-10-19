package cn.ziya.kids;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Local-only Android host. All lessons ship in assets; records use private preferences. */
public final class MainActivity extends Activity {
    private static final int EXPORT = 101, IMPORT = 102, MAX_BACKUP = 32 * 1024 * 1024;
    private WebView web;
    private SharedPreferences preferences;
    private String pendingExport;
    private VoicePlayer voicePlayer;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences("ziya-records", MODE_PRIVATE);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(248,247,242));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        getWindow().setStatusBarColor(Color.rgb(248,247,242));
        getWindow().setNavigationBarColor(Color.rgb(255,254,250));
        int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (android.os.Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(flags);
        web = new WebView(this);
        setVolumeControlStream(android.media.AudioManager.STREAM_MUSIC);
        voicePlayer=new VoicePlayer(this,(token,id,status) -> {
            if(web!=null)web.evaluateJavascript("window.onAudioStatus && window.onAudioStatus("+token+","+JSONObject.quote(id)+","+JSONObject.quote(status)+");",null);
        });
        web.setBackgroundColor(Color.rgb(248,247,242));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBuiltInZoomControls(false);
        settings.setTextZoom(100);
        web.addJavascriptInterface(new RecordsBridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isAppUrl(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return !isAppUrl(url); }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        root.requestApplyInsets();
        web.loadUrl("file:///android_asset/www/index.html");
    }
    private static boolean isAppUrl(String url) {
        return url.equals("file:///android_asset/www/index.html") || url.startsWith("file:///android_asset/www/index.html#");
    }
    public final class RecordsBridge {
        @JavascriptInterface public void playAudio(String id,int token) {runOnUiThread(() -> {if(voicePlayer!=null)voicePlayer.play(id,token);});}
        @JavascriptInterface public void stopAudio() {runOnUiThread(() -> {if(voicePlayer!=null)voicePlayer.stop();});}
        @JavascriptInterface public String loadState() { return preferences.getString("state", ""); }
        @JavascriptInterface public boolean saveState(String text) {
            try {
                if (text == null || text.length() > MAX_BACKUP) return false;
                JSONObject value = new JSONObject(text);
                if (value.getInt("schema") != 1 || !"ziya-2500-v1".equals(value.getString("dataset")) || value.getJSONArray("rounds").length() == 0) return false;
                return preferences.edit().putString("state",text).commit();
            } catch (Exception e) { Log.e("Ziya", "Unable to save records",e); return false; }
        }
        @JavascriptInterface public void exportBackup(String text,String filename) {
            if (text == null || text.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP) { message("备份过大，无法导出"); return; }
            runOnUiThread(() -> {
                pendingExport=text;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE,filename);
                try { startActivityForResult(intent,EXPORT); }
                catch (Exception e) { pendingExport=null; message("无法打开文件保存器，请检查系统文件应用"); }
            });
        }
        @JavascriptInterface public void importBackup() {
            runOnUiThread(() -> {
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try { startActivityForResult(intent,IMPORT); }
                catch (Exception e) { message("无法打开文件选择器，请检查系统文件应用"); }
            });
        }
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            if(requestCode==EXPORT) pendingExport=null;
            return;
        }
        Uri uri=data.getData();
        if (requestCode==EXPORT) {
            final String text=pendingExport; pendingExport=null;
            if(text==null) {message("导出已取消，请重新导出");return;}
            new Thread(() -> {
                try(OutputStream stream=getContentResolver().openOutputStream(uri,"wt")) {
                    if(stream==null) throw new IllegalStateException("No output stream");
                    stream.write(text.getBytes(StandardCharsets.UTF_8));
                    stream.flush();
                    message("备份文件已保存");
                } catch(Exception e) {Log.e("Ziya","Export failed",e);message("备份保存失败，请重试");}
            },"ziya-export").start();
        } else if (requestCode==IMPORT) {
            new Thread(() -> {
                try(InputStream stream=getContentResolver().openInputStream(uri);ByteArrayOutputStream buffer=new ByteArrayOutputStream()) {
                    if(stream==null) throw new IllegalStateException("No input stream");
                    byte[] bytes=new byte[8192]; int n;
                    while((n=stream.read(bytes))!=-1) { if(buffer.size()+n>MAX_BACKUP) throw new IllegalArgumentException("备份文件不能超过 32 MB"); buffer.write(bytes,0,n); }
                    String text=new String(buffer.toByteArray(),StandardCharsets.UTF_8);
                    if(text.startsWith("\uFEFF")) text=text.substring(1);
                    final String script="window.onBackupImported("+JSONObject.quote(text)+");";
                    runOnUiThread(() -> {if(web!=null && !isFinishing())web.evaluateJavascript(script,null);});
                }catch(Exception e) {Log.e("Ziya","Import failed",e);message(e instanceof IllegalArgumentException?e.getMessage():"备份读取失败，请选择正确的 JSON 文件");}
            },"ziya-import").start();
        }
    }
    private void message(String text) {runOnUiThread(() -> {if(web!=null)web.evaluateJavascript("window.onNativeResult("+JSONObject.quote(text)+");",null);});}
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : false",value -> {
            if(!"true".equals(value)) MainActivity.super.onBackPressed();
        });
    }
    @Override protected void onDestroy() {
        if(voicePlayer!=null){voicePlayer.stop();voicePlayer=null;}
        if(web!=null) {web.removeJavascriptInterface("Android");web.destroy();web=null;}
        super.onDestroy();
    }
    @Override protected void onPause() {if(voicePlayer!=null)voicePlayer.stop();super.onPause();}
}
