const test = require('node:test');
const assert = require('node:assert/strict');
const { create, validate } = require('../app/src/main/assets/www/model.js');
const chars = ['一','二','三','人','山'];
test('same-round toggle can never inflate cumulative count',()=>{
  const s=create(null,chars);
  assert.equal(s.toggle('一'),true);assert.equal(s.count('一'),1);
  assert.equal(s.toggle('一'),false);assert.equal(s.count('一'),0);
  for(let i=0;i<51;i++)s.toggle('二');
  assert.equal(s.count('二'),1);assert.equal(s.knownCount(),1);
});
test('new round keeps historical counts and clears current markers',()=>{
  const s=create(null,chars);s.toggle('一');s.toggle('二');s.nextRound();
  assert.equal(s.current().id,2);assert.equal(s.knownCount(),0);assert.equal(s.count('一'),1);
  s.toggle('一');assert.equal(s.count('一'),2);s.toggle('一');assert.equal(s.count('一'),1);
  assert.equal(s.everCount(),2);assert.equal(s.rounds()[0].count,2);
});
test('saved snapshot and import restore all rounds, settings, and exact current states',()=>{
  const s=create(null,chars);s.toggle('人');s.nextRound();s.toggle('山');s.setOption('heat',true);s.setOption('learnGroup',35);
  const saved=JSON.parse(JSON.stringify(s.snapshot()));const restored=create(saved,chars);
  assert.deepEqual(restored.snapshot(),saved);assert.equal(restored.count('人'),1);assert.equal(restored.known('人'),false);assert.equal(restored.known('山'),true);assert.equal(restored.options().heat,true);
  restored.toggle('山');assert.equal(restored.count('山'),0);assert.equal(s.known('山'),true);
});
test('invalid, duplicate, foreign-character, and incomplete backups are rejected without mutation',()=>{
  const s=create(null,chars);s.toggle('一');const before=s.snapshot();
  for(const bad of [null,{}, {...before,schema:9},{...before,rounds:[]},{...before,rounds:[{...before.rounds[0],known:['一','一']}]},{...before,rounds:[{...before.rounds[0],known:['外']}]},{...before,rounds:[{...before.rounds[0],endedAt:'2026-01-01'}]}]){
    assert.throws(()=>validate(bad,new Set(chars)));assert.throws(()=>s.replace(bad));assert.deepEqual(s.snapshot(),before);
  }
});
test('history has one contribution per round even after repeated reloads',()=>{
  let s=create(null,chars);for(let i=0;i<20;i++){s.toggle('人');s=create(s.snapshot(),chars);if(i<19)s.nextRound();}
  assert.equal(s.count('人'),20);assert.equal(s.rounds().length,20);assert.equal(s.knownCount(),1);
});
