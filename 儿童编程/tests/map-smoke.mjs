import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('开发资料/测试报告',{recursive:true});fs.mkdirSync('screenshots',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const click=(p,a)=>p.locator(`[data-action="${a}"]:visible`).first().click(),snap=p=>p.evaluate(()=>window.__townSnapshot),errors=[];
async function step(p){await click(p,'step');await p.waitForFunction(()=>!document.querySelector('#step-button').disabled);}
try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5178');await p.waitForFunction(()=>!!window.__townSnapshot);await click(p,'sound');await p.locator('[data-level="4"]').click();
  const initial=(await snap(p)).map,{cell,origin}=initial;assert.equal(initial.tiles.length,56);assert.equal(initial.tiles.filter(t=>!t.walkable).length,19);
  const occupied=new Set();
  for(const feature of initial.features){const b=feature.bounds,a=feature.artBounds;assert.equal((b.x-origin.x)%cell,0);assert.equal((b.y-origin.y)%cell,0);assert.equal(b.width%cell,0);assert.equal(b.height%cell,0);assert.ok(a.x>=b.x&&a.y>=b.y&&a.x+a.width<=b.x+b.width+0.01&&a.y+a.height<=b.y+b.height+0.01,'art stays inside its blocked footprint');for(let y=0;y<b.height/cell;y++)for(let x=0;x<b.width/cell;x++)occupied.add(`${(b.x-origin.x)/cell+x},${(b.y-origin.y)/cell+y}`);}
  for(const t of initial.tiles){assert.equal(t.walkable,!occupied.has(`${t.x},${t.y}`));assert.equal(t.fill,t.walkable?0xfff2cf:0xc7d1bc);assert.equal(t.bounds.x,origin.x+t.x*cell);assert.equal(t.bounds.y,origin.y+t.y*cell);}
  for(const station of initial.stations){assert.equal(initial.tiles.find(t=>t.x===station.x&&t.y===station.y).walkable,true);assert.equal(station.center.x,origin.x+(station.x+.5)*cell);assert.equal(station.center.y,origin.y+(station.y+.5)*cell);}
  await p.locator('[data-action="palette"][data-command="0"]').click();await click(p,'step-mode');await step(p);await step(p);let s=await snap(p);assert.equal(s.world.actors.bear.status,'blocked');assert.equal(s.world.actors.bear.x,4);assert.equal(s.world.actors.bear.y,2);assert.equal(s.map.tiles.find(t=>t.x===4&&t.y===1).walkable,false,'warehouse footprint also blocks real movement');
  await click(p,'levels');await p.locator('[data-level="4"]').click();await click(p,'hint');await p.getByRole('button',{name:'放入示例程序',exact:true}).click();if(!(await snap(p)).stepMode)await click(p,'step-mode');await step(p);for(const y of [3,4,5]){await step(p);assert.equal((await snap(p)).world.actors.bear.y,y);assert.equal((await snap(p)).map.tiles.find(t=>t.x===4&&t.y===y).walkable,true);}
  assert.equal((await snap(p)).world.stats.cooked,1);await p.waitForTimeout(3000);await p.screenshot({path:'screenshots/地图通行与工作点.png',fullPage:true});
  await click(p,'levels');await p.locator('[data-level="6"]').click();s=await snap(p);assert.equal(s.map.tiles.find(t=>t.x===4&&t.y===3).walkable,false);assert.equal(s.map.tiles.filter(t=>!t.walkable).length,20);
  await click(p,'hint');await p.getByRole('button',{name:'放入示例程序',exact:true}).click();if(!(await snap(p)).stepMode)await click(p,'step-mode');await step(p);await step(p);s=await snap(p);assert.equal(s.world.actors.bear.x,3);assert.equal(s.world.actors.bear.y,2);assert.equal(s.world.stats.conditions,1,'road condition follows the same obstacle shown in the map');
  const colors=s.map.tiles.map(t=>t.fill);await click(p,'grid');assert.deepEqual((await snap(p)).map.tiles.map(t=>t.fill),colors,'hiding grid does not hide walkability cues');assert.equal(await p.locator('.map-legend').isVisible(),true);await click(p,'grid');
  await p.screenshot({path:'screenshots/地图路障与绕行.png',fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);assert.deepEqual(errors,[]);
  const report={version:JSON.parse(fs.readFileSync('package.json','utf8')).version,result:'PASS',gridCells:56,fixedBlockedCells:19,featuresAlignedAndContained:true,allWorkPadsEnterable:true,visibleBlocksMatchMovement:true,conditionalDetourMatchesObstacle:true,walkabilityVisibleWithoutGrid:true,runtimeErrors:errors};fs.writeFileSync('开发资料/测试报告/地图对齐与阻挡检查.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
