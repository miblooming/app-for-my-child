const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../app/src/main/assets/www/model.js');
const chars=['一','二','三'],data=chars.map(char=>({char}));

test('reset cancels all current selections once while preserving history and round identity',()=>{
 const s=create(null,chars);s.toggle('一');s.nextRound();s.toggle('一');s.toggle('二');
 const history=s.snapshot().rounds[0],id=s.current().id,started=s.current().startedAt;
 s.setOption('heat',true);s.setOption('testSkipEnabled',true);
 assert.equal(s.resetCurrent(),2);assert.equal(s.knownCount(),0);assert.equal(s.count('一'),1);assert.equal(s.count('二'),0);assert.equal(s.everCount(),1);
 assert.deepEqual(s.snapshot().rounds[0],history);assert.equal(s.current().id,id);assert.equal(s.current().startedAt,started);assert.equal(s.options().heat,true);assert.equal(s.options().testSkipEnabled,true);
 assert.equal(s.resetCurrent(),0);assert.equal(s.count('一'),1);
 s.toggle('二');const restored=create(s.snapshot(),chars);assert.equal(restored.count('二'),1);assert.equal(restored.count('一'),1);
});

test('test filter hides counts at or above threshold including exact boundary',()=>{
 const s=create(null,chars);s.toggle('一');s.toggle('二');s.nextRound();s.toggle('一');s.setOption('testSkipEnabled',true);
 assert.deepEqual(s.testList(data).map(d=>d.char),['三']);
 s.setOption('testSkipCount',2);assert.deepEqual(s.testList(data).map(d=>d.char),['二','三']);
 s.setOption('testSkipCount',3);assert.deepEqual(s.testList(data),data);
 s.setOption('testSkipCount',0);assert.deepEqual(s.testList(data),[]);
 s.setOption('testSkipEnabled',false);assert.deepEqual(s.testList(data),data);
});

test('crossing the threshold hides a character and reset restores eligible characters',()=>{
 const s=create(null,chars);s.setOption('testSkipEnabled',true);s.setOption('testSkipCount',1);s.toggle('一');s.toggle('二');
 assert.deepEqual(s.testList(data).map(d=>d.char),['三']);s.resetCurrent();assert.deepEqual(s.testList(data),data);
 assert.equal(create(s.snapshot(),chars).knownCount(),0);
});

test('older backups default to no test filtering, new preferences survive restore independently',()=>{
 const s=create(null,chars);s.toggle('一');const old=s.snapshot();delete old.options.testSkipEnabled;delete old.options.testSkipCount;
 const n=create(old,chars);assert.equal(n.count('一'),1);assert.equal(n.options().testSkipEnabled,false);assert.equal(n.options().testSkipCount,1);
 n.setOption('testSkipEnabled',true);n.setOption('testSkipCount',0);n.setOption('learnSkipCount',3);
 const restored=create(n.snapshot(),chars);assert.equal(restored.options().testSkipCount,0);assert.equal(restored.options().learnSkipCount,3);
});

test('test filter rejects invalid thresholds and sanitizes malformed backup preferences',()=>{
 const s=create(null,chars);for(const n of [-1,.5,NaN,Infinity,10001])assert.throws(()=>s.setOption('testSkipCount',n));
 const bad=s.snapshot();bad.options.testSkipCount=-1;assert.equal(create(bad,chars).options().testSkipCount,1);
});

test('test pronunciation defaults off in fresh state and older backups',()=>{
 const s=create(null,chars);assert.equal(s.options().testAudioEnabled,false);s.toggle('一');
 const old=s.snapshot();delete old.options.testAudioEnabled;
 const restored=create(old,chars);assert.equal(restored.options().testAudioEnabled,false);assert.equal(restored.count('一'),1);
});

test('pronunciation switch survives backup restore and new rounds independently of counts',()=>{
 const s=create(null,chars);s.toggle('一');s.setOption('testAudioEnabled',true);
 const restored=create(s.snapshot(),chars);assert.equal(restored.options().testAudioEnabled,true);assert.equal(restored.count('一'),1);
 restored.nextRound();assert.equal(restored.options().testAudioEnabled,true);assert.equal(restored.count('一'),1);
 restored.setOption('testAudioEnabled',false);assert.equal(create(restored.snapshot(),chars).options().testAudioEnabled,false);
});

test('malformed pronunciation values cannot accidentally enable audio on restore',()=>{
 for(const value of ['true','false',1,null]){const saved=create(null,chars).snapshot();saved.options.testAudioEnabled=value;assert.equal(create(saved,chars).options().testAudioEnabled,false);}
});
