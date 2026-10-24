(function () {
  'use strict';
  const DATA = window.CHARACTERS;
  const $ = (s, root = document) => root.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    sprout:'<path d="M12 21V11M12 15C4 15 3 9 3 5c6 0 9 3 9 8M12 11c0-6 4-8 9-8 0 5-2 9-9 9"/>',
    settings:'<path d="m9 3-.7 2.1-2 .9-2.2-.4-1.5 2.6L4 10v2l-1.4 1.8 1.5 2.6 2.2-.4 2 .9L9 19h3l.7-2.1 2-.9 2.2.4 1.5-2.6L17 12v-2l1.4-1.8-1.5-2.6-2.2.4-2-.9L12 3Z" transform="translate(1 1)"/><circle cx="11.5" cy="12" r="3"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
    book:'<path d="M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z"/><path d="M5 8h3M16 8h3M5 12h3M16 12h3"/>',
    initial:'<path d="M7 3v17m0-7c0-5 10-5 10 1s-10 8-10 1"/>',
    final:'<path d="M17 9v11M17 14c0-7-10-7-10 0s10 7 10 0M9 4l3-2 3 2"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5M19.5 12a7.5 7.5 0 0 0-13-5M4.5 12a7.5 7.5 0 0 0 13 5"/>',
    right:'<path d="m9 5 7 7-7 7"/>', left:'<path d="m15 5-7 7 7 7"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
    down:'<path d="m6 9 6 6 6-6"/>', download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    history:'<path d="M3 10a9 9 0 1 1 1.5 7M3 4v6h6M12 7v5l3 2"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.2"/>',
    check:'<path d="m5 12 4 4L19 6"/>', leaf:'<path d="M4 20 17 7M4 17C1 6 9 2 21 3c0 11-5 18-15 15M10 13v-4M12 11h4"/>',
    heart:'<path d="M12 21S2 15 2 8c0-5 7-7 10-2 3-5 10-3 10 2 0 7-10 13-10 13Z"/>'
    ,sound:'<path d="M11 4 5 9H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
  $('#brand-mark').innerHTML = icon('sprout');
  $('#settings-button').innerHTML = icon('settings');
  if (!Array.isArray(DATA) || DATA.length !== 2500) {
    $('#main').innerHTML = '<div class="data-error">字库加载失败。请重新打开应用，或重新安装完整的字芽安装包。</div>'; return;
  }
  const byChar = new Map(DATA.map(d => [d.char,d]));
  const sorted = DATA.slice().sort((a,b) => a.strokes-b.strokes || a.order-b.order);
  const STORAGE = 'ziya-state-v1';
  let model, storageError = false, rawState = '';
  try {
    rawState = window.Android ? Android.loadState() : (localStorage.getItem(STORAGE) || '');
    model = ZiyaModel.create(rawState ? JSON.parse(rawState) : null, DATA.map(d => d.char));
  } catch (error) { storageError = true; model = ZiyaModel.create(null,DATA.map(d => d.char)); }
  let route = 'test', query = '', filter = 'all', visiblePages = 1, scrollPositions = {}, toastTimer, observer, lastFocused, pressTimer;
  let learning = model.options().learnGroup, stroke = model.options().stroke;
  let learnSkipEnabled=model.options().learnSkipEnabled,learnSkipCount=model.options().learnSkipCount;
  const voice=ZiyaAudio.create({bridge:window.Android,AudioClass:window.Audio,onState:(id,status)=>{
    document.querySelectorAll('[data-voice]').forEach(node=>{const playing=node.dataset.voice===id&&(status==='playing'||status==='loading');node.classList.toggle('speaking',playing);node.setAttribute('aria-busy',playing?'true':'false');const hint=node.querySelector('[data-audio-hint]');if(hint)hint.textContent=playing?(status==='loading'?'准备朗读…':'正在朗读…'):'点击读字、读词';});
  },onError:message=>toast(message)});
  window.onAudioStatus=(token,id,status)=>voice.nativeStatus(token,id,status);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)voice.stop();});
  const pageSizes = [144,...Array(13).fill(176),68];
  function persist() {
    if (storageError) { toast('记录读取异常，请先在设置中导出原始记录或恢复备份'); return false; }
    const text = JSON.stringify(model.snapshot());
    try {
      const ok = window.Android ? Android.saveState(text) : (localStorage.setItem(STORAGE,text),true);
      if (!ok) throw new Error('write failed');
      return true;
    } catch (e) { toast('保存失败，请立即导出备份，避免丢失本次记录'); return false; }
  }
  function toast(message) {
    const node=$('#toast'); node.textContent=message; node.classList.add('visible');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>node.classList.remove('visible'),3200);
  }
  function openModal(title,body,actions='') {
    voice.stop();
    lastFocused=document.activeElement;
    const node=$('#modal');
    $('.modal',node).innerHTML=`<div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="modal-close" aria-label="关闭">${icon('close')}</button></div>${body}${actions ? `<div class="modal-actions">${actions}</div>` : ''}`;
    node.hidden=false; document.body.style.overflow='hidden';
    $('.modal-close',node).onclick=closeModal; $('.modal',node).focus();
    node.onclick=e=>{ if(e.target===node) closeModal(); };
  }
  function closeModal() { voice.stop();$('#modal').hidden=true; document.body.style.overflow=''; if(lastFocused && document.contains(lastFocused)) lastFocused.focus({preventScroll:true}); }
  document.addEventListener('keydown', e=>{
    if ($('#modal').hidden) return;
    if(e.key==='Escape') {e.preventDefault();closeModal();}
    if(e.key==='Tab') {
      const focusable=Array.from($('#modal').querySelectorAll('button,input,select,a')).filter(n=>!n.disabled);
      if(!focusable.length)return;
      if(e.shiftKey && document.activeElement===focusable[0]) {e.preventDefault();focusable[focusable.length-1].focus();}
      else if(!e.shiftKey && document.activeElement===focusable[focusable.length-1]) {e.preventDefault();focusable[0].focus();}
    }
  });
  const navs=[['test','grid','识字测试'],['learn','book','五字学习'],['initials','initial','声母'],['finals','final','韵母']];
  function navigate(next,keep=false) {
    voice.stop();
    if(!navs.some(n=>n[0]===next)) next='test';
    if(!keep) scrollPositions[route]=window.scrollY;
    route=next;
    document.body.dataset.page=route;
    if(observer)observer.disconnect();
    $('#navigation').innerHTML=navs.map(([id,ic,label])=>`<a href="#${id}" class="nav-item ${id===route?'active':''}" ${id===route?'aria-current="page"':''}><span class="nav-icon">${icon(ic)}</span>${label}</a>`).join('');
    $('#main').className=route==='learn'?'learning-main':'';
    if(route==='test') renderTest();
    else if(route==='learn') renderLearn();
    else renderPinyin(route==='initials');
    if(!keep) window.scrollTo(0,scrollPositions[route]||0);
  }
  window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
  function testStats() {
    const count=model.knownCount(), pct=(count/DATA.length*100).toFixed(1);
    return `<div class="round-top"><span class="round-label"><i class="dot"></i>第 ${model.current().id} 轮测试 <span style="color:#8c987e;font-weight:400">· 进行中</span></span><div class="round-actions"><button class="subtle-button" id="reset-round" ${count===0?'disabled':''}>重置本轮</button><button class="subtle-button" id="new-round">${icon('refresh')}新一轮</button></div></div>
      <div class="round-stats"><div><div class="stat-number" id="round-known">${count}<small>字</small></div><div class="stat-label">本轮认识</div></div><i class="stat-separator"></i><div><div class="stat-number" style="color:#91a084" id="round-unknown">${DATA.length-count}<small>字</small></div><div class="stat-label">本轮待认识</div></div><div class="stat-side">累计点亮 <b id="ever-known">${model.everCount()}</b> 字<br>每一次认识，都是成长</div></div>
      <div class="progress-track"><div class="progress-fill" id="test-progress" style="width:${pct}%"></div></div><div class="progress-caption"><span>你的识字小花园</span><span id="test-percent">${pct}% / ${DATA.length} 字</span></div>`;
  }
  function renderTest() {
    const heat=model.options().heat;
    $('#main').innerHTML=`<section class="hero"><div class="page-intro"><div class="eyebrow">LITTLE WORDS, BIG WORLD</div><h1>小小汉字，大大世界</h1><p>点亮认识的字，看见每一次进步。</p></div><div class="sprout-illustration" aria-hidden="true"><span class="floating-letter one">日</span><span class="floating-letter two">木</span>${icon('sprout')}</div></section>
      <section class="round-card" aria-label="测试进度" id="round-card">${testStats()}</section>
      <div class="grid-toolbar"><label class="search">${icon('search')}<input type="search" id="character-search" aria-label="搜索汉字或拼音" placeholder="找一找汉字 / 拼音" value="${esc(query)}"><button class="clear-search" id="clear-search" aria-label="清除搜索" ${query?'':'hidden'}>×</button></label><button class="heat-control" id="test-audio-toggle" role="switch" aria-label="发音：标记认识时播放教学音" aria-checked="${model.options().testAudioEnabled}">发音<span class="toggle"></span></button><button class="heat-control" id="heat-toggle" role="switch" aria-checked="${heat}">热力图<span class="toggle"></span></button></div>
      <div class="filter-row"><div class="segments" aria-label="汉字筛选">${[['all','全部汉字'],['known','本轮认识'],['unknown','待认识']].map(([v,t])=>`<button class="filter ${filter===v?'active':''}" data-filter="${v}" aria-pressed="${filter===v}">${t}</button>`).join('')}</div><span class="grid-hint">轻点标记 · 长按学字</span></div>
      <div class="test-options"><div class="learn-skip-control"><label><input type="checkbox" id="test-skip" ${model.options().testSkipEnabled?'checked':''}><span>隐藏认识 ≥</span></label><input type="number" id="test-skip-count" min="0" max="10000" inputmode="numeric" value="${model.options().testSkipCount}" aria-label="隐藏累计认识达到多少次的字，最少0次"><span>次的字</span></div><span class="test-filter-summary" id="test-filter-summary" aria-live="polite"></span></div>
      <div class="heat-legend" id="heat-legend" ${heat?'':'hidden'}><span>累计认识</span><span>少</span>${['#fffefa','#e5edd9','#cdddb8','#abc88d','#86ad69'].map(c=>`<i style="background:${c}"></i>`).join('')}<span>多（5 次及以上）</span></div>
      <div class="characters-grid" id="character-grid" aria-label="汉字测试网格"></div><div class="load-more" id="load-more"></div><p class="grid-footnote">右下角数字为累计认识次数 · 同一轮最多记 1 次<br>记录自动保存在本机</p>`;
    $('#new-round').onclick=newRound;
    $('#reset-round').onclick=resetRound;
    $('#test-audio-toggle').onclick=()=>{
      const before=model.options().testAudioEnabled,enabled=!before;
      if(!enabled)voice.stop();model.setOption('testAudioEnabled',enabled);
      if(!persist()){model.setOption('testAudioEnabled',before);return;}
      $('#test-audio-toggle').setAttribute('aria-checked',String(enabled));
    };
    $('#test-skip').onchange=e=>{model.setOption('testSkipEnabled',e.target.checked);visiblePages=1;persist();renderGrid();};
    $('#test-skip-count').onchange=e=>{const n=Number(e.target.value);if(e.target.value.trim()===''||!Number.isInteger(n)||n<0||n>10000){e.target.value=model.options().testSkipCount;toast('请输入 0 到 10000 之间的整数');return;}model.setOption('testSkipCount',n);visiblePages=1;persist();renderGrid();};
    $('#character-search').oninput=e=>{query=e.target.value.trim().slice(0,40);visiblePages=1;$('#clear-search').hidden=!query;renderGrid();};
    $('#clear-search').onclick=()=>{query='';$('#character-search').value='';$('#clear-search').hidden=true;visiblePages=1;renderGrid();$('#character-search').focus();};
    $('#heat-toggle').onclick=()=>{model.setOption('heat',!model.options().heat);persist();$('#heat-toggle').setAttribute('aria-checked',model.options().heat);$('#heat-legend').hidden=!model.options().heat;renderGrid();};
    document.querySelectorAll('[data-filter]').forEach(n=>n.onclick=()=>{filter=n.dataset.filter;visiblePages=1;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',b.dataset.filter===filter);});renderGrid();});
    renderGrid();
  }
  const normalize=s=>s.toLowerCase().replace(/[üǖǘǚǜ]/g,'v').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function matching() {
    const q=normalize(query).replace(/[1-5]/g,'');
    return model.testList(DATA).filter(d=>(filter==='all'||(filter==='known'?model.known(d.char):!model.known(d.char))) && (!query || query.includes(d.char) || normalize(d.pinyin.join(' ')).includes(q) || d.words.some(w=>w.text.includes(query))));
  }
  function heatColor(count) {return ['#fffefa','#e5edd9','#cdddb8','#abc88d','#96b975','#86ad69'][Math.min(count,5)];}
  function cell(d) {
    const known=model.known(d.char), count=model.count(d.char), heat=model.options().heat;
    return `<button class="character-cell ${known?'known':''}" data-character="${d.char}" aria-label="${d.char}，${known?'本轮认识':'本轮待认识'}，累计认识${count}次" aria-pressed="${known}" ${heat?`style="background:${heatColor(count)}"`:''}>${d.char}<span class="check" aria-hidden="true">${known?'✓':''}</span><small class="count" aria-hidden="true">${count}</small></button>`;
  }
  function bindGrid() {
    $('#character-grid').querySelectorAll('[data-character]').forEach(btn=>{
      let longPressed=false, startX=0,startY=0;
      btn.onpointerdown=e=>{longPressed=false;startX=e.clientX;startY=e.clientY;pressTimer=setTimeout(()=>{longPressed=true;characterDetail(btn.dataset.character);},550);};
      btn.onpointermove=e=>{if(Math.abs(e.clientX-startX)>9||Math.abs(e.clientY-startY)>9)clearTimeout(pressTimer);};
      btn.onpointerup=btn.onpointercancel=btn.onpointerleave=()=>clearTimeout(pressTimer);
      btn.oncontextmenu=e=>{e.preventDefault();clearTimeout(pressTimer);if(!longPressed){longPressed=true;characterDetail(btn.dataset.character);}};
      btn.onclick=()=>{
        if(longPressed){longPressed=false;return;}
        const c=btn.dataset.character, known=model.toggle(c);
        if(model.options().testAudioEnabled){if(known)voice.play(`c${String(byChar.get(c).order).padStart(4,'0')}`);else voice.stop();}
        if(model.options().learnSkipEnabled){learning=0;model.setOption('learnGroup',0);}persist();
        if(filter==='all'&&!model.options().testSkipEnabled) {const replacement=document.createElement('div');replacement.innerHTML=cell(byChar.get(c));btn.replaceWith(replacement.firstElementChild);bindGrid();} else renderGrid();
        refreshStats();
      };
    });
  }
  function refreshStats() {$('#round-card').innerHTML=testStats();$('#new-round').onclick=newRound;$('#reset-round').onclick=resetRound;}
  function renderGrid() {
    if(observer)observer.disconnect();
    $('#test-filter-summary').textContent=model.options().testSkipEnabled?`已隐藏 ${DATA.length-model.testList(DATA).length} 字`:'';
    const matches=matching(), max=pageSizes.slice(0,Math.min(visiblePages,15)).reduce((a,b)=>a+b,0), shown=Math.min(max,matches.length);
    $('#character-grid').innerHTML=matches.slice(0,shown).map(cell).join('');
    bindGrid();
    const more=$('#load-more');
    if(!matches.length) {more.innerHTML=`<div class="empty">${icon('leaf')}${query?'没有找到这个字，换个字或拼音试试':model.options().testSkipEnabled?'当前条件下没有汉字<br>可调高次数，或取消次数筛选':filter==='known'?'这一轮还没有点亮的字<br>轻点认识的字，开始积累吧':'这一轮的字全部点亮啦！'}</div>`;return;}
    more.innerHTML=shown<matches.length?`已加载 ${shown} / ${matches.length} 字<br><button id="load-page">继续下滑，加载下一页 ${icon('down')}</button>`:`<span>已显示全部 ${matches.length} 个字 · 慢慢学，不着急</span>`;
    if(shown<matches.length){
      const load=()=>{visiblePages++;const y=window.scrollY;renderGrid();window.scrollTo(0,y);};
      $('#load-page').onclick=load;
      if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}},{rootMargin:'0px 0px 180px 0px'});observer.observe(more);}
    }
  }
  function resetRound() {
    if(!model.knownCount())return;
    openModal('重置本轮选中？',`<p>将取消第 <b>${model.current().id}</b> 轮全部 <b>${model.knownCount()}</b> 个字的认识选中，包括被筛选隐藏的字。</p><p style="margin-top:10px">每个已选中字撤销本轮增加的 1 次累计，历史轮次保留，本轮编号不变。</p>`,`<button class="button secondary" id="cancel-reset">取消</button><button class="button" id="confirm-reset">取消全部选中</button>`);
    $('#cancel-reset').onclick=closeModal;
    $('#confirm-reset').onclick=()=>{
      const before=model.snapshot(),removed=model.resetCurrent();
      if(model.options().learnSkipEnabled){learning=0;model.setOption('learnGroup',0);}
      if(!persist()){model.replace(before);learning=model.options().learnGroup;return;}
      visiblePages=1;closeModal();navigate('test',true);window.scrollTo(0,0);toast(`已取消本轮 ${removed} 个字的选中`);
    };
  }
  function newRound() {
    openModal('让新一轮，开始发芽',`<p>本轮已认识 <b>${model.knownCount()}</b> 个字。开始第 ${model.current().id+1} 轮后，本轮标记将从头开始，历史测试和累计认识次数会保留。</p><p style="margin-top:10px">同一个字，每轮最多累计一次；本轮再次点击可撤销。</p>`,`<button class="button secondary" id="cancel-round">继续本轮</button><button class="button" id="confirm-round">开始新一轮 ${icon('right')}</button>`);
    $('#cancel-round').onclick=closeModal;
    $('#confirm-round').onclick=()=>{model.nextRound();const saved=persist();visiblePages=1;closeModal();navigate('test',true);window.scrollTo(0,0);if(saved)toast(`第 ${model.current().id} 轮已开始，慢慢来！`);};
  }
  function learnData(){return model.learningList(DATA);}
  function renderLearn(){
    const list=learnData(), groups=Math.ceil(list.length/5);learning=groups?Math.min(Math.max(learning,0),groups-1):0;
    const heat=model.options().heat,base=stroke?sorted.filter(d=>d.strokes===stroke):sorted,skipped=base.length-list.length;
    $('#main').innerHTML=`<section class="learning-page"><div class="learning-title-row"><div class="page-intro"><div class="eyebrow">FIVE WORDS A LITTLE GROWTH</div><h1>今天，认识这 5 个字</h1><p>从简单的笔画开始，点字卡先读字、再读词。</p></div><div class="study-badge">${icon('book')}</div></div>
      <div class="study-toolbar"><label class="select-wrap"><select id="stroke-select" aria-label="按笔画筛选"><option value="0">全部 · 按笔画排序</option>${Array.from(new Set(sorted.map(d=>d.strokes))).map(n=>`<option value="${n}" ${stroke===n?'selected':''}>${n} 画 · ${sorted.filter(d=>d.strokes===n).length} 字</option>`).join('')}</select></label><button class="group-jump" id="group-jump">${groups?`第 ${learning+1} / ${groups} 组`:'暂无分组'} ${icon('down')}</button></div>
      <div class="learning-options"><div class="learn-skip-control"><label><input type="checkbox" id="learn-skip" ${learnSkipEnabled?'checked':''}><span>跳过认识 ≥</span></label><input type="number" id="learn-skip-count" min="1" max="10000" inputmode="numeric" value="${learnSkipCount}" aria-label="跳过累计认识次数，至少1次"><span>次</span></div><button class="heat-control" id="learn-heat" role="switch" aria-checked="${heat}">热力图<span class="toggle"></span></button></div>
      <div class="study-list">${list.length?list.slice(learning*5,learning*5+5).map(d=>`<button class="study-card" data-study="${d.char}" data-voice="c${String(d.order).padStart(4,'0')}" aria-label="播放${d.char}和词语，累计认识${model.count(d.char)}次" ${heat?`style="background:${heatColor(model.count(d.char))}"`:''}><span class="writing-square">${d.char}</span><span class="study-content"><span class="pinyin" style="display:block">${esc(d.pinyin.slice(0,2).join(' / '))}</span><span class="word-examples">${d.words.map(w=>`<span>${w.text}</span>`).join('')}</span></span><span class="stroke-badge">${d.strokes} 画</span><span class="study-sound">${icon('sound')}</span><span class="study-recognition" aria-hidden="true">${model.count(d.char)}<small>次</small></span></button>`).join(''):`<div class="learning-empty">${icon('leaf')}<p>这些字都已经认识啦</p><small>调高跳过次数，或取消跳过，继续复习。</small><button class="button secondary" id="show-all-learning">显示全部字</button></div>`}</div>
      <div class="learning-footer"><button class="button secondary" id="previous-group" ${learning===0?'disabled':''}>${icon('left')}上一组</button><span class="study-count">${list.length?learning*5+1:0}–${Math.min(learning*5+5,list.length)} / ${list.length} 字${skipped?`<br>已跳过 ${skipped} 字`:''}</span><button class="button" id="next-group" ${!groups||learning===groups-1?'disabled':''}>下一组 ${icon('right')}</button></div><p class="study-note">右下角为累计认识次数 · 筛选后自动重新分组</p></section>`;
    $('#group-jump').disabled=!groups;
    $('#learn-skip').onchange=e=>{voice.stop();learnSkipEnabled=e.target.checked;learning=0;saveLearning();renderLearn();};
    $('#learn-skip-count').onchange=e=>{const n=Number(e.target.value);if(!Number.isInteger(n)||n<1||n>10000){e.target.value=learnSkipCount;toast('请输入 1 到 10000 之间的整数');return;}voice.stop();learnSkipCount=n;learning=0;saveLearning();renderLearn();};
    $('#learn-heat').onclick=()=>{model.setOption('heat',!model.options().heat);persist();renderLearn();};
    if($('#show-all-learning'))$('#show-all-learning').onclick=()=>{learnSkipEnabled=false;learning=0;saveLearning();renderLearn();};
    $('#stroke-select').onchange=e=>{voice.stop();stroke=Number(e.target.value);learning=0;saveLearning();renderLearn();};
    $('#previous-group').onclick=()=>{voice.stop();learning--;saveLearning();renderLearn();};
    $('#next-group').onclick=()=>{voice.stop();learning++;saveLearning();renderLearn();};
    $('#group-jump').onclick=()=>{
      openModal('跳到哪一组？',`<p>共 ${groups} 组，每组最多 5 个字。</p><input type="number" inputmode="numeric" min="1" max="${groups}" value="${learning+1}" class="number-input" id="group-number" aria-label="组数">`,`<button class="button" id="jump-confirm">去学习 ${icon('right')}</button>`);
      $('#jump-confirm').onclick=()=>{const n=Number($('#group-number').value);if(!Number.isInteger(n)||n<1||n>groups){toast(`请输入 1 到 ${groups} 之间的整数`);return;}voice.stop();learning=n-1;saveLearning();closeModal();renderLearn();};
    };
    document.querySelectorAll('[data-study]').forEach(btn=>btn.onclick=()=>voice.play(btn.dataset.voice));
  }
  function saveLearning(){model.setOption('learnGroup',learning);model.setOption('stroke',stroke);model.setOption('learnSkipEnabled',learnSkipEnabled);model.setOption('learnSkipCount',learnSkipCount);persist();}
  function characterDetail(c){
    const d=byChar.get(c),audioId=`c${String(d.order).padStart(4,'0')}`;
    openModal('认识一个字',`<div class="detail-hero"><span class="writing-square">${c}</span><div><div class="pinyin">${esc(d.pinyin.join(' / '))}</div><span class="detail-meta">${d.strokes} 画${d.pinyin.length>1?' · 多音字':''}</span></div></div><button class="detail-learning" id="detail-learn" data-voice="${audioId}" aria-label="学习${c}，播放汉字和词语"><span class="detail-learning-icon">${icon('book')}</span><span class="detail-learning-content"><b>学习「${c}」<span>${esc(d.pinyin.join(' / '))}</span></b><small>${c} · ${d.words.map(w=>w.text).join(' · ')}</small><small data-audio-hint>点击读字、读词</small></span><span class="detail-learning-sound">${icon('sound')}</span></button>${d.words.map(w=>`<div class="detail-word"><span>${w.text}</span><small>${esc(w.pinyin)}</small></div>`).join('')}<div class="detail-bottom"><span>累计认识 ${model.count(c)} 次</span><span>第 ${model.current().id} 轮 · ${model.known(c)?'已认识':'待认识'}</span></div><p>多音字请结合词语读音学习。</p>`);
    $('#detail-learn').onclick=()=>voice.play(audioId);
  }
  const INITIALS=[
    ['b','菠 bō','双唇闭合后打开，轻轻发音，不送气。'],['p','坡 pō','双唇闭合后打开，送出一股气。'],['m','摸 mō','双唇闭合，气流从鼻腔出来。'],['f','佛 fó','上齿轻触下唇，让气流从缝隙中通过。'],
    ['d','得 dé','舌尖抵住上齿龈，再轻轻放开，不送气。'],['t','特 tè','舌尖抵住上齿龈，再放开并送气。'],['n','讷 nè','舌尖抵上齿龈，让气流从鼻腔出来。'],['l','乐 lè','舌尖抵上齿龈，让气流从舌头两边出来。'],
    ['g','哥 gē','舌根抬高，抵住软腭后放开，不送气。'],['k','科 kē','舌根抬高，放开时送气。'],['h','喝 hē','舌根靠近软腭，让气流摩擦而出。'],
    ['j','鸡 jī','舌面前部靠近硬腭，轻轻发音，不送气。'],['q','七 qī','舌面前部靠近硬腭，放开时送气。'],['x','西 xī','舌面前部靠近硬腭，让气流从缝隙通过。'],
    ['zh','知 zhī','舌尖翘起，抵住硬腭前部后放开，不送气。'],['ch','吃 chī','舌尖翘起，放开时送气。'],['sh','狮 shī','舌尖翘起，气流从缝隙摩擦而出。'],['r','日 rì','舌尖翘起，声带振动，轻轻发音。'],
    ['z','字 zì','舌尖平伸，抵住上齿背后放开，不送气。'],['c','刺 cì','舌尖平伸，抵住上齿背后放开并送气。'],['s','丝 sī','舌尖平伸，靠近上齿背，让气流从缝隙通过。'],
    ['y','衣 yī','借助“衣”的读音来认识字母 y。'],['w','乌 wū','借助“乌”的读音来认识字母 w。']
  ];
  const FINAL_GROUPS=[
    ['单韵母',[['a','啊 ā','张大嘴巴，舌头放低。'],['o','喔 ō','嘴唇拢圆，舌头后缩。'],['e','鹅 é','嘴角展开，舌头稍稍后缩。'],['i','衣 yī','嘴唇展开，舌面前部抬高。'],['u','乌 wū','嘴唇拢成圆形，舌面后部抬高。'],['ü','鱼 yú','先摆好 i 的舌位，再把嘴唇拢圆。']]],
    ['复韵母',[['ai','爱 ài','从 a 滑向 i，一气呵成。'],['ei','诶 ēi','从 e 滑向 i，一气呵成。'],['ui','水 shuǐ','是 uei 的省写，从 u 滑向 ei。'],['ao','袄 ǎo','从 a 滑向 o，一气呵成。'],['ou','藕 ǒu','从 o 滑向 u，一气呵成。'],['iu','牛 niú','是 iou 的省写，从 i 滑向 ou。'],['ie','叶 yè','从 i 滑向 ê，嘴巴逐渐张开。'],['üe','月 yuè','从 ü 滑向 ê，嘴唇由圆到展开。']]],
    ['特殊韵母',[['er','耳 ěr','先发 e，再轻轻卷起舌尖。不能与声母相拼。']]],
    ['前鼻韵母',[['an','安 ān','先发 a，再用舌尖抵住上齿龈。'],['en','恩 ēn','先发 e，再用舌尖抵住上齿龈。'],['in','音 yīn','先发 i，结尾时舌尖抵住上齿龈。'],['un','温 wēn','是 uen 的省写，结尾发前鼻音 n。'],['ün','云 yún','先发 ü，结尾发前鼻音 n。']]],
    ['后鼻韵母',[['ang','昂 áng','从 a 过渡到后鼻音 ng，舌根抬高。'],['eng','灯 dēng','从 e 过渡到后鼻音 ng，舌根抬高。'],['ing','鹰 yīng','从 i 过渡到后鼻音 ng，舌根抬高。'],['ong','虫 chóng','双唇拢圆，最后发后鼻音 ng。']]]
  ];
  function renderPinyin(isInitial){
    const count=isInitial?23:24;
    $('#main').innerHTML=`<section class="pinyin-page"><div class="page-intro"><div class="eyebrow">${isInitial?'THE BEGINNING OF A SOUND':'A LITTLE SOUND A BIG DISCOVERY'}</div><h1>${isInitial?'声母，一起读一读':'韵母，慢慢记心里'}</h1><p>${count} 个${isInitial?'声母':'韵母'}，打开汉语拼音的小世界。</p></div>
      <div class="pinyin-banner">${icon('sound')}<div><b>${isInitial?'轻轻读，短短读':'读得响，读得长'}</b><p>${isInitial?'声母发音要轻、短。点击卡片，直接听发音。':'韵母发音要响亮。点击卡片，直接听发音。'}</p></div></div>
      ${isInitial?`<div class="phonetic-grid">${INITIALS.map((d,i)=>phoneticCard(d,i,'initial',i>=14&&i<=17)).join('')}</div><p class="pinyin-tip">翘舌音：zh、ch、sh、r；平舌音：z、c、s。<br>小学常用声母表列有 y、w，学习时可一起认记。例字用来辅助记忆，声母本身要读得轻、短。</p>`:FINAL_GROUPS.map(([title,items],g)=>`<div class="section-label">${title}<small>${items.length} 个</small></div><div class="phonetic-grid">${items.map((d,i)=>phoneticCard(d,i,g,g===2)).join('')}</div>`).join('')}
      ${!isInitial?'<div class="tone-strip"><div><b>ā</b><small>一声 · 平</small></div><div><b>á</b><small>二声 · 扬</small></div><div><b>ǎ</b><small>三声 · 拐弯</small></div><div><b>à</b><small>四声 · 降</small></div></div><p class="pinyin-tip">j、q、x 和 ü 相拼时，ü 上两点省略，例如：jū、qū、xū。ü 与 y 相拼时也省略两点，例如：yú、yuè。</p>':''}<div class="page-footer">一字一音 · 一点点长大</div></section>`;
    document.querySelectorAll('[data-phonetic]').forEach(btn=>btn.onclick=()=>voice.play(btn.dataset.voice));
  }
  function phoneticCard(d,index,group,special){return `<button class="phonetic-card ${special?'special':''}" data-phonetic="${d[0]}" data-index="${index}" data-group="${group}" data-voice="${group==='initial'?'i':'f'}_${d[0].replace('ü','v')}" aria-label="播放${group==='initial'?'声母':'韵母'} ${d[0]} 的发音"><span class="phonetic-symbol">${d[0]}</span><span class="phonetic-example">${d[1]}</span></button>`;}
  const date=s=>new Date(s).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});
  function settings(){
    openModal('记录与设置',`<p>每一颗小小的字芽，都值得好好保存。</p>${storageError?'<div class="warning">原始记录读取异常。为保护原记录，自动保存已暂停。可先导出原始记录，再导入一份有效备份。</div>':''}
      <button class="settings-option" id="show-history">${icon('history')}<span>测试记录<small>已进行 ${model.rounds().length} 轮 · 累计点亮 ${model.everCount()} 字</small></span>${icon('right')}</button>
      <button class="settings-option" id="export-records">${icon('download')}<span>导出记录备份<small>保存为 JSON 文件，换手机也能接着学</small></span>${icon('right')}</button>
      <button class="settings-option" id="import-records">${icon('upload')}<span>从备份恢复<small>导入前会显示记录信息，由你确认</small></span>${icon('right')}</button>
      <button class="settings-option" id="show-licenses">${icon('book')}<span>开源许可<small>笔画、拼音资料的来源与完整许可</small></span>${icon('right')}</button>
      <button class="settings-option" id="show-about">${icon('info')}<span>关于字芽<small>2,500 字离线字库 · 版本 1.4.0</small></span>${icon('right')}</button>
      <p class="privacy-note">不需要注册，不申请网络权限。字词朗读为 AI 合成语音。测试记录保存在这台设备中，卸载前请先导出备份。</p>`);
    $('#show-history').onclick=history;
    $('#export-records').onclick=exportRecords;
    $('#import-records').onclick=()=>{
      if(window.Android){Android.importBackup();return;}
      const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{if(input.files[0].size>32*1024*1024)throw new Error('备份文件不能超过 32 MB');window.onBackupImported(await input.files[0].text());}catch(e){toast(e.message);}};input.click();
    };
    $('#show-about').onclick=()=>openModal('字芽 · 一点点长大',`<p>把纸上的识字表，变成孩子的识字小花园。</p><p style="margin-top:13px">本字库以提供的 15 页《儿童识字测试表（2500 字）》为依据提取、核对。按笔画学习时使用 Unicode Unihan 的笔画资料，拼音和词语读音由 pypinyin 生成并补充常用读音，组词优先采用儿童日常词语。</p><p style="margin-top:13px">测试：轻点认识，再点撤销；同字同轮只记一次。长按字卡可看拼音与组词。热力图按累计次数从浅到深，5 次及以上使用最深色。</p><p style="margin-top:13px">多音字请结合词语学习。声母 23 个，韵母 24 个。字词朗读由 Qwen3-TTS Serena 合成；声母、韵母发音素材来自 cmguo/PinYinSound。完整来源见项目源码中的“数据来源与许可.md”；拼音录音上游未声明许可证，不属于本项目代码的 MIT 授权范围。</p><p style="margin-top:15px;font-size:10px">字芽 v1.4.0 · 离线使用 · 无广告</p>`);
  }
  function history(){
    openModal('每一次进步，都记得',`<p>累计点亮 ${model.everCount()} 个字。每个字在每轮最多累计 1 次。</p>${model.rounds().slice().reverse().map(r=>`<div class="history-row"><span>第 ${r.id} 轮${r.endedAt?'':' · 进行中'}<small>${date(r.startedAt)}${r.endedAt?' — '+date(r.endedAt):' 开始'}</small></span><span><b>${r.count}</b> 字</span></div>`).join('')}`);
  }
  function exportRecords(){
    const text=storageError&&rawState?rawState:JSON.stringify(model.snapshot(),null,2);
    const filename=`字芽识字记录-${new Date().toISOString().slice(0,10)}.json`;
    if(window.Android){Android.exportBackup(text,filename);return;}
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('备份已交给浏览器下载，请妥善保存');
  }
  window.onBackupImported=function(text){
    try{
      text=text.replace(/^\uFEFF/,'');
      const value=ZiyaModel.validate(JSON.parse(text),new Set(DATA.map(d=>d.char))), last=value.rounds[value.rounds.length-1];
      openModal('恢复这份识字记录？',`<p>备份包含 <b>${value.rounds.length}</b> 轮测试，当前为第 <b>${last.id}</b> 轮，已认识 <b>${last.known.length}</b> 个字。</p><div class="warning">恢复将替换这台设备中的现有记录。建议先导出当前记录留作备份。</div>`,`<button class="button secondary" id="cancel-import">取消</button><button class="button" id="confirm-import">确认恢复</button>`);
      $('#cancel-import').onclick=closeModal;
      $('#confirm-import').onclick=()=>{
        const before=model.snapshot(),hadError=storageError;model.replace(value);storageError=false;
        if(!persist()){model.replace(before);storageError=hadError;return;}
        learning=model.options().learnGroup;stroke=model.options().stroke;learnSkipEnabled=model.options().learnSkipEnabled;learnSkipCount=model.options().learnSkipCount;visiblePages=1;closeModal();navigate(route,true);toast('识字记录已恢复');
      };
    }catch(e){toast(e instanceof SyntaxError?'不是有效的 JSON 备份文件':e.message);}
  };
  window.onNativeResult=function(message){toast(message);};
  window.handleAndroidBack=function(){if(!$('#modal').hidden){closeModal();return true;}if(route!=='test'){location.hash='test';return true;}return false;};
  $('#settings-button').onclick=settings;
  document.addEventListener('click',e=>{
    if(e.target.closest('#show-licenses'))openModal('开源许可',Object.entries(window.ZIYA_LICENSES||{}).map(([name,text])=>`<details style="margin-top:16px"><summary style="font-size:12px;color:var(--green);cursor:pointer">${esc(name)}</summary><pre style="font-size:10px;line-height:1.7;white-space:pre-wrap;word-break:break-word;user-select:text;color:var(--muted)">${esc(text)}</pre></details>`).join(''));
  });
  navigate(location.hash.slice(1)||'test');
  if(storageError)setTimeout(settings,400);
})();
