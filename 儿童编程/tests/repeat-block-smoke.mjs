import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('开发资料/测试报告',{recursive:true});fs.mkdirSync('screenshots',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const click=(p,a)=>p.locator(`[data-action="${a}"]:visible`).first().click(),snapshot=p=>p.evaluate(()=>window.__townSnapshot),palette=(p,n)=>p.locator(`[data-action="palette"][data-command="${n}"]`).click();
const report={version:JSON.parse(fs.readFileSync('package.json','utf8')).version,checks:[]},errors=[];
async function readyStep(p){await p.waitForFunction(()=>!document.querySelector('#step-button').disabled);}
async function checkPaused(p){const s=await snapshot(p);assert.equal(s.running,false);assert.equal(s.world.actors[s.progress.selected].current,-1);assert.equal(s.world.actors[s.progress.selected].startPending,true);const ticks=s.world.ticks;await p.waitForTimeout(900);assert.equal((await snapshot(p)).world.ticks,ticks);}
async function drag(p,source,target){await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();const a=await source.boundingBox(),b=await target.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.waitForTimeout(450);await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await p.mouse.up();await p.waitForTimeout(100);}
try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5178');await p.waitForFunction(()=>!!window.__townSnapshot);await click(p,'sound');await p.locator('[data-level="3"]').click();
  assert.equal((await snapshot(p)).world.actors.rabbit.program.length,0);await palette(p,3);const rootChip=await p.locator('#program-track .command-chip').boundingBox();
  await palette(p,5);assert.equal(await p.locator('[role="dialog"]').count(),0,'repeat inserts directly without a modal');
  let s=await snapshot(p);assert.deepEqual(s.activeRepeat,[1]);assert.deepEqual(s.world.actors.rabbit.program[1],{type:'repeat',count:3,body:[]});
  await palette(p,3);await palette(p,2);s=await snapshot(p);assert.equal(s.world.actors.rabbit.program.length,2);assert.deepEqual(s.world.actors.rabbit.program[1].body.map(c=>c.direction),['right','left']);
  const childChip=await p.locator('.repeat-body .command-chip').first().boundingBox();assert.equal(childChip.width,rootChip.width);assert.equal(childChip.height,rootChip.height);
  const border=await p.locator('.repeat-group').evaluate(e=>{const s=getComputedStyle(e);return {top:s.borderTopWidth,left:s.borderLeftWidth,right:s.borderRightWidth,bottom:s.borderBottomWidth};});assert.deepEqual(border,{top:'0px',left:'4px',right:'4px',bottom:'4px'});
  await p.locator('[data-action="repeat-more"]').click();assert.equal((await snapshot(p)).world.actors.rabbit.program[1].count,4);await click(p,'undo');assert.equal((await snapshot(p)).world.actors.rabbit.program[1].count,3);
  await click(p,'append');await palette(p,4);assert.equal((await snapshot(p)).world.actors.rabbit.program.length,3);assert.equal((await snapshot(p)).world.actors.rabbit.program[1].body.length,2);
  await p.locator('.repeat-drag-handle').click();await palette(p,5);await palette(p,4);s=await snapshot(p);assert.deepEqual(s.activeRepeat,[1,2]);assert.equal(s.world.actors.rabbit.program[1].body[2].body[0].type,'wait');
  await click(p,'delete-mode');await p.locator('.repeat-body .command-chip[data-path="1.0"]').click();s=await snapshot(p);assert.deepEqual(s.activeRepeat,[1,1]);assert.equal(s.world.actors.rabbit.program[1].body.length,2);
  await click(p,'undo');assert.deepEqual((await snapshot(p)).activeRepeat,[1,2]);await p.locator('[data-action="repeat-delete"][data-path="1.2"]').click();assert.deepEqual((await snapshot(p)).activeRepeat,[1]);await click(p,'undo');await click(p,'delete-mode');
  await p.evaluate(()=>scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(3700);await p.screenshot({path:'screenshots/队列内重复框.png',fullPage:true});
  report.checks.push('repeat inserts and activates inline, U-shaped thick frame, original chip size preserved, repeated and nested additions stay inside, exit to root, nested delete and undo retarget selection');
  await click(p,'levels');await p.locator('[data-level="0"]').click();assert.equal((await snapshot(p)).world.actors.rabbit.program.length,0);
  await click(p,'levels');await p.locator('[data-level="3"]').click();assert.equal((await snapshot(p)).world.actors.rabbit.program.length,0,'reentering course also starts blank');assert.equal((await snapshot(p)).activeRepeat,null);
  await palette(p,5);await palette(p,3);await p.evaluate(()=>scrollTo(0,140));await p.waitForTimeout(3700);await p.screenshot({path:'screenshots/重复框手机.png',fullPage:false});await click(p,'step-mode');
  for(let i=0;i<4;i++){await click(p,'step');await readyStep(p);if(i>0){assert.equal(await p.locator('.repeat-body .command-chip.executing').getAttribute('data-path'),'0.0');assert.equal((await snapshot(p)).world.actors.rabbit.x,1+i);}}
  await click(p,'step');await readyStep(p);assert.equal((await snapshot(p)).world.successes.rabbit,1);assert.equal((await snapshot(p)).world.actors.rabbit.x,1);
  await p.reload();await p.waitForFunction(()=>!!window.__townSnapshot);await click(p,'continue-level');assert.equal((await snapshot(p)).world.actors.rabbit.program[0].body.length,1,'continue restores saved current program');
  await click(p,'run');await p.waitForFunction(()=>window.__townSnapshot.world.actors.rabbit.x===2);await p.locator('.repeat-drag-handle').click();await palette(p,2);await checkPaused(p);
  await click(p,'run');await p.waitForFunction(()=>window.__townSnapshot.world.actors.rabbit.current>=0);await p.locator('[data-action="repeat-more"]').click();await checkPaused(p);
  await click(p,'run');await p.waitForFunction(()=>window.__townSnapshot.world.actors.rabbit.current>=0);await click(p,'undo');await checkPaused(p);
  await click(p,'run');await p.waitForFunction(()=>window.__townSnapshot.world.actors.rabbit.current>=0);await click(p,'delete-mode');await p.locator('.repeat-body .command-chip').last().click();await checkPaused(p);await click(p,'delete-mode');
  await p.locator('.repeat-drag-handle').click();await palette(p,2);await click(p,'append');await palette(p,4);await p.locator('.repeat-drag-handle').click();await click(p,'run');
  await drag(p,p.locator('.repeat-drag-handle'),p.locator('.command-chip[data-path="1"]'));await checkPaused(p);s=await snapshot(p);assert.equal(s.world.actors.rabbit.program[0].type,'wait');assert.equal(s.world.actors.rabbit.program[1].type,'repeat');assert.deepEqual(s.activeRepeat,[1]);
  await click(p,'run');await drag(p,p.locator('.command-chip[data-path="1.0"]'),p.locator('.command-chip[data-path="1.1"]'));await checkPaused(p);assert.deepEqual((await snapshot(p)).world.actors.rabbit.program[1].body.map(c=>c.direction),['left','right']);
  await p.locator('.command-chip[data-path="1.0"]').focus();await p.keyboard.press('Alt+ArrowRight');assert.deepEqual((await snapshot(p)).world.actors.rabbit.program[1].body.map(c=>c.direction),['right','left']);
  await p.screenshot({path:'screenshots/重复执行指令高亮.png',fullPage:true});
  report.checks.push('every new course clears queues, continue restores current program, repeated child step highlighting and loop reset, edits/count/delete/undo stop execution until user restarts');
  await click(p,'menu');await click(p,'creative');await palette(p,5);await palette(p,6);await p.locator('#condition-select').selectOption('target-right');await p.getByRole('button',{name:'完成，放进程序',exact:true}).click();
  assert.equal((await snapshot(p)).world.actors.rabbit.program[0].body[0].type,'if');await p.locator('.chip-config[data-path="0.0"]').click();await p.locator('#condition-select').selectOption('right-clear');await p.getByRole('button',{name:'完成，放进程序',exact:true}).click();assert.equal((await snapshot(p)).world.actors.rabbit.program[0].body[0].condition,'right-clear');
  await palette(p,7);await p.locator('[data-action="use-action"][data-index="0"]').click();assert.equal((await snapshot(p)).world.actors.rabbit.program[0].body[1].type,'call');
  await p.locator('.chip-config[data-path="0.1"]').click();await p.locator('[data-action="use-action"][data-index="1"]').click();assert.equal((await snapshot(p)).world.actors.rabbit.program[0].body[1].actionId,'to-kitchen');
  report.checks.push('long press moves whole frame or a child, selection follows reordered frame, keyboard sorting, conditional/action editors save into active repeat and replace the correct nested item');
  assert.deepEqual(errors,[]);report.runtimeErrors=errors;fs.writeFileSync('开发资料/测试报告/队列重复框检查.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
