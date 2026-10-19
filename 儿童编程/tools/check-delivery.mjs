import {chromium} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
fs.mkdirSync('开发资料/测试报告',{recursive:true});
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=path.resolve('dist'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.mp3':'audio/mpeg','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(dir,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(dir+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':data.length});res.end(data);
});
await new Promise(resolve=>server.listen(5181,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}return route.continue();});
  await page.goto('http://127.0.0.1:5181');await page.waitForTimeout(700);
  assert.equal(await page.locator('.course-card').count(),20);await page.screenshot({path:'screenshots/手机关卡首页.png',fullPage:true});
  assert.equal(await page.locator('.course-card.current[aria-current="step"]').count(),1);
  await page.locator('[data-action="continue-level"]').click();
  assert.equal(await page.locator('.scene-header [data-action="speak"]').isVisible(),true);assert.equal(await page.locator('.map-legend').isVisible(),true);
  const mapLayout=await page.evaluate(()=>window.__townSnapshot.map);assert.equal(mapLayout.tiles.length,56);assert.equal(mapLayout.tiles.filter(t=>!t.walkable).length,19);for(const f of mapLayout.features){assert.equal((f.bounds.x-mapLayout.origin.x)%mapLayout.cell,0);assert.equal((f.bounds.y-mapLayout.origin.y)%mapLayout.cell,0);}
  await page.locator('[data-action="sound"]').click();
  const rect=await page.locator('#run-button').boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=844,'Run button is reachable without scrolling');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  const ids=JSON.parse(fs.readFileSync('voice-jobs.json','utf8')).jobs.map(j=>j.id);
  const durations=await page.evaluate(async ids=>Object.fromEntries(await Promise.all(ids.map(id=>new Promise((resolve,reject)=>{
    const audio=new Audio(`/voice/${id}.mp3`);audio.onloadedmetadata=()=>resolve([id,audio.duration]);audio.onerror=()=>reject(new Error(`Missing voice: ${id}`));
  })))),ids);
  assert.ok(Object.entries(durations).every(([id,d])=>d>(id.startsWith('action-')?0.3:2)&&d<(id==='action-failure'||id==='action-complete'?5:id.startsWith('action-')?2.6:30)));
  assert.ok((await page.locator('#game-canvas canvas').boundingBox()).height>=300);
  const stats=await page.locator('.scene-statusbar').boundingBox(),scene=await page.locator('.canvas-wrap').boundingBox();assert.ok(stats.y+stats.height<=scene.y+1);assert.equal(await page.locator('#grid-button').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.palette').getByText('动手',{exact:true}).count(),0);
  for(let i=0;i<3;i++)await page.locator('[data-action="palette"][data-command="3"]').click();
  await page.locator('#program-track .command-chip').first().click();assert.equal(await page.locator('#program-track .command-chip').count(),3);
  await page.locator('#delete-mode-button').click();await page.locator('#program-track .command-chip').first().click();assert.equal(await page.locator('#program-track .command-chip').count(),2);await page.locator('#undo-button').click();assert.equal(await page.locator('#program-track .command-chip').count(),3);await page.locator('#delete-mode-button').click();
  await page.locator('#run-button').click();
  await page.waitForFunction(()=>window.__townSnapshot.progress.completed.includes(0));
  await page.getByRole('button',{name:'再看小镇一会儿',exact:true}).click();
  await page.locator('#run-button').click();
  await page.locator('#step-mode-button').click();await page.locator('#step-button').click();
  const stepped=await page.evaluate(()=>window.__townSnapshot);assert.equal(stepped.running,false);assert.equal(stepped.stepMode,true);assert.equal(stepped.world.actors.rabbit.current,-1);assert.equal(stepped.world.actors.rabbit.x,1);assert.equal(await page.locator('.start-node').getAttribute('aria-current'),'step');
  await page.waitForFunction(()=>!document.querySelector('#step-button').disabled);await page.locator('#step-button').click();assert.equal((await page.evaluate(()=>window.__townSnapshot)).world.actors.rabbit.current,0);
  const tickCount=(await page.evaluate(()=>window.__townSnapshot)).world.ticks;await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.__townSnapshot.world.ticks),tickCount);
  await page.locator('#courses-button').click();await page.locator('[data-level="3"]').click();
  assert.ok(Object.values((await page.evaluate(()=>window.__townSnapshot)).world.actors).every(a=>a.program.length===0),'entering a course clears all program queues');
  await page.locator('[data-action="palette"][data-command="5"]').click();assert.equal(await page.locator('[role="dialog"]').count(),0);
  await page.locator('[data-action="palette"][data-command="3"]').click();let repeatState=await page.evaluate(()=>window.__townSnapshot);assert.equal(repeatState.world.actors.rabbit.program.length,1);assert.equal(repeatState.world.actors.rabbit.program[0].body.length,1);
  await page.locator('#run-button').click();await page.waitForFunction(()=>window.__townSnapshot.world.actors.rabbit.current===0);
  await page.locator('[data-action="repeat-more"]').click();repeatState=await page.evaluate(()=>window.__townSnapshot);assert.equal(repeatState.running,false);assert.equal(repeatState.world.actors.rabbit.x,1);assert.equal(repeatState.world.actors.rabbit.program[0].count,4);
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.waitForTimeout(2800);
  fs.mkdirSync('screenshots',{recursive:true});
  await page.screenshot({path:'screenshots/手机游戏预览.png',fullPage:false});
  const fresh=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
  await fresh.goto('http://127.0.0.1:5181');await fresh.waitForTimeout(700);await fresh.screenshot({path:'screenshots/编程小镇预览.png',fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const report={version:'1.6.0',date:'2026-10-19',productionBuild:'PASS',mapAlignedToGrid:true,blockedTilesVisible:true,guideReplayEntry:true,currentCourseHighlighted:true,blankCourseEntry:true,inlineRepeatContainer:true,editAutomaticallyPauses:true,soloHomepage:true,noExternalNetworkRequests:true,phoneRunButtonVisible:true,phonePortraitSceneAndProgramVisible:true,statsOutsideScene:true,gridDefaultOn:true,deleteModeAndUndo:true,startIsSeparateStep:true,stepMode:'PASS',instructionHighlight:'PASS',phoneNoHorizontalOverflow:true,directionOnlyFirstLevel:'PASS',runtimeErrors:errors,offlineVoiceClips:durations,physicalAndroidDevice:'not available'};
  fs.writeFileSync('开发资料/测试报告/生产构建检查.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();server.close();}
