import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('开发资料/测试报告',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const errors=[],report={version:'1.6.0',checks:[]};
const snapshot=p=>p.evaluate(()=>window.__townSnapshot),click=(p,a)=>p.locator(`[data-action="${a}"]:visible`).first().click();
const tabs=p=>p.locator('#actor-tabs .actor-tab').evaluateAll(es=>es.map(e=>e.dataset.actor));
try{
  fs.mkdirSync('screenshots',{recursive:true});
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5178');await p.waitForFunction(()=>!!window.__townSnapshot);
  assert.equal((await snapshot(p)).isLevelHome,true);assert.equal((await snapshot(p)).homeCategory,'solo');assert.equal(await p.locator('.course-card').count(),20);
  assert.equal(await p.locator('.play-layout').isVisible(),false);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);
  const courseButton=await p.locator('#courses-button').boundingBox(),bookButton=await p.locator('[data-action="menu"]').boundingBox();assert.ok(courseButton.x+courseButton.width<=bookButton.x);
  await p.screenshot({path:'screenshots/手机关卡首页.png',fullPage:true});
  await click(p,'course-pair');assert.equal(await p.locator('.course-card').count(),10);
  await click(p,'course-solo');await p.locator('[data-level="8"]').click();await click(p,'sound');
  assert.deepEqual(await tabs(p),['duck']);let s=await snapshot(p);assert.equal(s.world.meals,1);assert.equal(s.progress.selected,'duck');
  for(let i=0;i<3;i++)await p.locator('[data-action="palette"][data-command="2"]').click();
  await click(p,'run');await p.waitForFunction(()=>window.__townSnapshot.progress.completed.includes(8),null,{timeout:15000});await click(p,'modal-close');await click(p,'run');
  await click(p,'levels');assert.equal((await snapshot(p)).isLevelHome,true);await p.locator('[data-level="4"]').click();assert.deepEqual(await tabs(p),['bear']);assert.equal((await snapshot(p)).world.carrots,1);
  await click(p,'levels');await p.locator('[data-level="8"]').click();assert.equal((await snapshot(p)).world.actors.duck.program.length,0,'each course entry starts with a blank program');
  await click(p,'levels');await click(p,'course-pair');
  for(const [level,actors] of [[12,['rabbit','bear']],[14,['bear','duck']],[16,['rabbit','duck']]]){
    await p.locator(`[data-level="${level}"]`).click();assert.deepEqual(await tabs(p),actors);await click(p,'levels');
  }
  report.checks.push('default solo homepage, 20 solo + 10 pair cards, primary level button before book, course-specific tabs and supplies, blank course entry, solo duck completion');
  await click(p,'course-solo');await p.locator('[data-level="2"]').click();await click(p,'hint');await p.getByRole('button',{name:'放入示例程序',exact:true}).click();
  await p.locator('[data-action="chip-config"][data-index="1"]').click();assert.equal(await p.locator('#condition-select option').count(),24);assert.equal(await p.locator('#condition-select optgroup').count(),5);
  await p.locator('#condition-select').selectOption('at-home');assert.match(await p.locator('#condition-current').textContent(),/现在成立/);
  await p.locator('#condition-select').selectOption('target-left');assert.match(await p.locator('#condition-current').textContent(),/现在不成立/);
  await p.locator('#condition-select').selectOption('right-clear');await p.getByRole('button',{name:'完成，放进程序',exact:true}).click();
  if(!(await snapshot(p)).stepMode)await click(p,'step-mode');for(let i=0;i<3;i++){await click(p,'step');await p.waitForFunction(()=>!document.querySelector('#step-button').disabled);}
  assert.equal((await snapshot(p)).world.actors.rabbit.x,2);assert.equal((await snapshot(p)).world.actors.rabbit.y,3,'false road condition follows else detour');assert.equal((await snapshot(p)).world.stats.conditions,1);
  await p.screenshot({path:'screenshots/条件绕路关卡.png',fullPage:true});
  for(let i=0;i<4;i++){await click(p,'step');await p.waitForFunction(()=>!document.querySelector('#step-button').disabled);}
  assert.ok((await snapshot(p)).progress.completed.includes(2));await click(p,'modal-close');
  await click(p,'levels');await p.locator('[data-level="0"]').click();await p.locator('[data-action="palette"][data-command="3"]').click();
  if(!(await snapshot(p)).stepMode)await click(p,'step-mode');for(let i=0;i<3;i++){await click(p,'step');await p.waitForFunction(()=>!document.querySelector('#step-button').disabled);}
  assert.equal((await snapshot(p)).world.successes.rabbit,0);assert.equal((await snapshot(p)).world.actors.rabbit.x,1);assert.ok(!(await snapshot(p)).progress.completed.includes(0));
  report.checks.push('24 grouped conditions, live true/false feedback, obstacle else branch executes in step mode, award at full program end, failed short program resets without star');
  await p.reload();await p.waitForFunction(()=>!!window.__townSnapshot);assert.equal((await snapshot(p)).isLevelHome,true);assert.equal((await snapshot(p)).world.actors.rabbit.program.length,1);
  assert.deepEqual(errors,[]);report.runtimeErrors=errors;fs.writeFileSync('开发资料/测试报告/关卡与条件交互检查.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
