package cn.ziya.kids;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;

/** One offline clip at a time, with stale asynchronous callbacks discarded. */
final class VoicePlayer {
    interface Listener { void onState(int token,String id,String state); }
    private final Context context;
    private final Listener listener;
    private final AudioManager manager;
    private final AudioManager.OnAudioFocusChangeListener focusListener;
    private MediaPlayer player;
    private String currentId;
    private int currentToken;

    VoicePlayer(Context context,Listener listener) {
        this.context=context;this.listener=listener;
        manager=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
        focusListener=change -> {
            if(change==AudioManager.AUDIOFOCUS_LOSS || change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT)stop();
            else if(player!=null)try {float volume=change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK?.2f:1f;player.setVolume(volume,volume);}catch(IllegalStateException ignored){}
        };
    }
    void play(String id,int token) {
        if(id==null || !id.matches("(c\\d{4}|[if]_[a-z]{1,3})"))return;
        stop();currentId=id;currentToken=token;
        final MediaPlayer next=new MediaPlayer();player=next;
        try(AssetFileDescriptor fd=context.getAssets().openFd("www/audio/"+id+".mp3")) {
            next.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            next.setDataSource(fd.getFileDescriptor(),fd.getStartOffset(),fd.getLength());
            next.setOnPreparedListener(p -> {
                if(player!=p)return;
                if(manager.requestAudioFocus(focusListener,AudioManager.STREAM_MUSIC,AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED){finish(p,"error");return;}
                try {p.start();listener.onState(token,id,"playing");}catch(IllegalStateException e){finish(p,"error");}
            });
            next.setOnCompletionListener(p -> finish(p,"ended"));
            next.setOnErrorListener((p,what,extra) -> {finish(p,"error");return true;});
            next.prepareAsync();
        }catch(Exception e) {finish(next,"error");}
    }
    private void finish(MediaPlayer source,String status) {
        if(source!=player)return;
        String id=currentId;int token=currentToken;
        player=null;currentId=null;
        try{source.release();}catch(Exception ignored){}
        manager.abandonAudioFocus(focusListener);
        listener.onState(token,id,status);
    }
    void stop() {
        MediaPlayer old=player;
        if(old!=null)finish(old,"stopped");
    }
}
