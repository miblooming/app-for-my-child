import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('开发资料/测试报告',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const errors=[],report={version:'1.6.0',checks:[]};
const snap=page=>page.evaluate(()=>window.__townSnapshot);
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
const mv=direction=>({type:'move',direction});
async function seed(page,program){
  await page.goto('http://127.0.0.1:5178');await page.waitForFunction(()=>!!window.__townSnapshot);
  const {world,progress}=await snap(page);progress.creative=true;progress.sound=false;
  world.actors.rabbit.program=program;
  await page.addInitScript(data=>localStorage.setItem('qixiang.wonder-town.v1',JSON.stringify(data)),{version:2,world,progress,savedAt:Date.now()});await page.reload();await page.waitForFunction(()=>!!window.__townSnapshot);await click(page,'continue-level');await page.waitForTimeout(250);
}
async function swipe(cdp,x,y,dx,dy){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=12;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/12,y:y+dy*i/12}]});
    await new Promise(r=>setTimeout(r,12));
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await new Promise(r=>setTimeout(r,200));
}
async function reorder(page,from,to){
  const a=await page.locator('#program-track .command-chip').nth(from).boundingBox(),b=await page.locator('#program-track .command-chip').nth(to).boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.waitForTimeout(440);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();
}
try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const phone=await context.newPage();phone.on('pageerror',e=>errors.push(e.message));
  await seed(phone,Array.from({length:16},(_,i)=>mv(i%2?'left':'right')));
  assert.equal((await snap(phone)).world.actors.rabbit.program.length,16);
  const cdp=await context.newCDPSession(phone);
  assert.equal((await snap(phone)).gridVisible,true);await click(phone,'grid');assert.equal((await snap(phone)).gridVisible,false);await click(phone,'grid');
  const stats=await phone.locator('.scene-statusbar').boundingBox(),map=await phone.locator('.canvas-wrap').boundingBox();assert.ok(stats.y+stats.height<=map.y+1,'stats are outside the scene');
  const layout=await phone.evaluate(()=>{
    const r=s=>document.querySelector(s).getBoundingClientRect().toJSON(),p=document.querySelector('#palette');
    return {game:r('.game-panel'),editor:r('.editor-panel'),palette:r('#palette'),buttons:[...p.children].map(e=>e.getBoundingClientRect().toJSON()),scroll:p.scrollWidth,client:p.clientWidth,font:getComputedStyle(p.firstElementChild).fontSize,width:document.documentElement.scrollWidth};
  });
  assert.ok(Math.abs(layout.editor.y-layout.game.bottom)<2,'editor touches the scene');
  assert.equal(layout.buttons[0].y,layout.buttons[3].y);assert.ok(layout.buttons[4].y>layout.buttons[0].y,'palette wraps into two rows');
  assert.equal(layout.scroll,layout.client);assert.equal(layout.width,390);assert.ok(parseFloat(layout.font)>=15);
  await phone.evaluate(()=>window.scrollTo(0,0));
  const canvas=await phone.locator('#game-canvas canvas').boundingBox();
  await swipe(cdp,canvas.x+canvas.width*.75,canvas.y+canvas.height*.8,0,-240);
  assert.ok(await phone.evaluate(()=>scrollY)>30,'a swipe on canvas scrolls the page');
  assert.equal(await phone.locator('[role="dialog"]').count(),0,'a scene swipe does not open a station');
  const visible=await phone.evaluate(()=>({canvas:document.querySelector('#game-canvas canvas').getBoundingClientRect().toJSON(),track:document.querySelector('#program-track').getBoundingClientRect().toJSON(),palette:document.querySelector('#palette').getBoundingClientRect().toJSON(),footer:document.querySelector('.editor-footer').getBoundingClientRect().toJSON()}));
  assert.ok(visible.canvas.bottom>300&&visible.canvas.y<10,'scene remains visible while editing');
  assert.ok(visible.track.y>=visible.canvas.bottom-1&&visible.track.bottom<visible.footer.y,'program visible below scene');
  assert.ok(visible.palette.bottom<=visible.footer.y,'wrapped commands are reachable with scene visible');
  report.checks.push('phone: adjacent editor, wrapped palette, normal fonts, canvas swipe scrolls page, scene/program/palette visible together');
  await phone.evaluate(()=>document.querySelector('#track-scroller').scrollLeft=0);
  const chip=await phone.locator('#program-track .command-chip').nth(2).boundingBox(),before=(await snap(phone)).world.actors.rabbit.program;
  await swipe(cdp,Math.min(340,chip.x+chip.width/2),chip.y+chip.height/2,-200,0);
  const scrolled=await phone.locator('#track-scroller').evaluate(e=>e.scrollLeft);assert.ok(scrolled>100,'swipe from chip scrolls track');
  assert.deepEqual((await snap(phone)).world.actors.rabbit.program,before,'swiping does not delete or reorder');
  const track=await phone.locator('#track-scroller').boundingBox();await swipe(cdp,90,track.y+42,180,0);
  assert.ok(await phone.locator('#track-scroller').evaluate(e=>e.scrollLeft)<scrolled,'track swipes both directions');
  await phone.locator('#program-track .command-chip').first().tap();assert.equal((await snap(phone)).world.actors.rabbit.program.length,16,'normal taps never delete');
  assert.equal(await phone.locator('#clear-button').isVisible(),false);
  await phone.locator('[data-action="palette"][data-command="4"]').click();await click(phone,'undo');assert.equal((await snap(phone)).world.actors.rabbit.program.length,16,'undo works in normal mode');
  await click(phone,'delete-mode');assert.equal(await phone.locator('#clear-button').isVisible(),true);
  await phone.locator('#program-track .command-chip').first().tap();assert.equal((await snap(phone)).world.actors.rabbit.program.length,15);
  await click(phone,'undo');assert.equal((await snap(phone)).world.actors.rabbit.program.length,16);assert.equal((await snap(phone)).deleteMode,true);
  await click(phone,'clear');assert.equal((await snap(phone)).world.actors.rabbit.program.length,0);
  await click(phone,'undo');assert.equal((await snap(phone)).world.actors.rabbit.program.length,16);
  await phone.screenshot({path:'screenshots/手机删除模式.png',fullPage:false});
  await click(phone,'delete-mode');assert.equal(await phone.locator('#clear-button').isVisible(),false);
  await phone.evaluate(()=>document.querySelector('#track-scroller').scrollLeft=0);
  const first=await phone.locator('#program-track .command-chip').nth(0).boundingBox(),third=await phone.locator('#program-track .command-chip').nth(2).boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:first.x+first.width/2,y:first.y+first.height/2}]});await phone.waitForTimeout(450);
  for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:first.x+first.width/2+(third.x-first.x)*i/10,y:first.y+first.height/2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.deepEqual((await snap(phone)).world.actors.rabbit.program.slice(0,3).map(c=>c.direction),['left','right','right']);
  report.checks.push('phone: bidirectional swipe, safe normal taps, delete mode, one-tap clear, undo in both modes, long-press reorder, stats outside scene, default grid');
  await phone.screenshot({path:'screenshots/手机编程工作区.png',fullPage:false});
  await context.close();

  console.log('Phone gestures passed');
  const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await seed(page,[{type:'repeat',count:9,body:[mv('right'),mv('left')]},{type:'wait'}]);
  await click(page,'run');await page.waitForFunction(()=>window.__townSnapshot.world.actors.rabbit.x===2);
  let a=(await snap(page)).world.actors.rabbit;assert.equal(a.current,0);
  await page.locator('[data-action="palette"][data-command="0"]').click();
  let state=await snap(page);assert.equal(state.running,false);assert.equal(state.world.actors.rabbit.x,1);assert.equal(state.world.actors.rabbit.current,-1);assert.equal(state.world.actors.rabbit.carrying,'carrot');assert.deepEqual(state.world.actors.rabbit.frames,[]);
  await click(page,'run');await click(page,'delete-mode');await page.locator('#program-track .command-chip[data-path="2"]').click();state=await snap(page);assert.equal(state.running,false);assert.equal(state.world.actors.rabbit.current,-1);assert.equal(state.world.actors.rabbit.x,1);await click(page,'delete-mode');
  await click(page,'run');await reorder(page,0,1);assert.equal((await snap(page)).running,false);
  await click(page,'repeat-less');const ticks=(await snap(page)).world.ticks;
  await page.waitForTimeout(1000);assert.equal((await snap(page)).world.ticks,ticks,'repeat editing keeps world paused');
  state=await snap(page);assert.equal(state.running,false);assert.equal(state.world.actors.rabbit.carrying,'carrot');assert.equal(state.world.actors.rabbit.current,-1);assert.equal(state.world.actors.rabbit.x,1);assert.equal(state.world.actors.rabbit.cycles,0);
  report.checks.push('append/delete/reorder/repeat-count edits stop execution and reset position/cursor while preserving cargo');

  await page.close();
  console.log('Live editing passed');
  const step=await browser.newPage({viewport:{width:390,height:844}});step.on('pageerror',e=>errors.push(e.message));
  await seed(step,[mv('right'),mv('right'),mv('right')]);await click(step,'step-mode');
  assert.equal(await step.locator('#step-button').isVisible(),true);
  for(const [index,x] of [[-1,1],[0,2],[1,3],[2,4],[-1,1],[0,2]]) {
    await click(step,'step');let value=await snap(step);assert.equal(value.running,false);assert.equal(value.world.actors.rabbit.x,x);assert.equal(value.world.actors.rabbit.current,index);
    if(index<0)assert.equal(await step.locator('.start-node').getAttribute('aria-current'),'step');else assert.equal(await step.locator('#program-track .command-chip.executing').getAttribute('data-index'),String(index));
    const ticks=value.world.ticks;await step.waitForTimeout(850);assert.equal((await snap(step)).world.ticks,ticks,'step mode does not auto advance');
  }
  await step.evaluate(()=>scrollTo(0,document.body.scrollHeight));await step.screenshot({path:'screenshots/手机步模式.png',fullPage:false});
  await click(step,'run');assert.equal((await snap(step)).running,true);assert.equal((await snap(step)).stepMode,false);
  await step.waitForTimeout(900);assert.equal(await step.locator('#program-track .executing').getAttribute('data-index'),String((await snap(step)).world.actors.rabbit.current));
  await click(step,'run');const current=(await snap(step)).world.actors.rabbit.current;assert.equal(await step.locator('#program-track .executing').getAttribute('data-index'),String(current));
  report.checks.push('step mode: separate highlighted start/reset step, then one click per instruction, no auto advance, persistent highlight, resume continuous');
  await step.close();

  const follow=await browser.newPage({viewport:{width:390,height:844}});follow.on('pageerror',e=>errors.push(e.message));
  await seed(follow,Array.from({length:24},(_,i)=>mv(i%2?'left':'right')));await click(follow,'speed');await click(follow,'run');
  await follow.waitForFunction(()=>window.__townSnapshot.world.actors.rabbit.current>=12,null,{timeout:10000});
  const high=await follow.evaluate(()=>({current:window.__townSnapshot.world.actors.rabbit.current,chip:document.querySelector('#program-track .executing').getBoundingClientRect().toJSON(),track:document.querySelector('#track-scroller').getBoundingClientRect().toJSON(),index:Number(document.querySelector('#program-track .executing').dataset.index)}));
  assert.equal(high.index,high.current);assert.ok(high.chip.x>=high.track.x&&high.chip.right<=high.track.right,'current instruction scrolls into horizontal view');
  assert.equal(await follow.evaluate(()=>scrollY),0,'highlight follow never scrolls page');
  report.checks.push('continuous mode: correct instruction highlight and horizontal follow without vertical page jumps');
  await follow.close();
  assert.deepEqual(errors,[]);report.runtimeErrors=errors;fs.writeFileSync('开发资料/测试报告/编程交互检查.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
