import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,exampleProgram} from '../src/levels';
import {freshProgress,worldForLevel,tick,levelValue,isWalkable,isTerrainWalkable,countCommands,programIssue,packSave,readSave,conditionValue,type ActorId,type Command} from '../src/model';
import {narratedSteps} from '../src/narration';
const move=(direction:'right'|'down'|'left'|'up'):Command=>({type:'move',direction});
function setup(index:number,seed=1){const p=freshProgress();p.level=index;p.selected=LEVELS[index].roles[0].id;const w=worldForLevel(index,{},seed);for(const r of LEVELS[index].roles)w.actors[r.id].program=exampleProgram(index,r.id);return {w,p};}
function distance(index:number){const {w}=setup(index),a=w.actors[LEVELS[index].roles[0].id],queue=[{...a.origin,d:0}],seen=new Set<string>();for(let i=0;i<queue.length;i++){const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key))continue;seen.add(key);if(p.x===a.target.x&&p.y===a.target.y)return p.d;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(isTerrainWalkable(w,p.x+dx,p.y+dy))queue.push({x:p.x+dx,y:p.y+dy,d:p.d+1});}return Infinity;}
for(const [index,steps] of [[18,24],[19,8],[20,36]] as const)test(`${LEVELS[index].title}: the actual shortest route needs ${steps} moves but the repeated solution fits the visible budget`,()=>{
  const {w}=setup(index),a=w.actors[LEVELS[index].roles[0].id];assert.equal(distance(index),steps);assert.ok(steps>w.commandLimit!);assert.ok(countCommands(a.program)<=w.commandLimit!);assert.equal(programIssue(a,w),null);a.program=LEVELS[index].roles[0].route.map(direction=>({type:'move',direction}));assert.equal(programIssue(a,w),'limit');
});
for(const index of [17,21,22,23,29])test(`${LEVELS[index].title}: conditional solutions work across 64 different moving-obstacle schedules`,()=>{
  for(let seed=1;seed<=64;seed++){
    const {w,p}=setup(index,seed),bad=[];for(let i=0;i<220&&levelValue(w,index)<LEVELS[index].goal;i++)bad.push(...tick(w,p).filter(e=>e.kind==='failure'||e.kind==='blocked'||e.kind==='lesson'));
    assert.equal(levelValue(w,index)>=LEVELS[index].goal,true,`seed ${seed}`);assert.deepEqual(bad,[],`seed ${seed}`);
  }
});
test('fixed directions really collide for some phases even without the lesson requirement, while IF observes the current gate',()=>{
  let failures=0;
  for(let seed=1;seed<=32;seed++){const {w,p}=setup(21,seed),a=w.actors.rabbit;a.required=null;w.commandLimit=null;a.program=[move('right'),move('right'),move('right')];for(let i=0;i<10&&a.cycles<1;i++)failures+=tick(w,p).filter(e=>e.kind==='failure').length;}
  assert.ok(failures>=8,'several different initial schedules defeat a fixed move sequence');
});
test('a speaking driver holds the moving obstacle clock, and a cart never enters an occupied cell',()=>{
  const {w,p}=setup(21),gate=w.gates[0],before=structuredClone(gate);tick(w,p,{skipActors:new Set(['rabbit'])});assert.deepEqual(gate,before);
  gate.index=1;gate.remaining=1;Object.assign(w.actors.rabbit,gate.positions[0]);w.actors.rabbit.startPending=false;w.actors.rabbit.required=null;w.actors.rabbit.program=[{type:'wait'}];tick(w,p);assert.equal(gate.index,1);assert.equal(gate.remaining,1);
});
for(const index of [16,17,26,27,28,29])test(`${LEVELS[index].title}: removing the supplier or guard stops the partner from completing`,()=>{
  const {w,p}=setup(index),supplier:ActorId=index===16||index===17?'rabbit':index===29?'bear':'fox',dependent=LEVELS[index].roles.find(r=>r.id!==supplier)!.id;
  w.actors[supplier].program=[];for(let i=0;i<50;i++)tick(w,p);assert.equal(w.successes[dependent],0);assert.equal(levelValue(w,index),0);
  w.actors[supplier].program=exampleProgram(index,supplier);for(let i=0;i<220&&levelValue(w,index)<LEVELS[index].goal;i++)tick(w,p);assert.ok(levelValue(w,index)>=LEVELS[index].goal);
});
test('the delivery duck takes carrots produced by the rabbit, with accurate cargo narration and inventory',()=>{
  const {w,p}=setup(16),a=w.actors.duck;let take=false,serve=false;
  for(let i=0;i<60&&levelValue(w,16)<2;i++){const before=structuredClone(a),events=tick(w,p),steps=narratedSteps(events,before,a);if(events.some(e=>e.actor==='duck'&&e.kind==='take')){take=true;assert.ok(steps.some(s=>s.voice==='action-take-carrot'&&s.presentation.carrying==='carrot'));}if(events.some(e=>e.actor==='duck'&&e.kind==='serve')){serve=true;assert.ok(steps.some(s=>s.voice==='action-deliver-carrot'));}}
  assert.ok(take&&serve);assert.equal(w.stats.deliveredCarrots,2);assert.equal(w.stats.served,0);assert.equal(w.stats.cooked,0);assert.equal(w.stats.harvested,w.carrots+w.stats.deliveredCarrots+Object.values(w.actors).filter(a=>a.carrying==='carrot').length);
});
test('only the guard may enter a monster cell; attacks happen automatically on that exact cell, once',()=>{
  const {w,p}=setup(24),monster=w.monsters[0];assert.equal(isWalkable(w,monster.x,monster.y,'fox'),true);assert.equal(isWalkable(w,monster.x,monster.y,'rabbit'),false);
  const fox=w.actors.fox;Object.assign(fox,{x:monster.x-1,y:monster.y});assert.equal(conditionValue('monster-right',fox,w),true);
  let attacks=0;for(let i=0;i<20&&levelValue(w,24)<1;i++){const before=structuredClone(fox),events=tick(w,p);for(const event of events.filter(e=>e.kind==='attack')){attacks++;assert.deepEqual(event.position,{x:fox.x,y:fox.y});assert.ok(narratedSteps([event],before,fox).some(s=>s.voice==='action-attack'));}}
  assert.equal(attacks,2);assert.equal(w.stats.defeated,2);assert.ok(w.monsters.every(m=>!m.alive));assert.equal(isWalkable(w,monster.x,monster.y,'rabbit'),true);
  for(let i=0;i<10;i++)tick(w,p);assert.equal(w.stats.defeated,2);
});
test('moving gates, long maps, remaining monsters and nested program cursors survive save/restore',()=>{
  for(const index of [20,22,25]){const {w,p}=setup(index);for(let i=0;i<7;i++)tick(w,p);const loaded=readSave(JSON.stringify(packSave(w,p)))!;assert.ok(loaded);assert.deepEqual(loaded.world.gates,w.gates);assert.deepEqual(loaded.world.monsters,w.monsters);assert.deepEqual(loaded.world.board,w.board);for(let i=0;i<80;i++){tick(w,p);tick(loaded.world,loaded.progress);}assert.deepEqual(loaded.world,w);}
});
test('a guard narration holds the monster cell closed until its matching visual attack begins',()=>{
  const {w,p}=setup(26);for(let i=0;i<3;i++)tick(w,p,{narrateActor:'fox'});assert.equal(w.monsters[0].alive,false);assert.equal(w.monsters[0].pendingBy,'fox');assert.equal(w.actors.rabbit.x,1);assert.equal(conditionValue('monster-right',w.actors.rabbit,w),true);
  for(let i=0;i<2;i++)tick(w,p,{skipActors:new Set(['fox'])});assert.equal(w.actors.rabbit.x,1);delete w.monsters[0].pendingBy;tick(w,p,{skipActors:new Set(['fox'])});assert.equal(w.actors.rabbit.x,2);assert.equal(w.stats.defeated,1);
});
test('v1.5 saves gain the guard without losing the three old programs or inventory',()=>{
  const {w,p}=setup(0);w.carrots=5;p.completed=[0,16,17];const raw:any=packSave(w,p);delete raw.world.actors.fox;delete raw.world.successes.fox;delete raw.progress.courseRevision;for(const key of ['board','sites','gates','monsters','seed','commandLimit','participants'])delete raw.world[key];delete raw.world.stats.defeated;delete raw.world.stats.deliveredCarrots;
  for(const a of Object.values(raw.world.actors) as any[])for(const key of ['pickup','delivery','required','usedRepeat','usedIf'])delete a[key];
  const loaded=readSave(JSON.stringify(raw))!;assert.ok(loaded);assert.equal(loaded.world.carrots,5);assert.deepEqual(loaded.world.actors.rabbit.program,w.actors.rabbit.program);assert.deepEqual(loaded.world.actors.fox.program,[]);assert.deepEqual(loaded.progress.completed,[0]);
});
