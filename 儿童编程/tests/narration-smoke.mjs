import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('开发资料/测试报告',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const errors=[],report={version:JSON.parse(fs.readFileSync('package.json','utf8')).version,checks:[]};
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
const snapshot=page=>page.evaluate(()=>window.__townSnapshot);
async function setup(selected='rabbit'){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178');await page.waitForFunction(()=>!!window.__townSnapshot);
  const data=await snapshot(page);data.progress.creative=true;data.progress.sound=true;data.progress.selected=selected;data.progress.speed=2;data.world.carrots=10;data.world.meals=10;
  for(const [id,direction] of [['rabbit','right'],['bear','down'],['duck','left']])data.world.actors[id].program=Array.from({length:3},()=>({type:'move',direction}));
  await page.addInitScript(data=>{
    localStorage.setItem('qixiang.wonder-town.v1',JSON.stringify({version:2,...data,savedAt:Date.now()}));
    window.__voiceLog=[];
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      const id=this.src.split('/').at(-1).replace('.mp3',''),entry={id,start:null,end:null,duration:null,error:false};window.__voiceLog.push(entry);
      this.addEventListener('playing',()=>{entry.start=performance.now();entry.duration=this.duration;},{once:true});
      this.addEventListener('ended',()=>{entry.end=performance.now();},{once:true});this.addEventListener('error',()=>{entry.error=true;},{once:true});
      return play.call(this);
    };
  },data);
  await page.reload();await page.waitForFunction(()=>!!window.__townSnapshot);await click(page,'continue-level');return page;
}
try{
  const page=await setup();await click(page,'run');
  await page.waitForFunction(()=>window.__voiceLog.some(e=>e.id==='action-start'&&e.start));
  let value=await snapshot(page);assert.equal(value.world.actors.rabbit.current,-1);assert.equal(value.world.actors.rabbit.x,1);
  await page.waitForTimeout(900);value=await snapshot(page);assert.equal(value.world.actors.rabbit.x,1,'selected actor waits for start speech');assert.ok(value.world.actors.bear.current>=0||value.world.actors.bear.cycles>0,'unselected actor continues');
  await page.waitForFunction(()=>window.__voiceLog.some(e=>e.id==='action-collect'&&e.start));
  value=await snapshot(page);assert.equal(value.world.actors.rabbit.x,2);assert.equal(value.audio.presentation.x,1,'collection is shown at the farm before movement speech');assert.equal(value.audio.presentation.carrying,'carrot');
  await page.waitForTimeout(1300);value=await snapshot(page);assert.equal(value.world.actors.rabbit.x,2,'next command cannot cut off collection/movement narration');
  await page.waitForFunction(()=>window.__voiceLog.some(e=>e.id==='action-deposit'&&e.end),null,{timeout:20000});
  await click(page,'run');const log=await page.evaluate(()=>window.__voiceLog),completed=log.filter(e=>e.end);
  assert.deepEqual(completed.slice(0,6).map(e=>e.id),['action-start','action-collect','action-right','action-right','action-right','action-deposit']);
  for(let i=1;i<completed.length;i++)assert.ok(completed[i].start>=completed[i-1].end-3,'speech clips finish before the next clip');
  assert.ok(!log.some(e=>['action-cook','action-take-carrot','action-take-meal','action-left','action-serve'].includes(e.id)),'only selected rabbit narrates');
  assert.ok(completed.every(e=>e.duration>0&&e.duration<=2.6));assert.ok((await snapshot(page)).world.stats.cooked>0);
  report.checks.push('real audio playback: start, collection, direction and deposit are sequential and complete; only selected actor speaks; other actors continue');report.rabbit=completed;
  await page.close();

  const step=await setup('duck');await click(step,'step-mode');await click(step,'step');
  await step.waitForFunction(()=>window.__voiceLog.some(e=>e.id==='action-start'&&e.start));
  assert.equal(await step.locator('#step-button').isDisabled(),true);assert.equal((await snapshot(step)).world.actors.duck.current,-1);
  await step.waitForFunction(()=>!document.querySelector('#step-button').disabled);await click(step,'step');
  await step.waitForFunction(()=>window.__voiceLog.some(e=>e.id==='action-take-meal'&&e.start));
  let tick=(await snapshot(step)).world.ticks;await step.evaluate(()=>document.querySelector('#step-button').click());assert.equal((await snapshot(step)).world.ticks,tick,'rapid clicks cannot skip speech');
  assert.equal((await snapshot(step)).audio.presentation.x,4,'taking soup stays at the counter');
  await step.waitForFunction(()=>window.__voiceLog.some(e=>e.id==='action-left'&&e.start));assert.equal(await step.locator('#step-button').isDisabled(),true);
  await step.waitForFunction(()=>!document.querySelector('#step-button').disabled);
  for(let i=0;i<2;i++){await click(step,'step');await step.waitForFunction(()=>!document.querySelector('#step-button').disabled);}
  const duckLog=await step.evaluate(()=>window.__voiceLog);assert.deepEqual(duckLog.filter(e=>e.end).map(e=>e.id),['action-start','action-take-meal','action-left','action-left','action-left','action-serve']);
  assert.equal((await snapshot(step)).world.actors.duck.x,1);assert.equal((await snapshot(step)).world.actors.duck.current,2);
  await step.evaluate(()=>scrollTo(0,document.body.scrollHeight));await step.screenshot({path:'screenshots/动作童声步模式.png',fullPage:false});
  report.checks.push('step mode waits for complete start, soup pickup, movement and delivery narration; repeated clicks do not skip commands');report.duck=duckLog;
  await step.close();

  const missing=await setup();await missing.route('**/voice/action-right.mp3',route=>route.abort());await click(missing,'step-mode');await click(missing,'step');await missing.waitForFunction(()=>!document.querySelector('#step-button').disabled);
  await click(missing,'step');await missing.waitForFunction(()=>!document.querySelector('#step-button').disabled,null,{timeout:7000});
  assert.equal((await snapshot(missing)).audio.busyActors.length,0);assert.equal((await snapshot(missing)).world.actors.rabbit.current,0);
  report.checks.push('missing audio releases the execution lock and does not freeze the game');await missing.close();
  assert.deepEqual(errors,[]);report.runtimeErrors=errors;fs.writeFileSync('开发资料/测试报告/动作配音播放检查.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks,runtimeErrors:errors},null,2));
}finally{await browser.close();}
