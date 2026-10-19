import {test} from 'node:test';
import assert from 'node:assert/strict';
import {narratedSteps} from '../src/narration';
import {ACTORS,STATIONS,freshWorld,freshProgress,tick,recipe,packSave,readSave,validateCommands,enabledActors,applyProgramEdit,type Command,type ActorId,type Actor} from '../src/model';
function setup(){const world=freshWorld(),progress=freshProgress();progress.creative=true;return {world,progress};}
const advance=(w:ReturnType<typeof freshWorld>,p:ReturnType<typeof freshProgress>,n:number)=>{for(let i=0;i<n;i++)tick(w,p);};
test('a direction-only program collects and deposits automatically',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=recipe('rabbit');
  tick(world,progress);assert.equal(a.carrying,null);assert.equal(a.x,STATIONS.farm.x);assert.equal(a.current,-1);assert.equal(a.startPending,false);
  advance(world,progress,3);assert.deepEqual({x:a.x,y:a.y},STATIONS.store);assert.equal(world.stats.deposited,1);assert.equal(a.carrying,null);
});
test('the whole program resets to home after the final action, then loops',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=recipe('rabbit');
  advance(world,progress,4);assert.equal(a.x,STATIONS.store.x);const stock=world.carrots;
  const events=tick(world,progress);assert.deepEqual({x:a.x,y:a.y},STATIONS.farm);assert.equal(a.current,-1);assert.equal(a.cycles,1);assert.equal(world.carrots,stock);assert.ok(events.some(e=>e.kind==='reset'));
  advance(world,progress,5);assert.equal(world.stats.deposited,2);assert.equal(a.cycles,2);
});
test('unfinished cargo is preserved when a short program resets',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=[{type:'move',direction:'right'}];
  advance(world,progress,3);assert.deepEqual({x:a.x,y:a.y},STATIONS.farm);assert.equal(a.carrying,'carrot');assert.equal(world.stats.harvested,1);
  advance(world,progress,10);assert.equal(world.stats.harvested,1);assert.equal(a.carrying,'carrot');
});
test('three direction-only programs keep a supply chain running',()=>{
  const {world,progress}=setup();for(const id of ['rabbit','bear','duck'] as ActorId[])world.actors[id].program=recipe(id);
  advance(world,progress,150);assert.ok(world.stats.served>=25);assert.ok(world.stats.harvested>=world.stats.cooked);assert.ok(world.stats.cooked>=world.stats.served);
  for(const a of Object.values(world.actors))assert.notEqual(a.status,'blocked');
});
test('missing resources hold the actor before its first movement and resume once',()=>{
  const {world,progress}=setup(),a=world.actors.bear;a.program=recipe('bear');
  advance(world,progress,4);assert.equal(a.status,'waiting');assert.deepEqual({x:a.x,y:a.y},STATIONS.store);assert.equal(a.current,-1);
  world.carrots=1;tick(world,progress);assert.equal(a.carrying,'carrot');assert.equal(world.carrots,0);
  advance(world,progress,2);assert.deepEqual({x:a.x,y:a.y},STATIONS.kitchen);assert.equal(world.stats.cooked,1);assert.equal(world.meals,1);
});
test('automatic actions happen only for the matching profession',()=>{
  const {world,progress}=setup(),rabbit=world.actors.rabbit;Object.assign(rabbit,STATIONS.kitchen);rabbit.program=[{type:'wait'}];rabbit.carrying='carrot';
  tick(world,progress);assert.equal(world.stats.cooked,0);assert.equal(rabbit.carrying,'carrot');
  const bear=world.actors.bear;Object.assign(bear,STATIONS.farm);bear.program=[{type:'wait'}];bear.needsWork=true;
  tick(world,progress);assert.equal(bear.carrying,null);assert.equal(world.stats.harvested,0);
});
test('waiting on a station cannot repeatedly take or deposit an item',()=>{
  const {world,progress}=setup();world.carrots=3;const a=world.actors.bear;a.program=[{type:'wait'},{type:'wait'},{type:'wait'}];
  advance(world,progress,4);assert.equal(world.carrots,2);assert.equal(a.carrying,'carrot');assert.equal(world.stats.cooked,0);
});
test('a blocked actor does not stop another actor',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.x=0;a.needsWork=false;a.startPending=false;a.program=[{type:'move',direction:'left'}];
  world.carrots=1;world.actors.bear.program=recipe('bear');advance(world,progress,2);assert.equal(a.status,'blocked');assert.equal(world.actors.bear.y,3);
});
test('nested repetition does not reset between its primitive steps',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=[{type:'repeat',count:3,body:[{type:'move',direction:'right'}]}];
  tick(world,progress);advance(world,progress,2);assert.equal(a.x,3);assert.equal(a.cycles,0);tick(world,progress);assert.equal(a.x,4);assert.equal(a.current,0);assert.equal(world.stats.repeats,1);
  tick(world,progress);assert.equal(a.x,1);assert.equal(a.cycles,1);
});
test('conditional branches inspect the shared state',()=>{
  for(const stock of [0,1]){const {world,progress}=setup(),a=world.actors.rabbit;a.x=3;a.y=3;a.needsWork=false;a.startPending=false;world.carrots=stock;
    a.program=[{type:'if',condition:'carrots',body:[{type:'move',direction:'right'}],otherwise:[{type:'move',direction:'left'}]}];
    tick(world,progress);assert.equal(a.x,stock?4:2);assert.equal(world.stats.conditions,1);}
});
test('a reusable action can contain repetition and resets only at its parent program end',()=>{
  const {world,progress}=setup();progress.actions=[{id:'go',name:'去仓库',body:recipe('rabbit',true)}];const a=world.actors.rabbit;a.program=[{type:'call',actionId:'go'},{type:'wait'}];
  advance(world,progress,4);assert.equal(a.x,4);assert.equal(a.cycles,0);tick(world,progress);assert.equal(a.x,4);tick(world,progress);assert.equal(a.x,1);assert.equal(world.stats.calls,1);
});
test('recursive actions cannot freeze an actor or the scheduler',()=>{
  const {world,progress}=setup();progress.actions=[{id:'loop',name:'loop',body:[{type:'call',actionId:'loop'}]}];world.actors.rabbit.program=[{type:'call',actionId:'loop'}];
  tick(world,progress);tick(world,progress);assert.equal(world.actors.rabbit.status,'blocked');assert.ok(world.actors.rabbit.frames.length<=10);
});
test('save and restore preserves nested cursors, held items and pending automatic work',()=>{
  const {world,progress}=setup();for(const id of ['rabbit','bear','duck'] as ActorId[])world.actors[id].program=recipe(id,true);
  advance(world,progress,8);const loaded=readSave(JSON.stringify(packSave(world,progress)));assert.ok(loaded);
  advance(world,progress,50);advance(loaded.world,loaded.progress,50);assert.deepEqual(loaded.world,world);
});
test('v1 saves migrate manual example routes, keep inventory and strip manual work',()=>{
  const {world,progress}=setup();world.carrots=4;world.meals=2;world.stats.served=7;
  const old=JSON.parse(JSON.stringify({version:1,world,progress,savedAt:123}));
  for(const id of ['rabbit','bear'] as ActorId[])old.world.actors[id].program=[{type:'interact'},...['right','right','right'].map(direction=>({type:'move',direction})),{type:'interact'},...['left','left','left'].map(direction=>({type:'move',direction}))];
  old.world.actors.duck.x=9;old.world.actors.duck.y=5;old.world.actors.duck.program=[{type:'interact'},...['right','right','down'].map(direction=>({type:'move',direction})),{type:'interact'},...['up','left','left'].map(direction=>({type:'move',direction}))];
  const save=readSave(JSON.stringify(old));assert.ok(save);assert.equal(save.version,2);assert.equal(save.world.carrots,4);assert.equal(save.world.stats.served,7);
  for(const def of ACTORS){const a:Actor=save.world.actors[def.id];assert.deepEqual(a.program,def.id==='fox'?[]:recipe(def.id));assert.deepEqual({x:a.x,y:a.y},def.home);}
});
test('bad saves and obsolete manual commands are rejected in the new schema',()=>{
  assert.equal(readSave('{bad'),null);const {world,progress}=setup(),save=packSave(world,progress);save.world.actors.rabbit.x=99;assert.equal(readSave(JSON.stringify(save)),null);
  assert.equal(validateCommands([{type:'interact'}]),false);assert.equal(validateCommands([{type:'repeat',count:999,body:[]}]),false);assert.equal(validateCommands(Array.from({length:49},()=>({type:'wait'}))),false);
});
test('v1 compact example routes migrate to the new profession direction',()=>{
  const {world,progress}=setup();
  const old=JSON.parse(JSON.stringify({version:1,world,progress,savedAt:123}));
  old.world.actors.bear.program=[{type:'interact'},{type:'repeat',count:3,body:[{type:'move',direction:'right'}]},{type:'interact'},{type:'repeat',count:3,body:[{type:'move',direction:'left'}]}];
  const save=readSave(JSON.stringify(old));assert.ok(save);assert.deepEqual(save.world.actors.bear.program,recipe('bear',true));
});
test('unintroduced roles stay idle',()=>{
  const world=freshWorld(),progress=freshProgress();world.carrots=1;world.actors.bear.program=recipe('bear');tick(world,progress);assert.equal(world.actors.bear.carrying,null);assert.deepEqual(enabledActors(progress),['rabbit']);
  progress.level=12;advance(world,progress,2);assert.equal(world.actors.bear.carrying,'carrot');
});
test('10,000 ticks conserve every carrot and meal across all resets',()=>{
  const {world,progress}=setup();for(const id of ['rabbit','bear','duck'] as ActorId[])world.actors[id].program=recipe(id,true);advance(world,progress,10000);
  assert.ok(world.stats.served>1500);assert.ok(world.carrots>=0&&world.meals>=0&&world.crop>=0&&world.crop<=6);
  assert.equal(world.stats.harvested,world.carrots+world.stats.cooked+Object.values(world.actors).filter(a=>a.carrying==='carrot').length);
  assert.equal(world.stats.cooked,world.meals+world.stats.served+Object.values(world.actors).filter(a=>a.carrying==='meal').length);
});

test('editing a running program resets its position and executes the new first command',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=recipe('rabbit');advance(world,progress,3);
  const stats=structuredClone(world.stats),cargo=a.carrying;
  applyProgramEdit(a,[{type:'move',direction:'down'},{type:'move',direction:'right'}]);
  assert.deepEqual({x:a.x,y:a.y},STATIONS.farm);assert.equal(a.current,-1);assert.deepEqual(a.frames,[]);assert.equal(a.needsWork,true);
  assert.equal(a.carrying,cargo);assert.deepEqual(world.stats,stats);
  tick(world,progress);assert.equal(a.current,-1);assert.equal(a.y,2);
  tick(world,progress);assert.equal(a.x,1);assert.equal(a.y,3);assert.equal(a.current,0);
});
test('deleting a command restarts the shortened program from its first instruction',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=recipe('rabbit');advance(world,progress,3);
  applyProgramEdit(a,a.program.slice(1));assert.equal(a.x,1);assert.equal(a.current,-1);
  tick(world,progress);assert.equal(a.current,-1);tick(world,progress);assert.equal(a.x,2);assert.equal(a.current,0);assert.equal(a.cycles,0);
});
test('sorting a running repeat discards its old stack and follows the new order',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;
  a.program=[{type:'repeat',count:3,body:[{type:'move',direction:'right'}]},{type:'wait'}];advance(world,progress,2);
  assert.equal(a.frames.length,2);applyProgramEdit(a,[a.program[1],a.program[0]]);assert.deepEqual(a.frames,[]);assert.equal(a.x,1);
  tick(world,progress);assert.equal(a.current,-1);
  tick(world,progress);assert.equal(a.x,1);assert.equal(a.current,0);
  tick(world,progress);assert.equal(a.x,2);assert.equal(a.current,1);assert.equal(world.stats.repeats,2);
});
test('replacing a nested command starts its new body at home',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;
  a.program=[{type:'repeat',count:3,body:[{type:'move',direction:'right'}]}];advance(world,progress,3);
  applyProgramEdit(a,[{type:'repeat',count:2,body:[{type:'move',direction:'down'}]},{type:'move',direction:'right'}]);
  assert.equal(a.x,1);assert.equal(a.y,2);advance(world,progress,4);
  assert.equal(a.x,2);assert.equal(a.y,4);assert.equal(a.current,1);
});
test('undo restarts the restored program and its reset state round-trips through saves',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=recipe('rabbit');advance(world,progress,3);
  const previous=structuredClone(a.program);applyProgramEdit(a,[{type:'move',direction:'up'}]);advance(world,progress,2);assert.equal(a.y,1);
  applyProgramEdit(a,previous);assert.equal(a.x,1);assert.equal(a.y,2);assert.equal(a.current,-1);
  const saved=readSave(JSON.stringify(packSave(world,progress)))!;assert.ok(saved);
  advance(world,progress,2);advance(saved.world,saved.progress,2);assert.equal(a.x,2);assert.equal(a.current,0);assert.deepEqual(saved.world,world);
});
test('clearing a program resets only that actor and conserves cargo, stock and results',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=recipe('rabbit');world.carrots=2;world.actors.bear.program=recipe('bear');advance(world,progress,3);
  const other=structuredClone(world.actors.bear),stats=structuredClone(world.stats),stock=world.carrots,cargo=a.carrying;
  applyProgramEdit(a,[]);assert.equal(a.x,1);assert.equal(a.y,2);assert.equal(a.current,-1);assert.equal(a.carrying,cargo);
  assert.deepEqual(world.actors.bear,other);assert.deepEqual(world.stats,stats);assert.equal(world.carrots,stock);
  tick(world,progress);assert.equal(a.status,'idle');assert.equal(world.actors.bear.y,5);assert.equal(world.stats.cooked,1);
});
test('start is a separate step before commands and at every loop boundary',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=recipe('rabbit');
  for(const [index,x] of [[-1,1],[0,2],[1,3],[2,4],[-1,1],[0,2]]) {
    const events=tick(world,progress);
    assert.equal(a.x,x);assert.equal(a.current,index);assert.equal(events.filter(e=>e.actor==='rabbit'&&e.kind==='move').length,index<0?0:1);
  }
  assert.equal(a.cycles,1);assert.equal(world.stats.deposited,1);assert.equal(world.stats.harvested,2);
});
test('a repeat advances one body instruction per step and highlights its root',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;
  a.program=[{type:'repeat',count:3,body:[{type:'move',direction:'right'}]},{type:'wait'}];
  tick(world,progress);assert.equal(a.current,-1);
  for(const x of [2,3,4]) {tick(world,progress);assert.equal(a.x,x);assert.equal(a.current,0);}
  tick(world,progress);assert.equal(a.x,4);assert.equal(a.current,1);
});
test('step mode waits for supplies and advances all independent actors once',()=>{
  const {world,progress}=setup();ACTORS.forEach(a=>world.actors[a.id].program=recipe(a.id));
  tick(world,progress);assert.equal(world.actors.rabbit.current,-1);
  tick(world,progress);assert.equal(world.actors.rabbit.x,2);assert.equal(world.actors.bear.y,2);assert.equal(world.actors.duck.x,4);
  advance(world,progress,0);
  tick(world,progress);tick(world,progress);
  assert.equal(world.actors.rabbit.x,4);assert.equal(world.actors.bear.y,3);assert.equal(world.actors.duck.x,4);
});

test('the initial start step resets coordinates before collecting or executing a command',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=recipe('rabbit');a.x=5;a.y=4;
  const events=tick(world,progress);assert.deepEqual({x:a.x,y:a.y},STATIONS.farm);assert.equal(a.current,-1);assert.equal(a.carrying,null);assert.equal(world.stats.harvested,0);assert.ok(events.some(e=>e.kind==='reset'));
  tick(world,progress);assert.equal(a.current,0);assert.equal(a.x,2);assert.equal(a.carrying,'carrot');assert.equal(world.stats.harvested,1);
});
test('v1.2 saves without start-stage metadata remain readable and gain an initial start',()=>{
  const {world,progress}=setup();world.actors.rabbit.program=recipe('rabbit');const old:any=packSave(world,progress);
  for(const a of Object.values(old.world.actors) as any[])delete a.startPending;
  const loaded=readSave(JSON.stringify(old));assert.ok(loaded);assert.equal(loaded.world.actors.rabbit.startPending,true);
  tick(loaded.world,loaded.progress);assert.equal(loaded.world.actors.rabbit.current,-1);assert.equal(loaded.world.actors.rabbit.startPending,false);
});

test('a voice-occupied actor holds its cursor while the other actors keep moving',()=>{
  const {world,progress}=setup();world.carrots=3;for(const def of ACTORS)world.actors[def.id].program=recipe(def.id);
  tick(world,progress);const rabbit=structuredClone(world.actors.rabbit);
  for(let i=0;i<3;i++)tick(world,progress,{skipActors:new Set(['rabbit'])});
  assert.deepEqual(world.actors.rabbit,rabbit);assert.equal(world.actors.bear.y,5);assert.equal(world.stats.cooked,1);
  tick(world,progress);assert.equal(world.actors.rabbit.current,0);assert.equal(world.actors.rabbit.x,2);
});
test('action narration orders collection, movement and depositing with matching visual cargo',()=>{
  const {world,progress}=setup(),a=world.actors.rabbit;a.program=recipe('rabbit');tick(world,progress);
  let before=structuredClone(a),events=tick(world,progress),steps=narratedSteps(events,before,a);
  assert.deepEqual(steps.map(s=>s.voice),['action-collect','action-right']);
  assert.deepEqual(steps[0].presentation,{x:1,y:2,carrying:'carrot'});assert.deepEqual(steps[1].presentation,{x:2,y:2,carrying:'carrot'});
  tick(world,progress);before=structuredClone(a);events=tick(world,progress);steps=narratedSteps(events,before,a);
  assert.deepEqual(steps.map(s=>s.voice),['action-right','action-deposit']);
  assert.deepEqual(steps[0].presentation,{x:4,y:2,carrying:'carrot'});assert.deepEqual(steps[1].presentation,{x:4,y:2,carrying:null});
});
