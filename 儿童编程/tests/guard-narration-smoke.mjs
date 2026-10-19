import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('开发资料/测试报告',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const click=(p,a)=>p.locator(`[data-action="${a}"]:visible`).first().click(),snap=p=>p.evaluate(()=>window.__townSnapshot);
async function next(p){await click(p,'step');await p.waitForFunction(()=>!document.querySelector('#step-button').disabled,null,{timeout:12000});}
try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await p.addInitScript(()=>{window.__voiceLog=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const id=this.src.split('/').at(-1).replace('.mp3',''),entry={id,start:null,end:null};window.__voiceLog.push(entry);this.addEventListener('playing',()=>entry.start=performance.now(),{once:true});this.addEventListener('ended',()=>entry.end=performance.now(),{once:true});return play.call(this);};});
  await p.goto('http://127.0.0.1:5178');await p.waitForFunction(()=>!!window.__townSnapshot);await p.locator('[data-level="24"]').click();await click(p,'hint');await p.getByRole('button',{name:'放入示例程序',exact:true}).click();await click(p,'step-mode');await next(p);await next(p);await click(p,'step');
  await p.waitForFunction(()=>window.__townSnapshot.audio.voice==='action-down');let s=await snap(p);assert.equal(s.world.actors.fox.y,3);assert.equal(s.world.monsters[0].alive,false);assert.equal(s.world.monsters[0].pendingBy,'fox');assert.equal(s.map.monsters[0].visible,true,'monster stays visible until same-cell attack cue');
  await p.waitForFunction(()=>window.__townSnapshot.audio.voice==='action-attack');s=await snap(p);assert.equal(s.audio.presentation.y,3);assert.equal(s.map.monsters[0].visible,false);assert.equal(s.world.monsters[0].pendingBy,undefined);assert.equal(await p.locator('#step-button').isDisabled(),true);await p.waitForFunction(()=>!document.querySelector('#step-button').disabled);
  const clips=await p.evaluate(()=>window.__voiceLog.filter(e=>e.start&&e.id.startsWith('action-')));assert.deepEqual(clips.map(e=>e.id),['action-start','action-down','action-down','action-attack']);for(let i=1;i<clips.length;i++)assert.ok(clips[i].start>=clips[i-1].end-3);
  await p.route('**/voice/action-attack.mp3',route=>route.abort());await next(p);await next(p);s=await snap(p);assert.equal(s.world.stats.defeated,2);assert.ok(s.world.monsters.every(m=>!m.pendingBy));assert.equal(s.audio.busyActors.length,0,'missing attack audio releases pending cells and execution locks');
  const report={version:'1.6.0',result:'PASS',realAttackVoiceAfterMovement:true,monsterDisappearsAtAttackCue:true,stepWaitsForVoice:true,missingAttackVoiceDoesNotBlockPartners:true,clips};fs.writeFileSync('开发资料/测试报告/卫士动作配音检查.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
