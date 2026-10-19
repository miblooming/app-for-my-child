interface VoiceItem {id:string;onStart?:()=>void;finish:()=>void;short:boolean}
export class TownAudio {
  enabled=true;
  private current?: HTMLAudioElement;
  private queue:VoiceItem[]=[];
  private active?:VoiceItem;
  private watchdog?:ReturnType<typeof setTimeout>;
  private context?: AudioContext;
  get speaking(){return !!this.active;}
  get voiceId(){return this.active?.id??null;}
  speak(id:string) {void this.enqueue([{id}],false);}
  narrate(clips:{id:string;onStart:()=>void}[]) {return this.enqueue(clips,true);}
  private enqueue(clips:{id:string;onStart?:()=>void}[],short:boolean):Promise<void> {
    if(!this.enabled||!clips.length)return Promise.resolve();
    const pending=clips.map(clip=>new Promise<void>(finish=>{this.queue.push({...clip,finish,short});}));
    this.playNext();return Promise.all(pending).then(()=>{});
  }
  private playNext(){
    if(this.active||!this.enabled)return;
    const item=this.queue.shift();if(!item)return;this.active=item;
    const audio=new Audio(`${import.meta.env.BASE_URL}voice/${item.id}.mp3`);this.current=audio;audio.volume=.9;
    let started=false;
    const finish=()=>{
      if(this.active!==item)return;
      clearTimeout(this.watchdog);audio.pause();audio.onended=null;audio.onerror=null;audio.onloadedmetadata=null;audio.onplaying=null;
      this.active=undefined;this.current=undefined;item.finish();this.playNext();
    };
    audio.onplaying=()=>{if(!started){started=true;item.onStart?.();}};
    audio.onended=finish;audio.onerror=finish;
    audio.onloadedmetadata=()=>{clearTimeout(this.watchdog);this.watchdog=setTimeout(finish,Math.min(item.short?7000:45000,Math.max(1500,audio.duration*1000+1800)));};
    this.watchdog=setTimeout(finish,item.short?7000:45000);
    audio.play().catch(finish);
  }
  stop() {
    clearTimeout(this.watchdog);
    if(this.current){this.current.onended=null;this.current.onerror=null;this.current.onloadedmetadata=null;this.current.onplaying=null;this.current.pause();this.current.removeAttribute('src');this.current.load();}
    this.current=undefined;this.active?.finish();this.active=undefined;
    this.queue.splice(0).forEach(item=>item.finish());
  }
  effect(kind: 'click' | 'collect' | 'serve' | 'success') {
    if(!this.enabled) return;
    try {
      this.context??=new AudioContext();
      if(this.context.state==='suspended')void this.context.resume();
      const notes=kind==='success'?[523,659,784,1047]:kind==='serve'?[659,880]:kind==='collect'?[587,784]:[660];
      notes.forEach((freq,i)=>{
        const oscillator=this.context!.createOscillator(),gain=this.context!.createGain(),time=this.context!.currentTime+i*.12;
        oscillator.type='sine';oscillator.frequency.value=freq;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(this.speaking ? .025 : .055,time+.01);gain.gain.exponentialRampToValueAtTime(.001,time+.2);
        oscillator.connect(gain);gain.connect(this.context!.destination);oscillator.start(time);oscillator.stop(time+.22);
      });
    } catch { /* Audio is optional on browsers that deny WebAudio. */ }
  }
}
