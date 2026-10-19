import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('开发资料/测试报告',{recursive:true});fs.mkdirSync('screenshots',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const click=(p,a)=>p.locator(`[data-action="${a}"]:visible`).first().click(),errors=[];
try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__guideStarts=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.addEventListener('playing',()=>window.__guideStarts.push({url:this.src,time:this.currentTime,at:performance.now()}),{once:true});return play.call(this);};});
  await p.goto('http://127.0.0.1:5178');await p.waitForFunction(()=>!!window.__townSnapshot);
  assert.equal(await p.locator('.course-card.current').count(),1);assert.equal(await p.locator('.course-card.current').getAttribute('data-level'),'0');assert.equal(await p.locator('.course-card.current').getAttribute('aria-current'),'step');
  await p.locator('[data-level="8"]').click();await p.waitForFunction(()=>window.__guideStarts.length===1);await p.waitForTimeout(700);
  await p.locator('.scene-header [data-action="speak"]').click();await p.waitForFunction(()=>window.__guideStarts.length===2);
  let starts=await p.evaluate(()=>window.__guideStarts);assert.ok(starts[1].time<0.4);assert.ok(starts.every(s=>s.url.endsWith('/guide-duck-first.mp3')));
  await click(p,'hint');assert.equal(await p.locator('.guide-replay').count(),1);await p.locator('.guide-replay').click();await p.waitForFunction(()=>window.__guideStarts.length===3);starts=await p.evaluate(()=>window.__guideStarts);assert.ok(starts[2].time<0.4);assert.equal(await p.locator('[role="dialog"]').count(),1);
  await click(p,'modal-close');await click(p,'levels');assert.equal(await p.locator('.course-card.current').getAttribute('data-level'),'8');assert.equal(await p.locator('.course-current').innerText(),'当前关卡');assert.equal(await p.locator('.course-card.current').evaluate(e=>getComputedStyle(e).outlineWidth),'3px');
  await p.screenshot({path:'screenshots/当前关卡高亮.png',fullPage:true});
  await click(p,'course-pair');await p.locator('[data-level="14"]').click();await click(p,'levels');assert.equal(await p.locator('.course-card.current').getAttribute('data-level'),'14');assert.equal(await p.locator('.course-card.current').count(),1);
  await click(p,'continue-level');for(const width of [320,360,390,768]){await p.setViewportSize({width,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);assert.equal(await p.locator('.scene-header [data-action="speak"]').isVisible(),true);}
  assert.deepEqual(errors,[]);const report={version:JSON.parse(fs.readFileSync('package.json','utf8')).version,result:'PASS',currentCourseOutlinedInSoloAndPairLists:true,replayOnSceneAndDescription:true,restartsGuideFromBeginning:true,noPhoneOrTabletOverflow:true,runtimeErrors:errors};fs.writeFileSync('开发资料/测试报告/关卡说明重播与高亮检查.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
