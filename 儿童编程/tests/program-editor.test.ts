import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commandAt,listAt,parsePath,selectionAfterRemoval,selectionAfterMove,executingPath} from '../src/program-editor';
import {freshWorld,freshProgress,packSave,readSave,tick,type Command} from '../src/model';
const move=(direction:'right'|'left'):Command=>({type:'move',direction});
const program=():Command[]=>[{type:'wait'},{type:'repeat',count:2,body:[move('right'),{type:'repeat',count:2,body:[move('left')]}]}];
test('inline paths address repeat bodies without confusing root or conditional queues',()=>{
  const p=program();assert.equal(commandAt(p,[1,1])?.type,'repeat');assert.equal(commandAt(p,[1,1,0])?.type,'move');
  listAt(p,[1,1])!.push(move('right'));assert.equal(listAt(p)!.length,2);assert.equal(listAt(p,[1])!.length,2);assert.equal(listAt(p,[1,1])!.length,2);
  assert.equal(listAt(p,[0]),undefined);assert.equal(commandAt(p,[1,99]),undefined);assert.equal(commandAt(p,[0,0]),undefined);
  assert.deepEqual(parsePath('1.2.0'),[1,2,0]);for(const invalid of [undefined,'','-1','1.','1.e2'])assert.equal(parsePath(invalid),null);
});
test('deletion preserves the selected frame after sibling indexes move and escapes a deleted ancestor',()=>{
  assert.deepEqual(selectionAfterRemoval([2,3],[1]),[1,3]);assert.deepEqual(selectionAfterRemoval([2,3],[2,1]),[2,2]);
  assert.deepEqual(selectionAfterRemoval([2,3],[2,3]),[2]);assert.equal(selectionAfterRemoval([2,3],[2]),null);
  assert.deepEqual(selectionAfterRemoval([1],[1,0]),[1]);assert.equal(selectionAfterRemoval(null,[0]),null);
});
test('sorting a frame or its siblings follows the same selected frame',()=>{
  assert.deepEqual(selectionAfterMove([1,2],[],1,3),[3,2]);assert.deepEqual(selectionAfterMove([2,1],[],0,3),[1,1]);
  assert.deepEqual(selectionAfterMove([2,1],[],3,0),[3,1]);assert.deepEqual(selectionAfterMove([2,1],[2],1,0),[2,0]);
  assert.deepEqual(selectionAfterMove([2,1],[0],1,0),[2,1]);
});
test('execution highlights the actual child through nested frames, iterations and saved cursors',()=>{
  const w=freshWorld(),p=freshProgress();p.creative=true;w.actors.rabbit.program=program();const a=w.actors.rabbit;a.origin={x:3,y:3};
  tick(w,p);assert.equal(executingPath(a),null);tick(w,p);assert.deepEqual(executingPath(a),[0]);
  tick(w,p);assert.deepEqual(executingPath(a),[1,0]);tick(w,p);assert.deepEqual(executingPath(a),[1,1,0]);
  const restored=readSave(JSON.stringify(packSave(w,p)))!;assert.ok(restored);assert.deepEqual(executingPath(restored.world.actors.rabbit),[1,1,0]);
  tick(w,p);assert.deepEqual(executingPath(a),[1,1,0]);tick(w,p);assert.deepEqual(executingPath(a),[1,0]);
});
test('a blocked child stays highlighted while a conditional child highlights its parent chip',()=>{
  const w=freshWorld(),p=freshProgress();p.creative=true;const a=w.actors.rabbit;
  a.origin={x:5,y:2};a.program=[{type:'repeat',count:3,body:[move('right'),move('right')]}];tick(w,p);tick(w,p);tick(w,p);assert.equal(a.status,'blocked');assert.deepEqual(executingPath(a),[0,1]);
  a.program=[{type:'repeat',count:2,body:[{type:'if',condition:'carrying',body:[move('right')],otherwise:[move('left')]}]}];a.frames=[];a.startPending=true;tick(w,p);tick(w,p);assert.deepEqual(executingPath(a),[0,0]);
});
