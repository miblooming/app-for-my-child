const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/characters.json'),'utf8'));
test('2500 distinct characters have valid strokes, pinyin, and contextual example words',()=>{
  assert.equal(data.length,2500);assert.equal(new Set(data.map(d=>d.char)).size,2500);
  for(const d of data){assert.ok(d.strokes>0&&Number.isInteger(d.strokes));assert.ok(d.pinyin.length);assert.ok(d.words.length>=1&&d.words.length<=2);for(const w of d.words){assert.ok(w.text.includes(d.char),d.char+': '+w.text);assert.ok(w.pinyin);assert.ok(!/[\u4e00-\u9fff]/.test(w.pinyin),w.text+': untranslated pinyin');}}
});
test('original page boundaries contain all 2500 characters in 15 pages',()=>{const counts=Array(15).fill(0);data.forEach(d=>counts[d.page-1]++);assert.deepEqual(counts,[144,...Array(13).fill(176),68]);});
test('stroke order creates exactly 500 groups of five without dropping or duplicating characters',()=>{
 const sorted=data.slice().sort((a,b)=>a.strokes-b.strokes||a.order-b.order);assert.equal(sorted[0].strokes,1);assert.ok(sorted[2499].strokes>=20);for(const [c,n] of [['一',1],['人',2],['口',3],['车',4],['鸟',5],['爱',10]])assert.equal(data.find(d=>d.char===c).strokes,n,c+' stroke count');assert.ok(sorted.every((d,i)=>i===0||d.strokes>=sorted[i-1].strokes));const groups=[];for(let i=0;i<sorted.length;i+=5)groups.push(sorted.slice(i,i+5));assert.equal(groups.length,500);assert.ok(groups.every(g=>g.length===5));assert.equal(new Set(groups.flat().map(d=>d.char)).size,2500);
});
