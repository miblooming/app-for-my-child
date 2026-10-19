import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('开发资料/测试报告',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const click=(p,a)=>p.locator(`[data-action="${a}"]:visible`).first().click(),snapshot=p=>p.evaluate(()=>window.__townSnapshot);
const logs=[];
try{
  for(const success of [false,true]){
    const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await p.addInitScript(()=>{window.__voiceLog=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const id=this.src.split('/').at(-1).replace('.mp3',''),entry={id,start:null,end:null,duration:null};window.__voiceLog.push(entry);this.addEventListener('playing',()=>{entry.start=performance.now();entry.duration=this.duration;entry.snapshot=window.__townSnapshot;},{once:true});this.addEventListener('ended',()=>entry.end=performance.now(),{once:true});return play.call(this);};});
    await p.goto('http://127.0.0.1:5178');await p.waitForFunction(()=>!!window.__townSnapshot);await click(p,'continue-level');
    for(let i=0;i<(success?3:1);i++)await p.locator('[data-action="palette"][data-command="3"]').click();
    await click(p,'step-mode');for(let i=0;i<(success?4:2);i++){await click(p,'step');await p.waitForFunction(()=>!document.querySelector('#step-button').disabled,null,{timeout:10000});}
    await click(p,'step');const result=success?'action-complete':'action-failure';
    await p.waitForFunction(id=>window.__voiceLog.some(e=>e.id===id&&e.start),result);
    let s=await snapshot(p);assert.equal(await p.locator('#step-button').isDisabled(),true);assert.equal(s.audio.presentation.x,success?4:2,'result is spoken at the endpoint before home reset');
    assert.equal(s.world.successes.rabbit,success?1:0);await p.waitForFunction(id=>window.__voiceLog.some(e=>e.id===id&&e.end),result);
    await p.waitForFunction(()=>window.__voiceLog.filter(e=>e.id==='action-start'&&e.start).length===2);
    s=await snapshot(p);assert.equal(s.audio.presentation.x,1);await p.waitForFunction(()=>!document.querySelector('#step-button').disabled,null,{timeout:15000});
    const log=await p.evaluate(()=>window.__voiceLog.map(({snapshot,...entry})=>entry)),completed=log.filter(e=>e.end),outcome=completed.findIndex(e=>e.id===result);
    assert.ok(completed[outcome].duration>2);assert.ok(completed[outcome+1].id==='action-start');assert.ok(completed[outcome+1].start>=completed[outcome].end-3);
    assert.equal((await snapshot(p)).progress.completed.includes(0),success);logs.push({result,voices:log});await p.close();
  }
  fs.writeFileSync('开发资料/测试报告/任务结果配音检查.json',JSON.stringify({version:JSON.parse(fs.readFileSync('package.json','utf8')).version,result:'PASS',actualAudioEndedBeforeReset:true,logs},null,2));console.log('PASS: real failure/completion audio finishes at the endpoint, then start/reset narration; step is locked throughout; only successful programs award a star.');
}finally{await browser.close();}
