import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('开发资料/测试报告',{recursive:true});
fs.mkdirSync('screenshots',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const errors=[];
function monitor(page){page.on('pageerror',e=>errors.push(e.message));}
const snapshot=page=>page.evaluate(()=>window.__townSnapshot);
const click=async(page,action)=>{if(['creative','adventure','levels'].includes(action)&&!await page.locator(`[data-action="${action}"]:visible`).count())await page.locator('[data-action="menu"]').click();await page.locator(`[data-action="${action}"]:visible`).first().click();};
const palette=(page,id)=>page.locator(`[data-action="palette"][data-command="${id}"]`).click();
const dirs=p=>p.map(c=>c.direction||c.type);
async function mouseReorder(page,from,to,scope='track'){
  const list=scope==='track'?'#program-track':scope==='repeat'?'.repeat-body':'.nested-track';
  const source=page.locator(`${list} .command-item`).nth(from),target=page.locator(`${list} .command-item`).nth(to);
  await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();
  const a=await source.locator('.command-chip').boundingBox(),b=await target.locator('.command-chip').boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.waitForTimeout(460);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();await page.waitForTimeout(120);
}
try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}});monitor(page);
  await page.goto('http://127.0.0.1:5178');await page.waitForFunction(()=>!!window.__townSnapshot);await click(page,'continue-level');await click(page,'sound');
  assert.equal(await page.locator('.palette').getByText('动手',{exact:true}).count(),0);
  assert.ok((await page.locator('.canvas-wrap').boundingBox()).height>=450);
  const game=await page.locator('.game-panel').boundingBox(),editor=await page.locator('.editor-panel').boundingBox();
  assert.ok(editor.y>=game.y+game.height);assert.ok(Math.abs(editor.x-game.x)<2);
  for(const id of [3,0,2])await palette(page,id);
  await click(page,'delete-mode');await page.locator('[data-action="chip"][data-index="1"]').click();
  assert.deepEqual(dirs((await snapshot(page)).world.actors.rabbit.program),['right','left']);
  await click(page,'undo');await mouseReorder(page,0,2);
  assert.deepEqual(dirs((await snapshot(page)).world.actors.rabbit.program),['up','left','right']);
  // A deliberate tap immediately after a drag must still delete exactly one instruction.
  await page.locator('[data-action="chip"][data-index="2"]').click();
  assert.equal((await snapshot(page)).world.actors.rabbit.program.length,2);
  await click(page,'creative');
  await palette(page,5);await palette(page,3);await palette(page,0);await palette(page,2);
  await click(page,'delete-mode');await page.locator('[data-action="chip"][data-path="0.1"]').click();await click(page,'delete-mode');
  await mouseReorder(page,0,1,'repeat');
  let program=(await snapshot(page)).world.actors.rabbit.program;
  assert.equal(program.at(-1).type,'repeat');assert.deepEqual(dirs(program.at(-1).body),['left','right']);
  await click(page,'repeat-more');
  assert.equal((await snapshot(page)).world.actors.rabbit.program.at(-1).count,4);
  await click(page,'append');
  await palette(page,6);await page.locator('#condition-select').selectOption('carrots');await click(page,'branch-otherwise');await page.locator('[data-action="nested-add"][data-command="2"]').click();
  await page.getByRole('button',{name:'完成，放进程序',exact:true}).click();program=(await snapshot(page)).world.actors.rabbit.program;assert.equal(program.at(-1).otherwise.length,2);
  await palette(page,7);await page.getByRole('button',{name:'新建拿手动作',exact:true}).click();await page.locator('#action-name').fill('去花园');await page.getByRole('button',{name:'保存并放入程序',exact:true}).click();
  assert.equal((await snapshot(page)).progress.actions.at(-1).name,'去花园');
  for(const id of ['rabbit','bear','duck']){
    await page.locator(`[data-action="actor"][data-actor="${id}"]`).click();await click(page,'hint');await page.getByRole('button',{name:'放入示例程序',exact:true}).click();
  }
  await click(page,'speed');await click(page,'run');
  await page.waitForFunction(()=>window.__townSnapshot.world.stats.served>=3,{},{timeout:20000});
  await page.waitForFunction(()=>{const a=window.__townSnapshot.world.actors.rabbit;return a.cycles>=2&&a.current===-1&&a.x===1&&a.y===2;},{},{timeout:10000});
  await click(page,'run');const before=await snapshot(page);assert.ok(before.world.stats.cooked>=3);
  await page.reload();await page.waitForFunction(()=>!!window.__townSnapshot);const after=await snapshot(page);
  assert.equal(after.running,false);assert.deepEqual(after.world.stats,before.world.stats);
  for(const id of ['rabbit','bear','duck'])for(const key of ['x','y','carrying','needsWork','frames'])assert.deepEqual(after.world.actors[id][key],before.world.actors[id][key]);
  await click(page,'continue-level');await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);await page.screenshot({path:'screenshots/新版竖向桌面.png',fullPage:true});
  // Touch rather than mouse input verifies the actual hold/drag gesture on a phone.
  const phoneContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),phone=await phoneContext.newPage();monitor(phone);
  await phone.goto('http://127.0.0.1:5178');await phone.waitForFunction(()=>!!window.__townSnapshot);await click(phone,'continue-level');await click(phone,'sound');
  const phoneCanvas=await phone.locator('#game-canvas canvas').boundingBox();assert.ok(phoneCanvas.height>=300);
  const sizes=await phone.evaluate(()=>['.mission-card>p','.palette-command span','.actor-tab strong','.program-title'].map(selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)));
  assert.ok(sizes.every(n=>n>=15));assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth),390);
  for(const id of [3,0,2])await palette(phone,id);
  await click(phone,'delete-mode');
  const chip=phone.locator('[data-action="chip"][data-index="1"]');await chip.scrollIntoViewIfNeeded();const tap=await chip.boundingBox();await phone.touchscreen.tap(tap.x+tap.width/2,tap.y+tap.height/2);
  assert.deepEqual(dirs((await snapshot(phone)).world.actors.rabbit.program),['right','left']);await click(phone,'undo');
  await phone.locator('[data-action="chip"][data-index="0"]').scrollIntoViewIfNeeded();
  const a=await phone.locator('[data-action="chip"][data-index="0"]').boundingBox(),b=await phone.locator('[data-action="chip"][data-index="2"]').boundingBox();
  const cdp=await phoneContext.newCDPSession(phone);
  const from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:b.x+b.width/2,y:b.y+b.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:0}]});await phone.waitForTimeout(460);
  for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8,id:0}]});await phone.waitForTimeout(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await phone.waitForTimeout(150);
  assert.deepEqual(dirs((await snapshot(phone)).world.actors.rabbit.program),['up','left','right']);
  await phone.evaluate(()=>window.scrollTo(0,0));await phone.waitForTimeout(300);await phone.screenshot({path:'screenshots/新版竖向手机.png',fullPage:true});
  // Fresh first-level play only needs directions: no manual interaction command exists.
  await click(phone,'hint');await phone.getByRole('button',{name:'放入示例程序',exact:true}).click();await click(phone,'run');
  await phone.waitForFunction(()=>window.__townSnapshot.progress.completed.includes(0));await phone.getByRole('button',{name:'再看小镇一会儿',exact:true}).click();await click(phone,'run');
  assert.ok((await snapshot(phone)).world.stats.deposited>=1);
  const tablet=await browser.newPage({viewport:{width:768,height:1024}});monitor(tablet);await tablet.goto('http://127.0.0.1:5178');await tablet.waitForTimeout(500);
  assert.equal(await tablet.evaluate(()=>document.documentElement.scrollWidth),768);await tablet.screenshot({path:'screenshots/新版竖向平板.png',fullPage:true});
  assert.deepEqual(errors,[]);
  const report={result:'PASS',checks:['vertical scene and editor','readable app fonts','tap deletes only in delete mode','mouse long-press sorting','touch tap in delete mode','touch long-press sorting','no deletion after dragging','nested block sorting and deletion','dedicated complex command edit','no manual interaction instruction','automatic profession work','cycle returns to starting location','parallel production chain','exact v2 save restore','phone/tablet no horizontal overflow'],stats:before.world.stats};
  fs.writeFileSync('开发资料/测试报告/新版交互验证.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
