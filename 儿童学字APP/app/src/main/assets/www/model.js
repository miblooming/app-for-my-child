(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZiyaModel = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const SCHEMA = 1;
  function fresh() {
    return { schema: SCHEMA, dataset: 'ziya-2500-v1', rounds: [{ id: 1, startedAt: new Date().toISOString(), endedAt: null, known: [] }], options: { heat: false, learnGroup: 0, stroke: 0, learnSkipEnabled: false, learnSkipCount: 1, testSkipEnabled: false, testSkipCount: 1, testAudioEnabled: false } };
  }
  function validate(value, allowed) {
    if (!value || value.schema !== SCHEMA || value.dataset !== 'ziya-2500-v1' || !Array.isArray(value.rounds) || !value.rounds.length || value.rounds.length > 10000) throw new Error('备份格式不正确，或不是字芽的备份文件');
    const ids = new Set();
    value.rounds.forEach((round, index) => {
      if (!Number.isSafeInteger(round.id) || round.id < 1 || ids.has(round.id) || (index>0 && round.id<=value.rounds[index-1].id) || !Array.isArray(round.known) || !Number.isFinite(Date.parse(round.startedAt)) || (index < value.rounds.length - 1 && !Number.isFinite(Date.parse(round.endedAt))) || (index === value.rounds.length - 1 && round.endedAt !== null)) throw new Error('备份中的测试轮次无效');
      ids.add(round.id);
      if (round.known.length > allowed.size || new Set(round.known).size !== round.known.length || round.known.some(c => !allowed.has(c))) throw new Error('备份中包含无效或重复的汉字');
    });
    const options = value.options || {};
    return { schema: SCHEMA, dataset: 'ziya-2500-v1', rounds: value.rounds.map(r => ({ id:r.id, startedAt:r.startedAt, endedAt:r.endedAt, known:r.known.slice() })), options: { heat: !!options.heat, learnGroup: Number.isInteger(options.learnGroup) && options.learnGroup >= 0 ? options.learnGroup : 0, stroke: Number.isInteger(options.stroke) && options.stroke >= 0 && options.stroke <= 64 ? options.stroke : 0, learnSkipEnabled: !!options.learnSkipEnabled, learnSkipCount: Number.isInteger(options.learnSkipCount) && options.learnSkipCount>=1 && options.learnSkipCount<=10000 ? options.learnSkipCount : 1, testSkipEnabled: !!options.testSkipEnabled, testSkipCount: Number.isInteger(options.testSkipCount) && options.testSkipCount>=0 && options.testSkipCount<=10000 ? options.testSkipCount : 1, testAudioEnabled: options.testAudioEnabled === true } };
  }
  function create(value, characters) {
    const allowed = new Set(characters);
    let state = value ? validate(value, allowed) : fresh();
    let counts, current;
    function rebuild() {
      counts = Object.create(null);
      state.rounds.forEach(r => r.known.forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
      current = new Set(state.rounds[state.rounds.length - 1].known);
    }
    rebuild();
    return {
      snapshot: () => JSON.parse(JSON.stringify(state)),
      current: () => state.rounds[state.rounds.length - 1],
      known: c => current.has(c),
      count: c => counts[c] || 0,
      knownCount: () => current.size,
      everCount: () => Object.keys(counts).filter(c => counts[c] > 0).length,
      rounds: () => state.rounds.map(r => ({ id:r.id, startedAt:r.startedAt, endedAt:r.endedAt, count:r.known.length })),
      options: () => Object.assign({}, state.options),
      setOption(key, value) { if (!Object.prototype.hasOwnProperty.call(state.options, key)) throw new Error('未知设置'); if(key==='learnSkipCount' && (!Number.isInteger(value)||value<1||value>10000))throw new Error('跳过次数必须是不少于1的整数');if(key==='testSkipCount' && (!Number.isInteger(value)||value<0||value>10000))throw new Error('隐藏次数必须是0到10000之间的整数');state.options[key] = value; },
      testList(data) { return data.filter(d=>!state.options.testSkipEnabled || (counts[d.char]||0)<state.options.testSkipCount); },
      learningList(data) { return data.filter(d=>(!state.options.stroke || d.strokes===state.options.stroke) && (!state.options.learnSkipEnabled || (counts[d.char]||0)<state.options.learnSkipCount)).slice().sort((a,b)=>a.strokes-b.strokes || a.order-b.order); },
      toggle(c) {
        if (!allowed.has(c)) throw new Error('汉字不在字库中');
        if (current.has(c)) { current.delete(c); counts[c]--; } else { current.add(c); counts[c] = (counts[c] || 0) + 1; }
        state.rounds[state.rounds.length - 1].known = Array.from(current);
        return current.has(c);
      },
      resetCurrent() {
        const removed=current.size;
        current.forEach(c=>{counts[c]--;});current.clear();
        state.rounds[state.rounds.length-1].known=[];
        return removed;
      },
      nextRound() {
        state.rounds[state.rounds.length - 1].endedAt = new Date().toISOString();
        state.rounds.push({ id: state.rounds[state.rounds.length - 1].id + 1, startedAt: new Date().toISOString(), endedAt:null, known:[] });
        current = new Set();
      },
      replace(value) { state = validate(value, allowed); rebuild(); }
    };
  }
  return { fresh, validate, create };
});
