const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../app/src/main/assets/www/model.js');
const data=[{char:'一',strokes:1,order:0},{char:'乙',strokes:1,order:1},{char:'二',strokes:2,order:2},{char:'十',strokes:2,order:3},{char:'人',strokes:2,order:4},{char:'入',strokes:2,order:5},{char:'八',strokes:2,order:6},{char:'山',strokes:3,order:7}];
const make=()=>create(null,data.map(d=>d.char));
test('old backups get safe defaults without losing recognized characters',()=>{
 const s=make();s.toggle('一');const old=s.snapshot();delete old.options.learnSkipEnabled;delete old.options.learnSkipCount;
 const n=create(old,data.map(d=>d.char));assert.equal(n.count('一'),1);assert.equal(n.options().learnSkipCount,1);assert.equal(n.options().learnSkipEnabled,false);
});
test('threshold 1 excludes characters recognized at least once and reflows the group',()=>{
 const s=make();s.toggle('一');s.toggle('十');s.setOption('learnSkipEnabled',true);
 assert.deepEqual(s.learningList(data).slice(0,5).map(d=>d.char),['乙','二','人','入','八']);assert.equal(s.learningList(data).length,6);
});
test('threshold uses historical counts across rounds and exact boundary',()=>{
 const s=make();s.toggle('一');s.toggle('二');s.nextRound();s.toggle('一');s.setOption('learnSkipEnabled',true);s.setOption('learnSkipCount',2);
 assert.ok(!s.learningList(data).some(d=>d.char==='一'));assert.ok(s.learningList(data).some(d=>d.char==='二'));
 s.toggle('一');assert.ok(s.learningList(data).some(d=>d.char==='一'));
});
test('stroke and mastered filters compose; all excluded is an empty list',()=>{
 const s=make();s.setOption('stroke',2);s.setOption('learnSkipEnabled',true);s.toggle('人');assert.equal(s.learningList(data).length,4);
 data.forEach(d=>{if(!s.known(d.char))s.toggle(d.char);});assert.deepEqual(s.learningList(data),[]);
});
test('skip settings survive backup restore; invalid threshold cannot be saved',()=>{
 const s=make();s.setOption('learnSkipEnabled',true);s.setOption('learnSkipCount',3);const n=create(s.snapshot(),data.map(d=>d.char));assert.equal(n.options().learnSkipCount,3);assert.equal(n.options().learnSkipEnabled,true);
 [0,-1,1.5,NaN,10001].forEach(v=>assert.throws(()=>n.setOption('learnSkipCount',v)));assert.equal(n.options().learnSkipCount,3);
});
