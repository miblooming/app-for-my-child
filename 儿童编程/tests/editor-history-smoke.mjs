import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const snap=p=>p.evaluate(()=>window.__townSnapshot),click=(p,a)=>p.locator(`[data-action="${a}"]:visible`).first().click();
const mv=d=>({type:'move',direction:d});
async function pageFor(program,shared=false){
  const p=await browser.newPage({viewport:{width:390,height:844}});await p.goto('http://127.0.0.1:5178');await p.waitForFunction(()=>!!window.__townSnapshot);
  const data=await snap(p);data.progress.creative=true;data.progress.sound=false;data.world.carrots=10;data.world.actors.rabbit.program=program;if(shared)data.world.actors.bear.program=[{type:'call',actionId:'right3'}];
  await p.addInitScript(data=>localStorage.setItem('qixiang.wonder-town.v1',JSON.stringify({version:2,...data,savedAt:Date.now()})),data);await p.reload();await p.waitForFunction(()=>!!window.__townSnapshot);await click(p,'continue-level');return p;
}
try{
  const p=await pageFor([{type:'if',condition:'right-clear',body:[mv('right'),mv('right'),mv('right')],otherwise:[]}]);await click(p,'chip-config');
  await p.locator('.nested-track .command-chip').first().click();assert.equal(await p.locator('.nested-track .command-chip').count(),3);
  await p.locator('[data-action="nested-add"][data-command="0"]').click();await click(p,'draft-undo');assert.equal(await p.locator('.nested-track .command-chip').count(),3);
  await click(p,'draft-delete-mode');await p.locator('.nested-track .command-chip').first().click();assert.equal(await p.locator('.nested-track .command-chip').count(),2);
  await click(p,'draft-undo');assert.equal(await p.locator('.nested-track .command-chip').count(),3);assert.equal(await p.locator('[data-action="draft-delete-mode"]').getAttribute('aria-pressed'),'true');
  await click(p,'draft-clear');assert.equal(await p.locator('.nested-track .command-chip').count(),0);await click(p,'draft-undo');assert.equal(await p.locator('.nested-track .command-chip').count(),3);
  await click(p,'draft-delete-mode');await p.locator('#condition-select').selectOption('target-right');await click(p,'draft-undo');assert.equal(await p.locator('#condition-select').inputValue(),'right-clear');
  await p.locator('[data-action="nested-add"][data-command="1"]').click();await p.getByRole('button',{name:'完成，放进程序',exact:true}).click();assert.equal((await snap(p)).world.actors.rabbit.program[0].body.length,4);
  await click(p,'undo');assert.equal((await snap(p)).world.actors.rabbit.program[0].body.length,3);await p.close();
  const shared=await pageFor([{type:'call',actionId:'right3'}],true);await click(shared,'run');await shared.waitForFunction(()=>window.__townSnapshot.world.actors.rabbit.x===2);
  await click(shared,'chip-config');await click(shared,'edit-action');await shared.locator('[data-action="nested-add"][data-command="1"]').click();await shared.getByRole('button',{name:'保存并放入程序',exact:true}).click();
  let state=await snap(shared);assert.equal(state.running,false);assert.equal(state.progress.actions[0].body.length,4);assert.equal(state.world.actors.rabbit.program.length,1);
  for(const id of ['rabbit','bear']){assert.equal(state.world.actors[id].current,-1);assert.deepEqual(state.world.actors[id].frames,[]);assert.equal(state.world.actors[id].startPending,true);}assert.equal(state.world.actors.rabbit.x,1);assert.equal(state.world.actors.bear.x,4);
  await click(shared,'undo');state=await snap(shared);assert.equal(state.progress.actions[0].body.length,3);assert.equal(state.world.actors.bear.x,4);assert.equal(state.world.actors.bear.current,-1);
  await click(shared,'run');await shared.waitForFunction(()=>window.__townSnapshot.world.actors.rabbit.x===2);await click(shared,'step-mode');assert.equal((await snap(shared)).world.actors.rabbit.x,2);
  await click(shared,'step');state=await snap(shared);assert.equal(state.world.actors.rabbit.x,1);assert.equal(state.world.actors.rabbit.current,-1);assert.equal(await shared.locator('.start-node').getAttribute('aria-current'),'step');
  await shared.waitForFunction(()=>!document.querySelector('#step-button').disabled);await click(shared,'step');assert.equal((await snap(shared)).world.actors.rabbit.x,2);assert.equal((await snap(shared)).world.actors.rabbit.current,0);
  await shared.close();console.log('PASS: nested delete/clear/undo in both modes; shared-action undo/reset; entering step mode starts with a separate coordinate reset.');
}finally{await browser.close();}
