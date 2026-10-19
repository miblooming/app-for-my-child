package cn.fitcount.app;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.content.res.ColorStateList;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;

public final class MainActivity extends Activity {
    private static final int BG = Color.rgb(17, 21, 16);
    private static final int CARD = Color.rgb(29, 35, 26);
    private static final int LIME = Color.rgb(209, 255, 112);
    private static final int WHITE = Color.rgb(245, 247, 239);
    private static final int MUTED = Color.rgb(151, 162, 142);
    private WorkoutClock clock = new WorkoutClock();
    private long successAudioDuration = 2200L;
    private String readyWords = "调整呼吸，准备出发";
    private String goWords = "开始";
    private String successWords = "又一次，做到了。";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private VoicePlayer voice;
    private AudioManager audio;
    private AudioFocusRequest focusRequest;
    private boolean hasFocus;
    private boolean soundOn = true;
    private boolean loaded;
    private boolean voiceFailed;
    private boolean foreground;
    private boolean successShown;
    private String lastCue = "";
    private TextView soundButton, stateLabel, hintLabel, pauseButton, progressLabel;
    private Dial dial;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        loadVoiceTiming();
        soundOn = getPreferences(MODE_PRIVATE).getBoolean("sound", true);
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(root);
        home();
        voice = new VoicePlayer(this, ok -> {
            loaded = ok; voiceFailed = !ok;
            if (!clock.isActive()) home();
        });
        voice.enabled(soundOn);
    }

    private void loadVoiceTiming() {
        try (InputStream input = getAssets().open("voice-pack.json");
             ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            byte[] data = new byte[2048]; int count;
            while ((count = input.read(data)) != -1) buffer.write(data, 0, count);
            JSONObject pack = new JSONObject(buffer.toString("UTF-8"));
            clock = new WorkoutClock(pack.getLong("readySlotMs"), pack.getLong("goSlotMs"));
            successAudioDuration = pack.getLong("successAudioMs") + 500L;
            readyWords = pack.getString("readyText");
            goWords = pack.getString("goText");
            successWords = pack.getString("successText").replace("挑战成功！", "").trim();
        } catch (Exception e) { /* Legacy voice packs use the original short cue timeline. */ }
    }

    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
                || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            hasFocus = false;
            pauseWorkout();
        } else if (change == AudioManager.AUDIOFOCUS_GAIN) hasFocus = true;
    };
    private boolean requestFocus() {
        if (!soundOn) return true;
        if (hasFocus) return true;
        int result;
        if (Build.VERSION.SDK_INT >= 26) {
            if (focusRequest == null) focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setOnAudioFocusChangeListener(focusListener).build();
            result = audio.requestAudioFocus(focusRequest);
        } else result = audio.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        hasFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        return hasFocus;
    }
    private void abandonFocus() {
        if (Build.VERSION.SDK_INT >= 26 && focusRequest != null) audio.abandonAudioFocusRequest(focusRequest);
        else audio.abandonAudioFocus(focusListener);
        hasFocus = false;
    }

    private void home() {
        handler.removeCallbacks(ticker);
        clock.home(); lastCue = ""; successShown = false;
        if (voice != null) voice.stop();
        abandonFocus();
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true); scroll.setClipToPadding(false);
        scroll.setVerticalScrollBarEnabled(false);
        LinearLayout content = column(); content.setPadding(dp(24), dp(12), dp(24), dp(24));
        scroll.addView(content, new ScrollView.LayoutParams(-1, -2));
        root.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
        content.addView(header(false));
        TextView overline = text("MOVE WITH PURPOSE", 10, LIME, true);
        overline.setLetterSpacing(.18f); content.addView(overline, lp(-1, -2, 31));
        TextView title = text("把这一刻，\n留给运动。", 32, WHITE, true);
        title.setLineSpacing(dp(2), 1f); content.addView(title, lp(-1, -2, 10));
        content.addView(text("选一个时长，即刻开始你的挑战。", 13, MUTED, false), lp(-1, -2, 12));
        LinearLayout section = row(); section.setGravity(Gravity.CENTER_VERTICAL);
        section.addView(text("选择训练时长", 14, WHITE, true), new LinearLayout.LayoutParams(0, -2, 1));
        section.addView(text("SECONDS", 10, MUTED, false));
        content.addView(section, lp(-1, -2, 28));

        LinearLayout quick = row();
        LinearLayout.LayoutParams q1 = new LinearLayout.LayoutParams(0, dp(112), 1); q1.rightMargin = dp(6);
        LinearLayout.LayoutParams q2 = new LinearLayout.LayoutParams(0, dp(112), 1); q2.leftMargin = dp(6);
        quick.addView(durationCard(30, "轻量启动", true, true), q1);
        quick.addView(durationCard(60, "一分钟专注", false, true), q2);
        content.addView(quick, lp(-1, -2, 12));
        content.addView(durationCard(100, "找到运动节奏", false, false), lp(-1, 72, 12));
        content.addView(durationCard(200, "让坚持多一点", false, false), lp(-1, 72, 10));
        content.addView(durationCard(300, "五分钟全力以赴", false, false), lp(-1, 72, 10));

        String footer = voiceFailed ? "语音加载失败，请退出并重新打开 APP" : loaded ? "AI 合成教练语音  ·  离线可用" : "正在准备离线语音…";
        TextView foot = text(footer, 11, voiceFailed ? 0xffffb18c : MUTED, false);
        foot.setGravity(Gravity.CENTER); content.addView(foot, lp(-1, -2, 22));
    }

    private View durationCard(int seconds, String subtitle, boolean accent, boolean square) {
        int ink = accent ? BG : WHITE;
        LinearLayout card = square ? column() : row();
        card.setPadding(dp(18), dp(12), dp(18), dp(12));
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setBackground(ripple(accent ? LIME : CARD, 19));
        card.setClickable(true); card.setFocusable(true);
        card.setContentDescription(seconds + "秒，" + subtitle + "，开始挑战");
        card.setOnClickListener(v -> begin(seconds));
        LinearLayout number = row(); number.setGravity(Gravity.BOTTOM);
        TextView n = text(String.valueOf(seconds), square ? 40 : 31, ink, true);
        n.setFontFeatureSettings("tnum"); number.addView(n);
        TextView unit = text(" 秒", 12, accent ? 0xff465034 : MUTED, false);
        LinearLayout.LayoutParams ulp = new LinearLayout.LayoutParams(-2, -2); ulp.bottomMargin = dp(7); number.addView(unit, ulp);
        if (square) {
            card.addView(number, new LinearLayout.LayoutParams(-1, 0, 1));
            LinearLayout bottom = row(); bottom.setGravity(Gravity.CENTER_VERTICAL);
            bottom.addView(text(subtitle, 11, accent ? 0xff465034 : MUTED, false), new LinearLayout.LayoutParams(0, -2, 1));
            bottom.addView(text("↗", 22, ink, false)); card.addView(bottom);
        } else {
            card.addView(number, new LinearLayout.LayoutParams(dp(112), -2));
            card.addView(text(subtitle, 12, MUTED, false), new LinearLayout.LayoutParams(0, -2, 1));
            card.addView(text("↗", 23, LIME, false));
        }
        return card;
    }

    private LinearLayout header(boolean back) {
        LinearLayout line = row(); line.setGravity(Gravity.CENTER_VERTICAL);
        if (back) {
            TextView b = text("‹  返回", 16, WHITE, true);
            b.setGravity(Gravity.CENTER_VERTICAL); b.setMinHeight(dp(48));
            b.setContentDescription("结束本次挑战并返回首页"); b.setOnClickListener(v -> home());
            line.addView(b, new LinearLayout.LayoutParams(0, dp(48), 1));
        } else {
            LinearLayout brand = row(); brand.setGravity(Gravity.CENTER_VERTICAL);
            TextView mark = text("◴", 29, LIME, true); brand.addView(mark);
            LinearLayout words = column();
            words.addView(text("练一刻", 19, WHITE, true));
            TextView caption = text("运动倒计时", 10, MUTED, false); words.addView(caption);
            LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(-2, -2); blp.leftMargin = dp(10); brand.addView(words, blp);
            line.addView(brand, new LinearLayout.LayoutParams(0, dp(48), 1));
        }
        soundButton = text(soundOn ? "语音  开" : "语音  关", 12, soundOn ? LIME : MUTED, true);
        soundButton.setGravity(Gravity.CENTER); soundButton.setBackground(ripple(CARD, 24));
        soundButton.setContentDescription(soundOn ? "中文语音已开启，点击静音" : "中文语音已关闭，点击开启");
        soundButton.setOnClickListener(v -> toggleSound());
        line.addView(soundButton, new LinearLayout.LayoutParams(dp(86), dp(44)));
        return line;
    }
    private void toggleSound() {
        soundOn = !soundOn;
        getPreferences(MODE_PRIVATE).edit().putBoolean("sound", soundOn).apply();
        if (voice != null) voice.enabled(soundOn);
        soundButton.setText(soundOn ? "语音  开" : "语音  关");
        soundButton.setTextColor(soundOn ? LIME : MUTED);
        soundButton.setContentDescription(soundOn ? "中文语音已开启，点击静音" : "中文语音已关闭，点击开启");
        if (!soundOn) abandonFocus();
        else if (clock.isActive() && !clock.isPaused() && clock.phase(now()) != WorkoutClock.Phase.SUCCESS) {
            if (!requestFocus()) pauseWorkout();
            // Start speech at the next whole-second transition, keeping the current cue aligned.
        }
    }

    private void begin(int seconds) {
        if (!loaded) {
            toast(voiceFailed ? "语音加载失败，请退出并重新打开 APP" : "语音正在准备，请稍候再点"); return;
        }
        if (!requestFocus()) { toast("当前无法播放语音，请稍后再试或关闭语音"); return; }
        if (soundOn && audio.getStreamVolume(AudioManager.STREAM_MUSIC) == 0) toast("媒体音量为 0，请按手机音量键调高");
        clock.start(seconds, now()); successShown = false; lastCue = "";
        workoutScreen();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        handler.removeCallbacks(ticker); handler.post(ticker);
    }
    private void workoutScreen() {
        root.removeAllViews();
        LinearLayout body = column(); body.setPadding(dp(24), dp(12), dp(24), dp(20));
        root.addView(body, new FrameLayout.LayoutParams(-1, -1));
        body.addView(header(true));
        LinearLayout center = column(); center.setGravity(Gravity.CENTER);
        body.addView(center, new LinearLayout.LayoutParams(-1, 0, 1));
        stateLabel = text("准备就绪", 24, WHITE, true); stateLabel.setGravity(Gravity.CENTER);
        center.addView(stateLabel, lp(-1, -2, 12));
        TextView duration = text(clock.total() + " 秒挑战", 12, MUTED, false); duration.setGravity(Gravity.CENTER);
        center.addView(duration, lp(-1, -2, 9));
        dial = new Dial(this);
        LinearLayout.LayoutParams dlp = new LinearLayout.LayoutParams(-1, -2); dlp.topMargin = dp(24); dlp.bottomMargin = dp(24);
        center.addView(dial, dlp);
        progressLabel = text("调整呼吸，准备出发", 13, MUTED, false); progressLabel.setGravity(Gravity.CENTER);
        center.addView(progressLabel);
        center.setOnClickListener(v -> togglePause());
        body.setOnClickListener(v -> togglePause());
        hintLabel = text("全屏轻触，即可暂停", 12, MUTED, false); hintLabel.setGravity(Gravity.CENTER);
        body.addView(hintLabel, lp(-1, -2, 12));
        pauseButton = action("Ⅱ   暂停挑战", LIME, BG, v -> togglePause());
        body.addView(pauseButton, lp(-1, 58, 16));
    }
    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            if (!clock.isActive()) return;
            update();
            if (!clock.isPaused() && clock.phase(now()) != WorkoutClock.Phase.SUCCESS) handler.postDelayed(this, 16L);
        }
    };
    private void update() {
        long time = now();
        WorkoutClock.Phase phase = clock.phase(time);
        String cue = clock.cue(time);
        if (!cue.equals(lastCue)) {
            lastCue = cue;
            if (phase == WorkoutClock.Phase.SUCCESS && !successShown) {
                successShown = true; voice.play(cue); successScreen();
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                handler.postDelayed(() -> { if (clock.phase(now()) == WorkoutClock.Phase.SUCCESS) abandonFocus(); }, successAudioDuration);
                return;
            }
            voice.play(cue);
            if (clock.isPaused()) voice.pause();
        }
        if (phase == WorkoutClock.Phase.SUCCESS || phase == WorkoutClock.Phase.HOME) return;
        boolean paused = clock.isPaused();
        stateLabel.setText(paused ? "休息一下，再继续" : phase == WorkoutClock.Phase.TRAINING ? "专注这一秒" : "准备就绪");
        hintLabel.setText(paused ? "全屏轻触，继续你的节奏" : "全屏轻触，即可暂停");
        pauseButton.setText(paused ? "▶   继续挑战" : "Ⅱ   暂停挑战");
        pauseButton.setContentDescription(paused ? "继续挑战" : "暂停挑战");
        progressLabel.setText(phase == WorkoutClock.Phase.TRAINING ?
            "已完成 " + (int) (clock.progress(time) * 100) + "%  ·  共 " + clock.total() + " 秒" :
            phase == WorkoutClock.Phase.GO ? goWords : readyWords);
        dial.setContentDescription(paused ? "已暂停，剩余" + clock.remaining(time) + "秒" :
            phase == WorkoutClock.Phase.TRAINING ? "剩余" + clock.remaining(time) + "秒" : "预备倒计时");
        dial.invalidate();
    }
    private void togglePause() {
        if (!clock.isActive() || clock.phase(now()) == WorkoutClock.Phase.SUCCESS) return;
        if (clock.isPaused()) {
            if (!foreground || !requestFocus()) { toast("暂时无法恢复语音，请稍后重试"); return; }
            clock.resume(now()); voice.resume();
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            handler.removeCallbacks(ticker); handler.post(ticker);
        } else pauseWorkout();
    }
    private void pauseWorkout() {
        if (clock.pause(now())) {
            handler.removeCallbacks(ticker); voice.pause();
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            update();
        }
    }
    private void successScreen() {
        root.removeAllViews();
        LinearLayout body = column(); body.setPadding(dp(24), dp(12), dp(24), dp(24));
        root.addView(body, new FrameLayout.LayoutParams(-1, -1)); body.addView(header(true));
        LinearLayout center = column(); center.setGravity(Gravity.CENTER);
        body.addView(center, new LinearLayout.LayoutParams(-1, 0, 1));
        TextView badge = text("✓", 72, BG, true); badge.setGravity(Gravity.CENTER); badge.setBackground(shape(LIME, 80));
        center.addView(badge, new LinearLayout.LayoutParams(dp(126), dp(126)));
        TextView overline = text("CHALLENGE COMPLETE", 10, LIME, true); overline.setLetterSpacing(.15f); overline.setGravity(Gravity.CENTER);
        center.addView(overline, lp(-1, -2, 30));
        TextView title = text("挑战成功", 36, WHITE, true); title.setGravity(Gravity.CENTER); center.addView(title, lp(-1, -2, 10));
        TextView message = text(successWords, 15, MUTED, false); message.setGravity(Gravity.CENTER); center.addView(message, lp(-1, -2, 12));
        TextView total = text(clock.total() + " 秒  /  100% 完成", 17, LIME, true); total.setGravity(Gravity.CENTER);
        total.setBackground(shape(CARD, 16)); center.addView(total, lp(-1, 64, 30));
        body.addView(action("再来一次  ↗", LIME, BG, v -> begin(clock.total())), lp(-1, 58, 12));
        body.addView(action("选择其他时长", CARD, WHITE, v -> home()), lp(-1, 54, 12));
        root.announceForAccessibility("挑战成功，完成" + clock.total() + "秒");
    }

    private final class Dial extends View {
        private final Paint paint = new Paint(3);
        private final RectF bounds = new RectF();
        Dial(Context context) { super(context); setLayerType(View.LAYER_TYPE_SOFTWARE, null); }
        @Override protected void onMeasure(int ws, int hs) {
            int width = MeasureSpec.getSize(ws);
            int h = Math.min(width, dp(338));
            // Leave enough space on compact phones and large-font devices.
            h = Math.min(h, Math.max(dp(200), root.getHeight() - dp(360)));
            setMeasuredDimension(width, h);
        }
        @Override protected void onDraw(Canvas canvas) {
            float cx = getWidth() / 2f, cy = getHeight() / 2f;
            float radius = Math.min(getWidth(), getHeight()) / 2f - dp(13);
            long t = now(); boolean paused = clock.isPaused();
            WorkoutClock.Phase phase = clock.phase(t);
            int accent = paused ? MUTED : LIME;
            paint.setStyle(Paint.Style.FILL); paint.setColor(0xff151b12); canvas.drawCircle(cx, cy, radius - dp(12), paint);
            paint.setStrokeWidth(dp(1)); paint.setColor(0xff35402e);
            for (int i = 0; i < 60; i++) {
                double angle = Math.toRadians(i * 6 - 90);
                float inner = radius - dp(i % 5 == 0 ? 20 : 17), outer = radius - dp(12);
                canvas.drawLine(cx + (float)Math.cos(angle) * inner, cy + (float)Math.sin(angle) * inner,
                    cx + (float)Math.cos(angle) * outer, cy + (float)Math.sin(angle) * outer, paint);
            }
            bounds.set(cx - radius, cy - radius, cx + radius, cy + radius);
            paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(dp(5)); paint.setColor(0xff2b3425);
            canvas.drawCircle(cx, cy, radius, paint);
            float progress = phase == WorkoutClock.Phase.TRAINING ? clock.progress(t) : 0f;
            paint.setStrokeCap(Paint.Cap.ROUND); paint.setColor(accent);
            canvas.drawArc(bounds, -90, 360f * (1f - progress), false, paint);
            paint.setStrokeCap(Paint.Cap.BUTT); paint.setStyle(Paint.Style.FILL);
            double angle = Math.toRadians(-90 + 360 * (1 - progress));
            canvas.drawCircle(cx + (float)Math.cos(angle) * radius, cy + (float)Math.sin(angle) * radius, dp(5), paint);
            String number;
            switch (phase) {
                case READY: number = "预备"; break;
                case THREE: number = "3"; break;
                case TWO: number = "2"; break;
                case ONE: number = "1"; break;
                case GO: number = "开始"; break;
                default: number = String.valueOf(clock.remaining(t));
            }
            float textSize = number.equals("预备") || number.equals("开始") ? radius * .40f : number.length() == 3 ? radius * .67f : radius * .82f;
            paint.setTextSize(textSize); paint.setColor(paused ? MUTED : WHITE); paint.setTextAlign(Paint.Align.CENTER);
            paint.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
            canvas.drawText(number, cx, cy + textSize * .21f, paint);
            paint.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL)); paint.setTextSize(dp(12)); paint.setColor(accent);
            canvas.drawText(paused ? "已 暂 停" : phase == WorkoutClock.Phase.TRAINING ? "剩 余 秒 数" : "跟 随 语 音", cx, cy + radius * .48f, paint);
        }
    }

    @Override protected void onResume() { super.onResume(); foreground = true; }
    @Override protected void onPause() { foreground = false; pauseWorkout(); if (voice != null) voice.pause(); abandonFocus(); super.onPause(); }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); if (voice != null) voice.release(); abandonFocus(); super.onDestroy(); }
    @Override public void onBackPressed() { if (clock.isActive()) home(); else super.onBackPressed(); }
    private static long now() { return SystemClock.elapsedRealtime(); }
    private int dp(float n) { return (int) (n * getResources().getDisplayMetrics().density + .5f); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_SHORT).show(); }
    private LinearLayout column() { LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL); return l; }
    private LinearLayout row() { LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.HORIZONTAL); return l; }
    private TextView text(String value, int size, int color, boolean bold) {
        TextView t = new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(color); t.setIncludeFontPadding(false);
        t.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL)); return t;
    }
    private TextView action(String label, int bg, int fg, View.OnClickListener listener) {
        Button b = new Button(this); b.setText(label); b.setTextSize(16); b.setTextColor(fg);
        b.setAllCaps(false); b.setTypeface(Typeface.DEFAULT_BOLD); b.setGravity(Gravity.CENTER);
        b.setPadding(dp(12), 0, dp(12), 0); b.setMinHeight(0); b.setMinimumHeight(0);
        b.setStateListAnimator(null); b.setBackground(ripple(bg, 18)); b.setOnClickListener(listener); return b;
    }
    private GradientDrawable shape(int color, int radius) {
        GradientDrawable s = new GradientDrawable(); s.setColor(color); s.setCornerRadius(dp(radius)); return s;
    }
    private RippleDrawable ripple(int color, int radius) {
        return new RippleDrawable(ColorStateList.valueOf(0x334c6435), shape(color, radius), shape(Color.WHITE, radius));
    }
    private LinearLayout.LayoutParams lp(int width, int height, int top) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(width < 0 ? width : dp(width), height < 0 ? height : dp(height));
        p.topMargin = dp(top); return p;
    }
}
