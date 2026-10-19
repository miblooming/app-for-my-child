const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../app/src/main/assets/www/audio-player.js');
class FakeAudio{static all=[];constructor(src){this.src=src;this.paused=false;FakeAudio.all.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){}load(){}}
test('tapping next clip stops previous audio; stale events cannot clear new playback',()=>{
 const states=[];const s=create({AudioClass:FakeAudio,onState:(...v)=>states.push(v)});s.play('c0000');const first=FakeAudio.all.at(-1);s.play('c0001');assert.equal(first.paused,true);first.onended();assert.equal(s.active(),'c0001');FakeAudio.all.at(-1).onended();assert.equal(s.active(),null);
});
test('native requests include changing token and stale same-id completion is ignored',()=>{
 const calls=[];const s=create({bridge:{playAudio:(...v)=>calls.push(v),stopAudio:()=>{} }});s.play('i_b');s.play('i_b');assert.ok(calls[1][1]>calls[0][1]);s.nativeStatus(calls[0][1],'i_b','ended');assert.equal(s.active(),'i_b');s.nativeStatus(calls[1][1],'i_b','ended');assert.equal(s.active(),null);
});
test('errors visible, playback cancelled on stop, invalid filenames rejected',()=>{
 let errors=0;const s=create({AudioClass:FakeAudio,onError:()=>errors++});assert.equal(s.play('../secret'),false);s.play('f_vn');FakeAudio.all.at(-1).onerror();assert.equal(errors,1);s.play('f_ang');s.stop();assert.equal(s.active(),null);assert.equal(FakeAudio.all.at(-1).paused,true);
});
