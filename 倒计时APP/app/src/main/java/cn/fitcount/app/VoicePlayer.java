package cn.fitcount.app;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.os.Handler;
import android.os.Looper;
import java.util.HashMap;
import java.util.Map;

/** Bundled PCM clips: no network, TTS engine or runtime permission required. */
final class VoicePlayer {
    interface Listener { void loaded(boolean ok); }
    private final SoundPool pool;
    private final Map<String, Integer> sounds = new HashMap<>();
    private int completed;
    private int requested;
    private int stream;
    private boolean failure;
    private boolean loadingDone;
    private boolean notified;
    private boolean enabled = true;
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());

    VoicePlayer(Context context, Listener listener) {
        this.listener = listener;
        pool = new SoundPool.Builder().setMaxStreams(1).setAudioAttributes(
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()).build();
        pool.setOnLoadCompleteListener((sp, id, status) -> {
            completed++; if (status != 0) failure = true; checkLoaded();
        });
        try {
            String[] files = context.getAssets().list("audio");
            if (files == null || files.length != 303) throw new IllegalStateException("Missing voice assets");
            for (String file : files) {
                try (AssetFileDescriptor fd = context.getAssets().openFd("audio/" + file)) {
                    int id = pool.load(fd, 1);
                    if (id == 0) failure = true; else requested++;
                    sounds.put(file.substring(0, file.length() - 4), id);
                }
            }
        } catch (Exception e) { failure = true; }
        loadingDone = true;
        checkLoaded();
    }
    private void checkLoaded() {
        if (loadingDone && completed >= requested && !notified) {
            notified = true;
            main.post(() -> listener.loaded(!failure));
        }
    }
    void enabled(boolean value) { enabled = value; if (!value) stop(); }
    void play(String key) {
        stop();
        Integer id = sounds.get(key);
        if (enabled && id != null && id != 0) stream = pool.play(id, 1f, 1f, 1, 0, 1f);
    }
    void pause() { if (stream != 0) pool.pause(stream); }
    void resume() { if (enabled && stream != 0) pool.resume(stream); }
    void stop() { if (stream != 0) { pool.stop(stream); stream = 0; } }
    void release() { main.removeCallbacksAndMessages(null); pool.release(); }
}
