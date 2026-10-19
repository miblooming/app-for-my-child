import cn.fitcount.app.WorkoutClock;

public class WorkoutClockTest {
    static int checks;
    static void check(boolean value, String message) {
        checks++;
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) {
        for (int total : new int[]{30,60,100,200,300}) {
            WorkoutClock c = new WorkoutClock(); c.start(total, 500);
            check(c.phase(500) == WorkoutClock.Phase.READY, "ready starts immediately");
            check(c.phase(1499) == WorkoutClock.Phase.READY, "ready lasts one second");
            check(c.cue(1500).equals("n003"), "three cue");
            check(c.cue(2500).equals("n002"), "two cue");
            check(c.cue(3500).equals("n001"), "one cue");
            check(c.cue(4500).equals("go"), "go cue");
            long start = 5300;
            check(c.remaining(start) == total, "full selected duration");
            for (int i=0; i<total; i++) {
                long t = start+i*1000L;
                check(c.phase(t) == WorkoutClock.Phase.TRAINING, "training slot "+i);
                check(c.remaining(t) == total-i, "number/audio same slot "+i);
                check(c.remaining(t+999) == total-i, "number held full second "+i);
                check(c.cue(t).equals(String.format(java.util.Locale.ROOT,"n%03d",total-i)), "speech cue "+i);
            }
            check(c.phase(start+total*1000L) == WorkoutClock.Phase.SUCCESS, "success at exact deadline");
            check(c.remaining(start+total*1000L) == 0, "no negative count");
            check(c.progress(start+total*1000L) == 1f, "ring complete");
            check(!c.pause(start+total*1000L), "success cannot pause");
            c.home(); check(c.phase(Long.MAX_VALUE) == WorkoutClock.Phase.HOME, "back stops clock");
        }
        for(long at : new long[]{100,1200,2500,3500,4300,4800,5200,6700}) {
            WorkoutClock c = new WorkoutClock(); c.start(30,0);
            String before = c.cue(at); long elapsed = c.elapsed(at);
            check(c.pause(at), "pause every phase");
            check(c.elapsed(at+100000) == elapsed, "paused time frozen");
            check(c.cue(at+100000).equals(before), "paused cue frozen");
            check(!c.pause(at+200000), "duplicate pause ignored");
            check(c.resume(at+100000), "resume");
            check(c.elapsed(at+100000) == elapsed, "resume no jump");
            check(c.cue(at+100000).equals(before), "resume same cue");
            check(c.phase(134800) == WorkoutClock.Phase.SUCCESS, "finish shifts with pause duration");
        }
        WorkoutClock c = new WorkoutClock(); c.start(300,0); c.home(); c.start(30,99999);
        check(c.total()==30 && c.cue(99999).equals("ready"), "new selection resets all state");
        c.start(30,0);
        long pauseTime = 5500;
        for (int i=0;i<100;i++) { c.pause(pauseTime); c.resume(pauseTime+200); pauseTime+=300; }
        check(c.elapsed(pauseTime)==15500, "repeated pause resume has no drift");
        check(c.phase(54800)==WorkoutClock.Phase.SUCCESS, "repeated pause exact finish");
        boolean rejected=false; try{c.start(15,0);}catch(IllegalArgumentException e){rejected=true;}
        check(rejected,"reject invalid duration");
        for (long ready : new long[]{1500,2700,4000}) {
            for (long go : new long[]{900,1600,2200}) {
                WorkoutClock adaptive = new WorkoutClock(ready,go); adaptive.start(30,0);
                long training = ready+3000+go;
                check(adaptive.phase(ready-1)==WorkoutClock.Phase.READY,"full natural intro plays");
                check(adaptive.cue(ready).equals("n003"),"three follows natural intro");
                check(adaptive.cue(ready+1000).equals("n002"),"two slot preserved");
                check(adaptive.cue(ready+2000).equals("n001"),"one slot preserved");
                check(adaptive.cue(ready+3000).equals("go"),"natural start cue");
                check(adaptive.cue(training-1).equals("go"),"start cue never cut short");
                check(adaptive.remaining(training)==30,"natural intro excludes workout time");
                check(adaptive.phase(training+29999)==WorkoutClock.Phase.TRAINING,"full final second");
                check(adaptive.phase(training+30000)==WorkoutClock.Phase.SUCCESS,"natural pack exact finish");
                adaptive.start(30,0); adaptive.pause(ready/2); adaptive.resume(ready/2+5000);
                check(adaptive.cue(ready+5000).equals("n003"),"natural intro pause resume");
            }
        }
        System.out.println("PASS: "+checks+" timeline assertions (all durations, every numeral, prepare, pause, resume, back, restart).");
    }
}
