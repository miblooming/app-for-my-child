package cn.fitcount.app;

/** Pure monotonic timeline shared by the display and audio. No accumulated tick drift. */
public final class WorkoutClock {
    public enum Phase { HOME, READY, THREE, TWO, ONE, GO, TRAINING, SUCCESS }
    public static final long COUNTDOWN_START = 4800L;
    private final long readyDuration;
    private final long countdownStart;
    private int total;
    private long origin;
    private long pausedAt;
    private boolean paused;
    private boolean active;

    public WorkoutClock() { this(1000L, 800L); }
    public WorkoutClock(long readyDuration, long goDuration) {
        if (readyDuration < 400L || readyDuration > 20000L || goDuration < 400L || goDuration > 10000L)
            throw new IllegalArgumentException("Invalid voice cue timing");
        this.readyDuration = readyDuration;
        this.countdownStart = readyDuration + 3000L + goDuration;
    }
    public long countdownStart() { return countdownStart; }

    public void start(int seconds, long now) {
        if (seconds != 30 && seconds != 60 && seconds != 100 && seconds != 200 && seconds != 300)
            throw new IllegalArgumentException("Unsupported duration");
        total = seconds;
        origin = now;
        active = true;
        paused = false;
    }
    public void home() { active = false; paused = false; }
    public boolean isActive() { return active; }
    public boolean isPaused() { return paused; }
    public int total() { return total; }
    public long elapsed(long now) { return active ? Math.max(0L, (paused ? pausedAt : now) - origin) : 0L; }
    public Phase phase(long now) {
        if (!active) return Phase.HOME;
        long t = elapsed(now);
        if (t < readyDuration) return Phase.READY;
        if (t < readyDuration + 1000L) return Phase.THREE;
        if (t < readyDuration + 2000L) return Phase.TWO;
        if (t < readyDuration + 3000L) return Phase.ONE;
        if (t < countdownStart) return Phase.GO;
        return t < countdownStart + total * 1000L ? Phase.TRAINING : Phase.SUCCESS;
    }
    public int remaining(long now) {
        long t = Math.max(0L, elapsed(now) - countdownStart);
        return Math.max(0, total - (int) (t / 1000L));
    }
    public float progress(long now) {
        return Math.min(1f, Math.max(0f, (elapsed(now) - countdownStart) / (total * 1000f)));
    }
    public boolean pause(long now) {
        Phase p = phase(now);
        if (paused || p == Phase.HOME || p == Phase.SUCCESS) return false;
        pausedAt = now; paused = true; return true;
    }
    public boolean resume(long now) {
        if (!paused) return false;
        origin += now - pausedAt; paused = false; return true;
    }
    public String cue(long now) {
        Phase p = phase(now);
        switch (p) {
            case READY: return "ready";
            case THREE: return "n003";
            case TWO: return "n002";
            case ONE: return "n001";
            case GO: return "go";
            case TRAINING: return String.format(java.util.Locale.ROOT, "n%03d", remaining(now));
            case SUCCESS: return "success";
            default: return "";
        }
    }
}
