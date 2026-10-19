import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ACTORS,CONDITIONS,freshProgress,worldForLevel,tick,levelValue,conditionValue,prepareRetry,applyProgramEdit,packSave,readSave,validateCommands,enabledActors,type Command,type ActorId} from '../src/model';
import {LEVELS,LEGACY_LEVEL_MAP,exampleProgram} from '../src/levels';
import {narratedSteps} from '../src/narration';
import {GRID,STATIONS,MAP_FEATURES,BLOCKED} from '../src/map';
const move=(direction:'right'|'left'|'up'|'down'):Command=>({type:'move',direction});
test('solid map footprints occupy distinct whole cells and all work pads remain enterable',()=>{
  const occupied=new Set<string>();
  for(const f of MAP_FEATURES)for(let dy=0;dy<f.height;dy++)for(let dx=0;dx<f.width;dx++){
    const x=f.x+dx,y=f.y+dy,key=`${x},${y}`;assert.ok(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<GRID.cols&&y>=0&&y<GRID.rows);assert.equal(occupied.has(key),false);occupied.add(key);
  }
  assert.deepEqual([...occupied].sort(),[...BLOCKED].sort());assert.equal(occupied.size,19);
  for(const p of Object.values(STATIONS))assert.equal(occupied.has(`${p.x},${p.y}`),false);
});
test('an old saved position inside newly solid scenery safely resumes at home with its cargo',()=>{
  const w=worldForLevel(0),p=freshProgress(),a=w.actors.rabbit;a.x=5;a.y=5;a.carrying='carrot';a.program=[move('left')];
  const loaded=readSave(JSON.stringify(packSave(w,p)))!;assert.ok(loaded);assert.equal(loaded.world.actors.rabbit.x,1);assert.equal(loaded.world.actors.rabbit.y,2);assert.equal(loaded.world.actors.rabbit.carrying,'carrot');assert.deepEqual(loaded.world.actors.rabbit.program,[move('left')]);assert.equal(loaded.world.actors.rabbit.startPending,true);
});
function course(index:number){const p=freshProgress();p.level=index;p.selected=LEVELS[index].roles[0].id;const w=worldForLevel(index);for(const r of LEVELS[index].roles)w.actors[r.id].program=exampleProgram(index,r.id);return {w,p};}
test('the catalogue contains 20 solo courses and 10 meaningful pair courses',()=>{
  assert.equal(LEVELS.length,30);assert.equal(LEVELS.filter(l=>l.roles.length===1).length,20);assert.equal(new Set(LEVELS.map(l=>l.id)).size,30);
  for(const id of ['rabbit','bear','duck'])assert.equal(LEVELS.filter(l=>l.roles.length===1&&l.roles[0].id===id).length,6);
  assert.equal(LEVELS.filter(l=>l.roles.length===1&&l.roles[0].id==='fox').length,2);
});
for(const [index,l] of LEVELS.entries())test(`course ${index+1}: ${l.title} can be solved without failure or inactive actors moving`,()=>{
  const {w,p}=course(index),inactive=ACTORS.filter(a=>!enabledActors(p).includes(a.id)),before=inactive.map(a=>structuredClone(w.actors[a.id]));
  const failures=[];
  for(let i=0;i<180&&levelValue(w,index)<l.goal;i++)failures.push(...tick(w,p).filter(e=>e.kind==='failure'||e.kind==='blocked'));
  assert.equal(levelValue(w,index)>=l.goal,true,JSON.stringify(w));assert.deepEqual(failures,[]);
  inactive.forEach((a,i)=>assert.deepEqual(w.actors[a.id],before[i]));
  const successes=structuredClone(w.successes);for(let i=0;i<20;i++)assert.deepEqual(tick(w,p),[]);assert.deepEqual(w.successes,successes);
});
test('a short program fails at its endpoint, narrates failure before reset, and awards no progress',()=>{
  const {w,p}=course(0),a=w.actors.rabbit;a.program=[move('right')];tick(w,p);tick(w,p);const before=structuredClone(a),events=tick(w,p);
  assert.deepEqual(events.map(e=>e.kind),['failure','reset']);assert.equal(events[0].message,'未到达目的地，任务失败了');assert.equal(levelValue(w,0),0);
  const narration=narratedSteps(events,before,a);assert.deepEqual(narration.map(s=>s.voice),['action-failure','action-start']);
  assert.equal(narration[0].presentation.x,2);assert.equal(narration[1].presentation.x,1);
});
test('passing the destination and then leaving is not a successful program',()=>{
  const {w,p}=course(0),a=w.actors.rabbit;a.program.push(move('right'));
  for(let i=0;i<5;i++)tick(w,p);assert.equal(w.stats.deposited,1);assert.equal(a.x,5);assert.equal(levelValue(w,0),0);
  const events=tick(w,p);assert.equal(events[0].kind,'failure');assert.equal(levelValue(w,0),0);
});
test('success is counted at root completion, after work and the final command',()=>{
  const {w,p}=course(0);for(let i=0;i<4;i++)tick(w,p);assert.equal(w.stats.deposited,1);assert.equal(levelValue(w,0),0);
  assert.equal(tick(w,p)[0].kind,'complete');assert.equal(levelValue(w,0),1);
});
test('editing an exhausted two-round course restores enough supplies for the whole retry',()=>{
  const {w,p}=course(7);for(let i=0;i<25;i++)tick(w,p);assert.equal(w.carrots,0);assert.equal(w.successes.bear,2);p.completed=[7];
  prepareRetry(w,p,'bear');applyProgramEdit(w.actors.bear,exampleProgram(7,'bear'));assert.equal(w.carrots,2);assert.equal(w.successes.bear,0);
  for(let i=0;i<25;i++)tick(w,p);assert.equal(w.successes.bear,2);assert.deepEqual(p.completed,[7]);
});
test('prepared cargo and course origins survive an edit and save/restore',()=>{
  const {w,p}=course(9);w.actors.duck.carrying=null;prepareRetry(w,p,'duck');applyProgramEdit(w.actors.duck,exampleProgram(9,'duck'));
  assert.equal(w.actors.duck.carrying,'meal');assert.deepEqual({x:w.actors.duck.x,y:w.actors.duck.y},{x:3,y:5});
  p.programs[LEVELS[9].id]={duck:exampleProgram(9,'duck')};const save=readSave(JSON.stringify(packSave(w,p)))!;assert.ok(save);
  assert.deepEqual(save.world.actors.duck.origin,{x:3,y:5});assert.deepEqual(save.progress.programs,p.programs);
});
test('all 24 IF conditions are valid, with directions following the actor and current terrain',()=>{
  const {w}=course(2),a=w.actors.rabbit;assert.equal(CONDITIONS.length,24);
  for(const c of CONDITIONS)assert.equal(validateCommands([{type:'if',condition:c.id,body:[move('right')],otherwise:[{type:'wait'}]}]),true);
  for(const [c,origin,delta] of [['right-clear',{x:2,y:3},{x:3,y:3}],['left-clear',{x:2,y:3},{x:1,y:3}],['up-clear',{x:2,y:3},{x:2,y:2}],['down-clear',{x:2,y:3},{x:2,y:4}]] as const){
    Object.assign(a,origin);w.barriers=[];assert.equal(conditionValue(c,a,w),true);w.barriers=[delta];assert.equal(conditionValue(c,a,w),false);
  }
  w.barriers=[];Object.assign(a,{x:0,y:2});assert.equal(conditionValue('left-clear',a,w),false);Object.assign(a,{x:1,y:0});assert.equal(conditionValue('left-clear',a,w),false);
  Object.assign(a,{x:2,y:3});a.target={x:4,y:5};for(const c of ['target-right','target-down'] as const)assert.equal(conditionValue(c,a,w),true);
  for(const c of ['target-left','target-up','target-row','target-column','at-target','at-home'] as const)assert.equal(conditionValue(c,a,w),false);
  Object.assign(a,{x:5,y:6});assert.equal(conditionValue('target-left',a,w),true);assert.equal(conditionValue('target-up',a,w),true);
  Object.assign(a,a.target);for(const c of ['at-target','target-row','target-column'] as const)assert.equal(conditionValue(c,a,w),true);
  for(const c of ['target-right','target-down','target-left','target-up'] as const)assert.equal(conditionValue(c,a,w),false);
  Object.assign(a,a.origin);assert.equal(conditionValue('at-home',a,w),true);
  for(const cargo of [null,'carrot','meal'] as const){a.carrying=cargo;assert.equal(conditionValue('empty',a,w),!cargo);assert.equal(conditionValue('carrying',a,w),!!cargo);assert.equal(conditionValue('has-carrot',a,w),cargo==='carrot');assert.equal(conditionValue('has-meal',a,w),cargo==='meal');}
  for(const stock of [0,2]){w.carrots=w.meals=stock;assert.equal(conditionValue('carrots',a,w),stock>0);assert.equal(conditionValue('meals',a,w),stock>0);}
  assert.equal(validateCommands([{type:'if',condition:'unknown',body:[],otherwise:[]}]),false);
});
test('v1.3 course saves migrate old stars, inventory and all actor programs',()=>{
  for(let index=0;index<7;index++){
    const {w,p}=course(0);p.level=index;p.completed=[0,2,6];p.selected='duck';w.carrots=4;w.meals=3;
    for(const a of ACTORS)w.actors[a.id].program=[move('down')];const raw:any=packSave(w,p);
    delete raw.progress.levelSet;delete raw.progress.programs;delete raw.world.successes;delete raw.world.barriers;
    for(const a of Object.values(raw.world.actors) as any[]){delete a.origin;delete a.target;delete a.roundWork;}
    const loaded=readSave(JSON.stringify(raw))!;assert.ok(loaded);assert.equal(loaded.progress.level,LEGACY_LEVEL_MAP[index]);assert.deepEqual(loaded.progress.completed,[0,12,7]);
    assert.equal(loaded.world.carrots,4);assert.equal(loaded.world.meals,3);
    for(const a of ACTORS)assert.deepEqual(loaded.progress.programs.creative?.[a.id],[move('down')]);
    assert.equal(enabledActors(loaded.progress).includes(loaded.progress.selected),true);
  }
});
