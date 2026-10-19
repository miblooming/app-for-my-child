import './style.css';
import './workspace.css';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { icon, portrait } from './art';
import { ACTORS, LEVELS, CONDITIONS, conditionValue, worldForLevel, prepareRetry, enabledActors, freshProgress, freshWorld, levelValue, packSave, readSave, recipe, resetActor, tick, applyProgramEdit, validateCommands, countCommands, programIssue, type Action, type ActorId, type Command, type Condition } from './model';
import { createTown } from './scene';
import { TownAudio } from './audio';
import { bindCommandDrag } from './drag';
import { narratedSteps } from './narration';
import {exampleProgram} from './levels';
import {commandAt,listAt,parsePath,selectionAfterRemoval,selectionAfterMove,executingPath,type CommandPath} from './program-editor';

const SAVE_KEY='qixiang.wonder-town.v1';
let raw:string|null=null;
try {raw=localStorage.getItem(SAVE_KEY);} catch { /* A restrictive browser can still play in memory. */ }
const restored=readSave(raw);
let world=restored?.world??freshWorld(),progress=restored?.progress??freshProgress();
let isLevelHome=true,homeCategory:'solo'|'pair'='solo';
let stepMode=false,stepping=false,stepTimer:ReturnType<typeof setTimeout>|undefined,manualTrackUntil=0;
let narrationCaption='';
let deleteMode=false,stepEpoch=0,narrationEpoch=0,narratingActor:ActorId|undefined;
const busyActors=new Set<ActorId>(),lastNotice=new Map<ActorId,string>();
let running=false,selectedChip:CommandPath|null=null,activeRepeat:CommandPath|null=null,clock=0,lastTime=0,lastSaved=0,storageFailed=false;
let history:{id:ActorId;program:Command[];actions:Action[];activeRepeat:CommandPath|null}[]=[];
let toastTimer:ReturnType<typeof setTimeout>;
const audio=new TownAudio();audio.enabled=progress.sound;
const root=document.querySelector<HTMLDivElement>('#app')!;
const esc=(value:string)=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
root.innerHTML=`
  <main>
    <header class="topbar"><div class="app-brand"><img src="${import.meta.env.BASE_URL}icon.svg" alt=""/><strong>编程小镇</strong></div><div class="header-tools"><button class="courses-button" data-action="levels" id="courses-button" aria-label="关卡选择" aria-pressed="true">${icon('flag',20)}<span>关卡</span></button><button class="icon-btn" data-action="menu" aria-label="小镇菜单">${icon('book',24)}</button><span class="save-indicator" id="save-state">${icon('check',16)} 已保存</span><button class="icon-btn" data-action="sound" id="sound-button" aria-label="关闭声音"></button><button class="icon-btn" data-action="help" aria-label="玩法帮助">${icon('help',25)}</button><button class="icon-btn" data-action="settings" aria-label="家长与设置">${icon('settings',25)}</button></div></header>
    <nav class="mode-nav" aria-label="游戏模式"><button data-action="adventure" id="adventure-nav">${icon('globe',21)} 小镇冒险</button><button data-action="creative" id="creative-nav">${icon('sparkles',21)} 自由创造</button><button class="journey-toggle" data-action="levels">${icon('book',21)} <span>关卡</span><span id="mobile-stars">0 / 7</span></button></nav>
    <div hidden><div id="level-list"></div><span id="journey-count"></span></div>
    <section class="level-home" id="level-home" aria-label="关卡首页"></section><div class="play-layout" hidden>
      <aside class="mission-column"><section class="mission-card"><div class="mission-meta"><span class="card-eyebrow">${icon('flag',18)} <span id="mission-number">01</span></span><span class="concept-tag" id="concept-tag"></span><span id="mission-art" hidden></span></div><h2 id="mission-title"></h2><p id="mission-description"></p><div class="mission-progress"><div><span id="mission-target"></span><b id="mission-count"></b></div><div class="progress-track"><i id="mission-progress-bar"></i></div><div class="progress-stars" hidden>${icon('star',18)}<span id="mission-reward"></span></div></div><button class="next-button" data-action="next" id="next-button" hidden>下一站 ${icon('arrow',20)}</button></section></aside>
      <section class="game-panel" aria-label="游戏小镇"><div class="scene-header"><div class="scene-heading"><strong id="scene-title">萝卜田的一天</strong><span id="scene-subtitle"></span></div><div class="scene-tools"><button class="icon-btn" data-action="hint" aria-label="任务与提示">${icon('flag',22)}</button><button class="icon-btn replay-guide-button" data-action="speak" aria-label="重新播放关卡说明" title="重新播放关卡说明">${icon('sound',22)}</button><span class="live-status" id="live-status"><i></i> 准备出发</span><button class="icon-btn active" data-action="grid" aria-label="隐藏网格" aria-pressed="true" id="grid-button">${gridIcon()}</button></div></div>
        <div class="scene-statusbar"><span class="grid-note" id="grid-note">每格 1 步</span><div class="world-pills"><span title="仓库里的萝卜">${icon('carrot',22)} <b id="stock-carrots">0</b></span><span title="取餐台上的热汤">${icon('pot',22)} <b id="stock-meals">0</b></span><span title="送给朋友的物资">${icon('heart',22)} <b id="stock-served">0</b></span><span id="defeated-pill" title="已清理的小怪物" hidden>${icon('star',22)} <b id="stock-defeated">0</b></span></div><div class="scene-paused" id="scene-paused" hidden>${icon('pause',18)} 已暂停</div></div>
        <div class="map-legend"><span class="walkable-key">浅色可走</span><span class="blocked-key">斜纹不可走</span><span class="station-key">绿框工作点</span></div><p class="scene-rule" id="scene-rule" hidden></p><div class="canvas-wrap"><div id="game-canvas"></div></div>
        <div class="scene-footer"><span id="scene-feedback">到工作点，伙伴会自动干活。</span><div class="scene-footer-actions"><button data-action="hint" class="text-button">${icon('sparkles',20)} 提示</button><button data-action="speak" class="text-button" aria-label="听一听关卡提示">${icon('sound',22)}</button></div></div>
      </section>
      <section class="editor-panel" aria-label="可视化指令编辑器"><div class="actor-tabs" id="actor-tabs" role="tablist" aria-label="选择编程角色"></div><div class="program-heading"><div><strong class="program-title" id="program-title"></strong><span class="command-count" id="command-count"></span></div><div class="program-actions"><button class="icon-btn" data-action="undo" aria-label="撤销修改" id="undo-button">${icon('undo',23)}</button><button class="clear-program-button" data-action="clear" id="clear-button" aria-label="清除全部指令" hidden>清除</button><button class="icon-btn" data-action="delete-mode" id="delete-mode-button" aria-label="进入删除模式" aria-pressed="false">${icon('trash',23)}</button></div></div>
        <p class="edit-tip" id="edit-tip"></p><p class="challenge-note" id="challenge-note" hidden></p><div class="track-scroller" id="track-scroller"><div class="program-track" id="program-track" aria-label="程序指令轨道"></div></div>
        <div class="palette-heading">点一个图标，添加指令</div><div class="palette" id="palette"></div>
        <div class="editor-footer"><div class="actor-status" id="actor-status"><i></i><span>准备出发</span></div><div class="run-controls"><button class="restart-button icon-btn" data-action="restart" aria-label="让所有伙伴回到起点">${icon('reset',24)}</button><button class="speed-button" data-action="speed" id="speed-button" aria-label="切换运行速度">1×</button><button class="step-mode-button" data-action="step-mode" id="step-mode-button" aria-pressed="false">步模式</button><button class="next-step-button" data-action="step" id="step-button" hidden>${icon('chevron',20)} 下一步</button><button class="run-button" data-action="run" id="run-button">${icon('play',23)}<span>开始运行</span></button></div></div>
      </section>
      <section class="learning-note"><span>${icon('leaf',24)}</span><div><strong>今天的小发现</strong><p id="concept-text"></p></div><button class="text-button" data-action="achievements">${icon('star',22)} 我的星星</button></section>
    </div>
  </main><div id="toast" class="toast" role="status"></div><div id="modal-root"></div>
`;

const $=<T extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
function gridIcon() {return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>';}
$('.scene-header').append($('#next-button'));
$('#track-scroller').addEventListener('wheel',()=>{manualTrackUntil=performance.now()+2500;},{passive:true});
const town=createTown($('#game-canvas'),{world:()=>world,progress:()=>progress,select:selectActor,station:stationInfo,canInteract:()=>!isLevelHome&&!$('#modal-root').children.length});

function save() {
  progress.programs[progress.creative?'creative':LEVELS[progress.level].id]=Object.fromEntries(enabledActors(progress).map(id=>[id,structuredClone(world.actors[id].program)]));
  try {localStorage.setItem(SAVE_KEY,JSON.stringify(packSave(world,progress)));lastSaved=Date.now();storageFailed=false;$('#save-state').innerHTML=icon('check',14)+' 已保存';}
  catch {if(!storageFailed)toast('浏览器没有存储空间，建议导出存档保存进度');storageFailed=true;$('#save-state').textContent='存档空间不足';}
}
function toast(message:string) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function refundAndHome(id:ActorId) {
  const a=world.actors[id];
  if(!progress.creative){prepareRetry(world,progress,id);applyProgramEdit(a,a.program);return;}
  if(a.carrying==='carrot')world.carrots++;if(a.carrying==='meal')world.meals++;resetActor(a,true);
}
function releaseDefeats(id?:ActorId){for(const monster of world.monsters)if(!id||monster.pendingBy===id)delete monster.pendingBy;}
function cancelNarration(){narrationCaption='';narrationEpoch++;audio.stop();busyActors.clear();releaseDefeats();if(narratingActor)town.scene.releaseActor(narratingActor);narratingActor=undefined;lastNotice.clear();}
function pause() {running=false;stepping=false;stepEpoch++;cancelNarration();clearTimeout(stepTimer);clock=0;town.scene.setRunning(false);renderRunning();}
function dependsOn(commands:Command[],changed:Set<string>,seen=new Set<string>()):boolean {
  return commands.some(c=>{
    if(c.type==='repeat')return dependsOn(c.body,changed,seen);
    if(c.type==='if')return dependsOn(c.body,changed,seen)||dependsOn(c.otherwise,changed,seen);
    if(c.type!=='call')return false;if(changed.has(c.actionId))return true;
    if(seen.has(c.actionId))return false;seen.add(c.actionId);
    return dependsOn(progress.actions.find(a=>a.id===c.actionId)?.body??[],changed,seen);
  });
}
function restartEditedProgram(id:ActorId,program:Command[],beforeActions?:Action[]) {
  pause();
  const changed=new Set((beforeActions??[]).concat(progress.actions).filter(a=>JSON.stringify(beforeActions?.find(b=>b.id===a.id))!==JSON.stringify(progress.actions.find(b=>b.id===a.id))).map(a=>a.id));
  for(const def of ACTORS) {
    if(def.id!==id&&(!beforeActions||!dependsOn(world.actors[def.id].program,changed)))continue;
    prepareRetry(world,progress,def.id);applyProgramEdit(world.actors[def.id],def.id===id?program:world.actors[def.id].program);town.scene.resetPosition(def.id);
  }
  clock=0;stepping=false;clearTimeout(stepTimer);town.scene.setRunning(running);
}
function edit(program:Command[],beforeActions?:Action[],nextActive=activeRepeat) {
  const id=progress.selected;
  if(program.length>48) {toast('一个程序最多放 48 条指令，试试用「重复」把它变短吧');return;}
  if(!validateCommands(program)){toast('重复最多嵌套 4 层，每个队列最多 48 条指令');return false;}
  history.push({id,program:structuredClone(world.actors[id].program),actions:structuredClone(beforeActions??progress.actions),activeRepeat:activeRepeat?[...activeRepeat]:null});history=history.slice(-40);
  activeRepeat=nextActive&&commandAt(program,nextActive)?.type==='repeat'?[...nextActive]:null;
  restartEditedProgram(id,program,beforeActions);save();renderEditor();renderWorld();town.scene.sync();
  return true;
}
function add(command:Command,beforeActions?:Action[]) {
  const program=structuredClone(world.actors[progress.selected].program);
  const parent=activeRepeat??[],list=listAt(program,parent)??program;
  if(list.length>=(parent.length?24:48)){toast(parent.length?'一个重复框里最多放 24 条指令':'一个程序最多放 48 条指令');return;}
  const path=[...parent,list.length];list.push(command);selectedChip=null;audio.effect('click');
  if(edit(program,beforeActions,command.type==='repeat'?path:activeRepeat))requestAnimationFrame(()=>revealPath(path));
}
function revealPath(path:CommandPath){
  const el=$('#program-track').querySelector<HTMLElement>(`.command-item[data-path="${path.join('.')}"]`);if(!el)return;
  const track=$('#track-scroller'),r=el.getBoundingClientRect(),bounds=track.getBoundingClientRect();
  if(r.right>bounds.right-12)track.scrollLeft+=Math.min(r.width,bounds.width-24)+r.left-bounds.right+16;
  else if(r.left<bounds.left+12)track.scrollLeft+=r.left-bounds.left-16;
}
function activateRepeat(path:CommandPath|null){activeRepeat=path;selectedChip=null;renderEditor();}
function removeCommand(path:CommandPath){const program=structuredClone(world.actors[progress.selected].program),list=listAt(program,path.slice(0,-1));if(!list)return;list.splice(path.at(-1)!,1);selectedChip=null;audio.effect('click');edit(program,undefined,selectionAfterRemoval(activeRepeat,path));}
function changeRepeatCount(path:CommandPath,delta:number){const program=structuredClone(world.actors[progress.selected].program),command=commandAt(program,path);if(command?.type!=='repeat')return;const count=Math.max(1,Math.min(9,command.count+delta));if(count===command.count)return;command.count=count;edit(program,undefined,path);}
function selectActor(id:ActorId) {
  if(!enabledActors(progress).includes(id)) {toast('这个伙伴不参加当前关卡');return;}
  cancelNarration();progress.selected=id;selectedChip=null;activeRepeat=null;deleteMode=false;audio.effect('click');renderEditor();town.scene.sync();save();
}
function renderAll() {renderLevels();renderMission();renderEditor();renderWorld();renderRunning();town.scene.sync();}
function renderHome(){
  const solo=homeCategory==='solo',levels=LEVELS.map((l,index)=>({l,index})).filter(({l})=>(l.roles.length===1)===solo);
  const soloCount=LEVELS.filter(l=>l.roles.length===1).length,pairCount=LEVELS.length-soloCount;
  const cards=levels.map(({l,index})=>{
    const current=!progress.creative&&progress.level===index,done=progress.completed.includes(index);
    return `<button class="course-card ${done?'complete':''} ${current?'current':''}" data-action="level" data-level="${index}" ${current?'aria-current="step"':''} aria-label="${l.roles.length===1?'单人':'双人'}关卡 ${esc(l.title)}">
      <span class="course-number">${String(index+1).padStart(2,'0')}</span>${current?'<span class="course-current">当前关卡</span>':''}<span class="course-star">${icon(done?'star':'flag',22)}</span>
      <div class="course-portraits">${l.roles.map(r=>portrait(r.id)).join('')}</div><strong>${esc(l.title)}</strong>
      <span class="course-people">${l.roles.map(r=>ACTORS.find(a=>a.id===r.id)!.name).join(' · ')} · ${l.roles.map(r=>r.route.length+'步').join(' / ')}</span><small>${esc(l.tag)}${l.goal>1?' · '+l.goal+'轮':''}</small></button>`;
  }).join('');
  $('#level-home').innerHTML=`<div class="home-intro"><span class="home-eyebrow">${icon('leaf',18)} 奇想学园 · 编程小镇</span><h1>${solo?'一个伙伴，一个小挑战':'两个伙伴，一起完成'}</h1><p>${solo?'先从单人关卡练习方向、转弯和判断。':'给两位伙伴分别编程，接力传送物资，或由卫士开路护送。'}</p></div>
    <div class="course-tabs" role="tablist" aria-label="关卡人数"><button data-action="course-solo" role="tab" aria-selected="${solo}" class="${solo?'active':''}">单人关卡 <span>${soloCount}</span></button><button data-action="course-pair" role="tab" aria-selected="${!solo}" class="${!solo?'active':''}">双人关卡 <span>${pairCount}</span></button></div>
    <button class="continue-course" data-action="continue-level">${icon('play',22)}<span>${progress.creative?'继续自由创造':'继续：'+esc(LEVELS[progress.level].title)}</span>${icon('chevron',20)}</button><div class="course-grid">${cards}</div><p class="home-footnote">每关独立准备起点和物资，进入关卡从空队列开始。所有关卡都可以选择。</p>`;
  root.classList.toggle('on-level-home',isLevelHome);$('#courses-button').setAttribute('aria-pressed',String(isLevelHome));
}
function showLevelHome(category=homeCategory){pause();save();homeCategory=category;isLevelHome=true;closeModal();$('#level-home').hidden=false;$('.play-layout').hidden=true;renderHome();window.scrollTo(0,0);}
function hideLevelHome(){isLevelHome=false;$('#level-home').hidden=true;$('.play-layout').hidden=false;root.classList.remove('on-level-home');$('#courses-button').setAttribute('aria-pressed','false');window.scrollTo(0,0);requestAnimationFrame(()=>town.game.scale.refresh());}
function renderLevels() {
  $('#adventure-nav').classList.toggle('active',!progress.creative);$('#creative-nav').classList.toggle('active',progress.creative);
  $('#level-list').innerHTML='';$('#journey-count').textContent=`${progress.completed.length} / ${LEVELS.length}`;$('#mobile-stars').textContent=`${progress.completed.length} / ${LEVELS.length}`;
  $('#sound-button').innerHTML=icon(progress.sound?'sound':'mute',21);$('#sound-button').setAttribute('aria-label',progress.sound?'关闭声音':'打开声音');renderHome();
}
function renderMission() {
  const level=LEVELS[progress.level];
  $('.canvas-wrap').style.setProperty('--map-cols',String(world.board.cols));$('.canvas-wrap').style.setProperty('--map-rows',String(world.board.rows));$('.game-panel').classList.toggle('long-map',world.board.rows>9);
  const rule=root.querySelector<HTMLElement>('#scene-rule');if(rule){rule.hidden=!world.gates.length&&!world.monsters.length;rule.textContent=world.monsters.length?'闪闪进入怪物格会自动清理，伙伴等安全后通过':'小车按节拍移动，先用如果判断，再走或等待';$('.game-panel').style.setProperty('--map-toolbar-height',rule.hidden?'110px':'135px');}
  $('#scene-title').textContent=progress.creative?'我的奇想小镇':level.title;
  $('#scene-subtitle').textContent=progress.creative?'自由创造':`第 ${progress.level+1} 站 · ${level.target}`;
  $('#mission-number').textContent=progress.creative?'∞':String(progress.level+1).padStart(2,'0');
  $('#mission-art').innerHTML=level.roles.map(r=>portrait(r.id)).join('');
  $('#concept-tag').textContent=progress.creative?'无限的可能':level.tag;
  $('#mission-title').textContent=progress.creative?'今天，创造什么呢？':level.title;
  $('#mission-description').textContent=progress.creative?'所有伙伴和指令都准备好了，编写属于你的小镇故事吧。':level.intro;
  $('#mission-target').textContent=progress.creative?'已送出的温暖':level.target;
  $('#concept-text').textContent=progress.creative?'试试用不同的方法，让小镇更顺畅地运转。米米采集、布布做汤、点点送餐、闪闪巡逻，到达工作点或怪物所在格就会自动行动。':level.concept;
  renderMissionProgress();
}
function renderMissionProgress() {
  const level=LEVELS[progress.level],value=progress.creative?world.stats.served:Math.min(level.goal,levelValue(world,progress.level)),done=progress.completed.includes(progress.level);
  $('#mission-count').textContent=progress.creative?`${value} 碗`:`${value} / ${level.goal}`;
  $('#scene-subtitle').textContent=progress.creative?`自由创造 · 已送出 ${value} 碗汤`:level.roles.map(r=>`${ACTORS.find(a=>a.id===r.id)!.name} ${Math.min(level.goal,world.successes[r.id])}/${level.goal}轮`).join(' · ');
  $('#mission-progress-bar').style.width=`${progress.creative?100:Math.min(100,value/level.goal*100)}%`;
  $('#mission-reward').textContent=progress.creative?'每一碗汤，都有你的创意':done?'小星星已点亮！':'完成后点亮小星星';
  $('.progress-stars').classList.toggle('earned',done||progress.creative);
  $('#next-button').hidden=!done||progress.creative;
  $('.mission-card').classList.toggle('completed',done&&!progress.creative);
  $('#next-button').innerHTML='选下一关'+icon('arrow',18);
}
function description(command:Command):{label:string;icon:string;color:string;detail?:string} {
  if(command.type==='move')return {label:{up:'向上',down:'向下',left:'向左',right:'向右'}[command.direction],icon:command.direction,color:'move'};
  if(command.type==='wait')return {label:'等一等',icon:'clock',color:'wait'};
  if(command.type==='repeat')return {label:`重复 ${command.count} 次`,icon:'repeat',color:'repeat',detail:`${command.body.length} 个动作`};
  if(command.type==='if')return {label:'如果…',icon:'branch',color:'condition',detail:CONDITIONS.find(c=>c.id===command.condition)!.label};
  return {label:progress.actions.find(a=>a.id===command.actionId)?.name??'组合动作',icon:'sparkles',color:'call'};
}
function commandChip(command:Command,index:number,context='track',path:CommandPath=[index]):string {
  const d=description(command),inline=context!=='nested',deleting=inline?deleteMode:draftDeleteMode,key=path.join('.');
  if(command.type==='repeat'&&inline){
    const selected=activeRepeat?.join('.')===key;
    return `<div class="command-item repeat-group ${selected?'insertion-active':''} ${deleting?'delete-ready':''}" data-scope="${context}" data-index="${index}" data-path="${key}" role="group" aria-label="重复 ${command.count} 次指令框"><div class="repeat-body" data-action="repeat-select" data-path="${key}">${command.body.map((c,i)=>commandChip(c,i,`repeat:${key}`,[...path,i])+'<span class="track-connector"></span>').join('')}<button class="${command.body.length?'repeat-insert':'repeat-empty'}" data-action="repeat-select" data-path="${key}" aria-label="向此重复框添加指令" aria-pressed="${selected}">${icon('plus',24)}${command.body.length?'':'<small>点指令加入</small>'}</button></div><div class="repeat-rail"><button class="repeat-adjust" data-action="repeat-less" data-path="${key}" aria-label="减少重复次数" ${command.count===1?'disabled':''}>−</button><button class="repeat-drag-handle" data-action="repeat-select" data-path="${key}" aria-pressed="${selected}" aria-label="重复 ${command.count} 次，点击激活，长按移动整个框">重复 <b>${command.count}</b> 次</button><button class="repeat-adjust" data-action="repeat-more" data-path="${key}" aria-label="增加重复次数" ${command.count===9?'disabled':''}>+</button></div>${deleting?`<button class="repeat-delete" data-action="repeat-delete" data-path="${key}" aria-label="删除此重复框及其中指令">${icon('trash',19)}</button>`:''}</div>`;
  }
  const complex=['if','call'].includes(command.type);
  return `<div class="command-item" data-scope="${context}" data-index="${index}" data-path="${key}"><button class="command-chip ${d.color} ${deleting?'delete-ready':''}" data-action="${inline?'chip':'nested-chip'}" data-index="${index}" data-path="${key}" aria-label="第${index+1}条 ${esc(d.label)}，${deleting?'点击删除':'长按排序，删除请先开启删除模式'}"><span class="chip-number">${index+1}</span>${deleting?'<i class="delete-mark" aria-hidden="true">−</i>':''}${icon(d.icon,30)}<span>${esc(d.label)}</span>${d.detail?`<small>${esc(d.detail)}</small>`:''}</button>${complex&&inline?`<button class="chip-config" data-action="chip-config" data-index="${index}" data-path="${key}" aria-label="编辑第${index+1}条${esc(d.label)}">${icon('edit',19)} 编辑</button>`:''}</div>`;
}
function renderEditor() {
  const def=ACTORS.find(a=>a.id===progress.selected)!,actor=world.actors[progress.selected],enabled=enabledActors(progress);
  if(activeRepeat&&commandAt(actor.program,activeRepeat)?.type!=='repeat')activeRepeat=null;
  $('#actor-tabs').innerHTML=enabled.map(id=>ACTORS.find(a=>a.id===id)!).map(a=>`<button class="actor-tab ${progress.selected===a.id?'active':''} ${!enabled.includes(a.id)?'locked':''}" role="tab" aria-selected="${progress.selected===a.id}" data-action="actor" data-actor="${a.id}" aria-label="${a.name} ${a.role}${enabled.includes(a.id)?'':' 尚未解锁'}">${portrait(a.id)}<span><strong>${a.name}</strong><small>${a.role.replace(/^小./,'')}</small></span>${!enabled.includes(a.id)?icon('lock',18):''}</button>`).join('');
  $('#program-title').textContent=`${def.name}的小程序`;$('#command-count').textContent=world.commandLimit?`${countCommands(actor.program)} / ${world.commandLimit} 格`:`${actor.program.length} 条`;$('#command-count').classList.toggle('over-budget',!!world.commandLimit&&countCommands(actor.program)>world.commandLimit);
  $('#program-track').innerHTML=`<button class="start-node" data-action="append" aria-label="开始，重置人物坐标；点击选择主队列">${icon('flag',20)}<small>开始</small></button><span class="track-connector"></span>${actor.program.length?actor.program.map((c,i)=>commandChip(c,i)+'<span class="track-connector"></span>').join(''):'<div class="empty-track">'+icon('plus',27)+'<span>点下方图标<br><small>排好出发的方向</small></span></div>'}<button class="add-node" data-action="append" aria-label="在程序末尾添加指令">${icon('plus',24)}</button><span class="loop-end">${icon('home',23)}<small>回起点</small></span>`;
  const advanced=progress.creative?3:LEVELS[progress.level].skill;
  const commands:Command[]=[...(['up','down','left','right'] as const).map(direction=>({type:'move' as const,direction})),{type:'wait'},{type:'repeat',count:3,body:[]},{type:'if',condition:'carrying',body:[],otherwise:[]},{type:'call',actionId:'right3'}];
  $('#palette').innerHTML=commands.map((command,i)=>{const d=description(command),locked=i===5?advanced<1:i===6?advanced<2:i===7?advanced<3:false;return `<button class="palette-command ${d.color} ${locked?'locked':''}" data-action="palette" data-command="${i}" aria-label="${i===5?'重复':i===6?'如果':i===7?'组合':d.label}${locked?' 在相应练习关卡使用':''}">${icon(locked?'lock':d.icon,30)}<span>${i===5?'重复':i===6?'如果':i===7?'组合':d.label}</span></button>`;}).join('');
  $('.editor-panel').classList.toggle('delete-mode',deleteMode);
  $('#delete-mode-button').setAttribute('aria-pressed',String(deleteMode));$('#delete-mode-button').setAttribute('aria-label',deleteMode?'完成删除':'进入删除模式');$('#delete-mode-button').innerHTML=icon(deleteMode?'check':'trash',23);
  $('#clear-button').hidden=!deleteMode;$('#clear-button').toggleAttribute('disabled',!actor.program.length);
  $('#edit-tip').textContent=deleteMode?'删除模式：点指令删除 · 清除可一键清空':'左右滑动 · 长按排序 · 垃圾桶开启删除';
  const target=activeRepeat?commandAt(actor.program,activeRepeat):null;
  $('.palette-heading').innerHTML=target?.type==='repeat'?`<span>添加到：重复 ${target.count} 次框内</span><button data-action="append" class="leave-repeat">回到主队列</button>`:'<span>点一个图标，添加到主队列</span>';
  $('#program-track').classList.toggle('has-repeat',!!$('#program-track').querySelector('.repeat-group'));
  const technique=actor.required==='both'?'重复 + 如果':actor.required==='repeat'?'重复':actor.required==='if'?'如果':'';
  $('#challenge-note').hidden=!technique&&!world.commandLimit;$('#challenge-note').textContent=`${technique?'本关练习：'+technique+'。':''}${world.commandLimit?'最多 '+world.commandLimit+' 格，框内指令也计数。':''}`;
  $('#undo-button').toggleAttribute('disabled',!history.length);renderActorStatus();renderRunning();renderExecutionHighlight(false);
}

function renderWorld() {
  $('#stock-carrots').textContent=String(world.carrots);$('#stock-meals').textContent=String(world.meals);$('#stock-served').textContent=String(world.stats.served+world.stats.deliveredCarrots);$('#stock-defeated').textContent=String(world.stats.defeated);$('#defeated-pill').hidden=!world.monsters.length&&progress.selected!=='fox';
  renderMissionProgress();renderActorStatus();renderConditionState();
}
function renderActorStatus() {
  const a=world.actors[progress.selected];
  $('#actor-status').className=`actor-status ${a.status}`;
  $('#actor-status').innerHTML=`<i></i><span>${esc(narratingActor===progress.selected&&narrationCaption?narrationCaption:a.message)}</span>`;
}
function renderExecutionHighlight(follow=true) {
  const track=$('#track-scroller');
  const actor=world.actors[progress.selected],start=$('.start-node'),atStart=!!actor.program.length&&actor.current===-1&&!actor.startPending;
  start.classList.toggle('executing',atStart);if(atStart)start.setAttribute('aria-current','step');else start.removeAttribute('aria-current');
  let active:HTMLElement|undefined=atStart?start:undefined;
  const path=executingPath(actor),key=path?.join('.');
  for(const el of $('#program-track').querySelectorAll<HTMLElement>('.command-chip')) {
    const on=el.dataset.path===key;el.classList.toggle('executing',on);
    if(on){el.setAttribute('aria-current','step');active=el;}else el.removeAttribute('aria-current');
  }
  for(const group of $('#program-track').querySelectorAll<HTMLElement>('.repeat-group')){
    const on=!!key&&(key===group.dataset.path||key.startsWith(group.dataset.path+'.'));group.classList.toggle('executing',on);
    if(on&&key===group.dataset.path){active=group;group.setAttribute('aria-current','step');}else group.removeAttribute('aria-current');
  }
  if(follow&&active&&performance.now()>manualTrackUntil&&!document.body.classList.contains('command-dragging')) {
    const r=active.getBoundingClientRect(),bounds=track.getBoundingClientRect();
    if(r.right>bounds.right-12)track.scrollLeft+=r.right-bounds.right+16;
    else if(r.left<bounds.left+12)track.scrollLeft+=r.left-bounds.left-16;
  }
}
function renderRunning() {
  $('#run-button').innerHTML=icon(running?'pause':'play',20)+`<span>${running?'暂停':stepMode?'连续运行':'开始运行'}</span>`;$('#run-button').classList.toggle('is-running',running);
  $('#live-status').innerHTML=`<i></i> ${running?'正在运行':stepMode?'一步一步':'准备出发'}`;$('#live-status').classList.toggle('running',running);
  $('#speed-button').textContent=`${progress.speed}×`;
  $('#scene-paused').hidden=running||stepping||world.ticks===0;
  $('#scene-paused').innerHTML=icon(stepMode?'chevron':'pause',18)+(stepMode?'步模式':'已暂停');
  $('#step-mode-button').setAttribute('aria-pressed',String(stepMode));
  $('#step-mode-button').classList.toggle('active',stepMode);
  $('#step-button').hidden=!stepMode;$('#step-button').toggleAttribute('disabled',stepping);
  $('.editor-footer').classList.toggle('step-mode',stepMode);
}
function advanceWorld():Promise<void> {
  const id=progress.selected,before=structuredClone(world.actors[id]);
  const events=tick(world,progress,{skipActors:busyActors,narrateActor:progress.sound?id:undefined});
  const selected=events.filter(e=>e.actor===id),notice=selected.find(e=>e.kind==='blocked'||e.kind==='lesson'||e.retry);
  let steps=narratedSteps(events,before,world.actors[id]);
  if(notice){const key=notice.kind+notice.message;if(lastNotice.get(id)===key)steps=[];else lastNotice.set(id,key);}
  else if(selected.length)lastNotice.delete(id);
  const spoken=progress.sound&&steps.length>0;
  if(spoken)for(const e of selected)if(e.kind==='attack'&&e.position)town.scene.deferDefeat(e.position);
  for(const e of events)if(e.kind==='reset'&&(!spoken||e.actor!==id))town.scene.resetPosition(e.actor);
  town.scene.showEvents(spoken?events.filter(e=>e.actor!==id):events);
  let narration=Promise.resolve();
  if(spoken){
    const epoch=narrationEpoch;busyActors.add(id);narratingActor=id;town.scene.presentActor(id,before);
    narration=audio.narrate(steps.map(step=>({id:step.voice,onStart:()=>{
      if(epoch!==narrationEpoch)return;
      narrationCaption=step.event.message;renderActorStatus();
      if(step.event.kind==='attack')releaseDefeats(id);
      if(step.event.kind==='reset')town.scene.resetPosition(id);
      town.scene.presentActor(id,step.presentation);town.scene.showEvents([step.event]);
    }}))).finally(()=>{if(epoch===narrationEpoch){releaseDefeats(id);busyActors.delete(id);town.scene.releaseActor(id);narratingActor=undefined;narrationCaption='';renderActorStatus();}});
  }
  town.scene.sync();renderWorld();renderExecutionHighlight();
  const selectedEvent=selected.at(-1);if(selectedEvent)$('#scene-feedback').textContent=selectedEvent.message;
  if(events.some(e=>e.kind==='serve'))audio.effect('serve');else if(events.some(e=>e.kind==='collect'||e.kind==='cook'))audio.effect('collect');
  celebrate();return narration;
}
function stepOnce() {
  if(stepping)return;
  if(!enabledActors(progress).some(id=>world.actors[id].program.length)){toast('先放入一条指令，再试试下一步');return;}
  if(!readyToExecute())return;
  pause();const epoch=++stepEpoch;stepMode=true;stepping=true;town.scene.setRunning(true);
  const narration=advanceWorld(),animation=new Promise<void>(resolve=>{stepTimer=setTimeout(resolve,360);});renderRunning();save();
  void Promise.all([narration,animation]).then(()=>{if(epoch!==stepEpoch)return;stepping=false;town.scene.setRunning(false);renderRunning();});
}
function readyToExecute(){
  for(const id of enabledActors(progress)){const a=world.actors[id];if(!a.program.length)continue;const issue=programIssue(a,world);if(!issue)continue;pause();progress.selected=id;renderEditor();toast(issue==='limit'?`本关最多 ${world.commandLimit} 格，试试用重复缩短程序`:issue==='repeat'?'本关练习重复：把相同的一组动作装进重复框':'本关练习如果：先判断旁边是否安全再行动');audio.speak(`action-try-${issue}`);return false;}
  return true;
}
function setLevel(index:number) {
  if(!Number.isInteger(index)||!LEVELS[index])return;
  pause();save();deleteMode=false;progress.level=index;progress.creative=false;selectedChip=null;activeRepeat=null;history=[];
  const level=LEVELS[index];world=worldForLevel(index);progress.programs[level.id]={};progress.selected=level.roles[0].id;homeCategory=level.roles.length===1?'solo':'pair';
  ACTORS.forEach(a=>town.scene.resetPosition(a.id));closeModal();hideLevelHome();renderAll();save();audio.speak(`guide-${level.id}`);
}
function nextCourse(){const same=LEVELS.map((l,i)=>({l,i})).filter(({l})=>l.roles.length===LEVELS[progress.level].roles.length),next=same.find(({i})=>i>progress.level);if(next)setLevel(next.i);else showLevelHome(LEVELS[progress.level].roles.length===1?'pair':'solo');}
function creative() {
  pause();save();progress.creative=true;deleteMode=false;selectedChip=null;activeRepeat=null;history=[];world=freshWorld();
  world.sites.push({name:'exit',...world.actors.fox.target,label:'出口',art:'shield'});
  for(const def of ACTORS)world.actors[def.id].program=structuredClone(progress.programs.creative?.[def.id]??[]);
  ACTORS.forEach(a=>town.scene.resetPosition(a.id));closeModal();hideLevelHome();renderAll();save();toast('欢迎来到自由创造！所有伙伴和指令都已开放。');
}
function stationInfo(name:string) {
  if(name==='exit'){openModal('闪闪的巡逻出口','<p class="modal-intro">先清理场上的全部小怪物，再走到出口。闪闪进入怪物同一格时会自动清理，其他伙伴要等待安全后才能通过。</p>',[{text:'我知道啦',action:closeModal}]);return;}
  const info:Record<string,[string,string,string]>={farm:['萝卜田','carrot','这是米米采萝卜的地方。本关起点看地图中的“起点”标记，目的地是仓库。'],store:['萝卜仓库','home',`米米到这里自动存萝卜，布布或接力关卡中的点点来取萝卜。现在有 ${world.carrots} 颗，没有萝卜时伙伴会等待。`],kitchen:['暖暖厨房','pot','布布拿着萝卜到这里自动做汤，热汤会放到取餐台。请按本关起点数格子。'],counter:['取餐台','pot',`点点会自动取汤，再按程序出发。现在有 ${world.meals} 碗；没有汤就原地等待。`],customer:['朋友的花园','heart','点点到这里自动交付手中的物资，可能是热汤或接力送来的萝卜。走完程序要停在目的地，下一轮会回到本关起点。']};
  const [title,i,body]=info[name];openModal(`${icon(i,27)} ${title}`,`<p class="modal-intro">${body}</p>`,[{text:'我知道啦',action:closeModal}]);
}

let modalCleanup:(()=>void)|undefined;
function closeModal() {modalCleanup?.();modalCleanup=undefined;$('#modal-root').innerHTML='';}
function openModal(title:string,body:string,buttons:{text:string;action:()=>void;secondary?:boolean}[]=[],wide=false) {
  modalCleanup?.();const previous=document.activeElement as HTMLElement;
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/<[^>]*>/g,''))}"><button class="modal-close icon-btn" data-action="modal-close" aria-label="关闭窗口">${icon('close',22)}</button><h2>${title}</h2>${body}<div class="modal-buttons">${buttons.map((b,i)=>`<button class="${b.secondary?'secondary':'primary'}" data-modal-button="${i}">${b.text}</button>`).join('')}</div></section></div>`;
  buttons.forEach((b,i)=>$(`[data-modal-button="${i}"]`).addEventListener('click',b.action));
  const trap=(event:KeyboardEvent)=>{
    if(event.key==='Escape'){closeModal();return;}
    if(event.key==='Tab'){
      const focusable=Array.from($('#modal-root').querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea')),first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  };
  document.addEventListener('keydown',trap);modalCleanup=()=>{document.removeEventListener('keydown',trap);previous?.focus();};
  requestAnimationFrame(()=>$('#modal-root').querySelector<HTMLElement>('button')?.focus());
}
function help() {
  openModal('排好方向，小伙伴就出发',`<div class="help-steps"><div><span>1</span>${portrait('rabbit')}<strong>选一个小伙伴</strong><p>米米采集，布布做饭，点点送餐，闪闪清理怪物。</p></div><div><span>2</span><div class="help-arrows">${icon('right',30)}${icon('right',30)}${icon('right',30)}</div><strong>添加方向指令</strong><p>按住片刻，再拖动，就能排序。先点垃圾桶进入删除模式，再点指令删除；清除按钮可一次清空，撤销在两种模式下都能用。点重复会直接生成指令框，选中后新增指令进入框内，底边可调整次数；点主队列退出。条件和组合点铅笔编辑。</p></div><div><span>3</span><div class="help-play">${icon('play',40)}</div><strong>到站，自动工作</strong><p>不用额外操作。每轮结束自动回起点，继续下一轮；缺少食材就等一等。每次修改指令都会暂停，伙伴回到起点；再点运行或下一步才会执行。已有物品与成果保留。点「步模式」，先点「下一步」执行开始、重置坐标，再点一次才执行第一条指令；绿框会跟着每一步。</p></div></div>`,[{text:'开始我的小镇冒险',action:closeModal}],true);audio.speak('help');
}
function hint() {
  const level=LEVELS[progress.level],program=progress.creative?recipe(progress.selected):exampleProgram(progress.level,progress.selected).flatMap(c=>c.type==='call'&&!progress.actions.some(a=>a.id===c.actionId)?recipe(progress.selected):[c]);
  const replay=`<button class="guide-replay" data-action="speak">${icon('sound',21)} 重新播放关卡说明</button>`;
  openModal('给想法一点小灵感',`<p class="modal-intro">${progress.creative?'按地图格子到达职业目的地：米米去仓库，布布去厨房，点点去花园，闪闪去巡逻出口。':esc(level.intro)}</p>${replay}<div class="hint-route">${program.map(c=>`<span class="hint-step ${description(c).color}">${icon(description(c).icon,30)}<small>${esc(description(c).label)}</small></span>`).join(icon('chevron',19))}</div><p class="gentle-note">${esc(level.concept)}<br>程序走完仍未停在目的地，会提示任务失败。</p>`,[{text:'我来试一试',secondary:true,action:closeModal},{text:'放入示例程序',action:()=>{closeModal();selectedChip=null;edit(program,undefined,null);toast('示例放好了！先执行开始，再观察每一步。');}}]);audio.speak(progress.creative?'welcome':`guide-${level.id}`);
}
function replayGuide(){
  pause();
  if(!progress.sound){toast('声音已关闭，请先点顶部声音按钮打开声音');return;}
  audio.speak(progress.creative?'welcome':`guide-${LEVELS[progress.level].id}`);
}
function celebrate() {
  if(progress.creative||progress.completed.includes(progress.level)||levelValue(world,progress.level)<LEVELS[progress.level].goal)return;
  progress.completed.push(progress.level);save();renderLevels();renderMissionProgress();audio.effect('success');
  openModal('一个小想法，点亮一颗星！',`<div class="success-art">${icon('star',72)}<span>✦</span><span>✧</span></div><p class="success-title">${esc(LEVELS[progress.level].title)} · 完成啦</p><p class="modal-intro">参加本关的伙伴都完成了目标。可以继续观察，也可以去选下一个挑战。</p><div class="reward-pill">${icon('gift',20)} 已点亮 ${progress.completed.length} / ${LEVELS.length} 颗星星</div>`,[{text:'再看小镇一会儿',secondary:true,action:closeModal},{text:'选下一关',action:nextCourse}]);audio.speak('success');
}

// Complex commands are edited in their own workspace to keep the main track small.
let draft:Command|null=null,draftIndex:CommandPath|null=null,draftBranch:'body'|'otherwise'='body',draftSelected:number|null=null;
let draftDeleteMode=false,draftHistory:Command[]=[];
function rememberDraft(){if(draft){draftHistory.push(structuredClone(draft));draftHistory=draftHistory.slice(-40);}}
let draftMode:'repeat'|'if'|'action'='repeat';let actionEditId:string|null=null,draftName='我的拿手动作';
function complexEditor(mode:'repeat'|'if'|'action',index:CommandPath|null=null) {
  pause();
  draftDeleteMode=false;draftHistory=[];draftIndex=index;draftBranch='body';draftSelected=null;draftMode=mode;actionEditId=null;
  const existing=index!==null?commandAt(world.actors[progress.selected].program,index):undefined;
  if(mode==='repeat')draft=existing?.type==='repeat'?structuredClone(existing):{type:'repeat',count:3,body:[{type:'move',direction:'right'}]};
  else if(mode==='if'){const direction=(!progress.creative?LEVELS[progress.level].roles.find(r=>r.id===progress.selected)?.route[0]:undefined)??(progress.selected==='rabbit'?'right':progress.selected==='bear'||progress.selected==='fox'?'down':'left');draft=existing?.type==='if'?structuredClone(existing):{type:'if',condition:`${direction}-clear`,body:[{type:'move',direction}],otherwise:[{type:'wait'}]};}
  else {draft={type:'repeat',count:1,body:[{type:'move',direction:'right'}]};draftName='我的拿手动作';}
  renderComplex();
}
function draftCommands():Command[] {if(draft?.type==='repeat')return draft.body;if(draft?.type==='if')return draft[draftBranch];return [];}
function renderComplex() {
  if(!draft)return;
  const title=draftMode==='action'?'把动作，装进一个名字':draft.type==='repeat'?'重复的魔法':'先想一想，再行动';
  const controls=draftMode==='action'?`<label class="field-label">动作的名字<input id="action-name" maxlength="24" value="${esc(draftName)}" placeholder="给这组动作起个名字"/></label>`:draft.type==='repeat'?`<div class="repeat-count">把下面的动作重复 <button data-action="count-minus" aria-label="减少重复次数">−</button><b>${draft.count}</b><button data-action="count-plus" aria-label="增加重复次数">+</button> 次</div>`:draft.type==='if'?`<label class="field-label inline">如果<select id="condition-select">${[...new Set(CONDITIONS.map(c=>c.group))].map(group=>`<optgroup label="${group}">${CONDITIONS.filter(c=>c.group===group).map(c=>`<option value="${c.id}" ${draft?.type==='if'&&draft.condition===c.id?'selected':''}>${c.label}</option>`).join('')}</optgroup>`).join('')}</select></label><div class="condition-explainer"><p>${CONDITIONS.find(c=>draft?.type==='if'&&c.id===draft.condition)?.description}</p><span id="condition-current"></span><small>执行到这里时，会按人物当时的位置重新判断。</small></div><div class="branch-tabs"><button data-action="branch-body" class="${draftBranch==='body'?'active':''}">${icon('check',16)} 就这样做</button><button data-action="branch-otherwise" class="${draftBranch==='otherwise'?'active':''}">否则这样做</button></div>`:'';
  const body=draftCommands();
  openModal(title,`${controls}<p class="small-instruction">点下面的图标添加动作，长按拖动排序。</p><div class="draft-toolbar ${draftDeleteMode?'delete-mode':''}"><span>${draftDeleteMode?'删除模式：点动作删除':'先点垃圾桶，再删除动作'}</span><button class="icon-btn" data-action="draft-undo" aria-label="撤销动作修改" ${draftHistory.length?'':'disabled'}>${icon('undo',22)}</button><button class="clear-program-button" data-action="draft-clear" aria-label="清除当前分支全部动作" ${draftDeleteMode?'':'hidden'} ${body.length?'':'disabled'}>清除</button><button class="icon-btn" data-action="draft-delete-mode" aria-label="${draftDeleteMode?'完成动作删除':'进入动作删除模式'}" aria-pressed="${draftDeleteMode}">${icon(draftDeleteMode?'check':'trash',22)}</button></div><div class="nested-track">${body.length?body.map((c,i)=>commandChip(c,i,'nested')).join(''):'<p>这里还是空的，放进一个动作吧</p>'}</div><div class="nested-palette">${(['up','down','left','right','clock'] as const).map((name,i)=>`<button data-action="nested-add" data-command="${i}">${icon(name,24)}<span>${['向上','向下','向左','向右','等待'][i]}</span></button>`).join('')}</div>${draftMode==='action'?'<p class="gentle-note">存好后，这个动作会放进当前小伙伴的程序里。</p>':''}`, [{text:'取消',secondary:true,action:closeModal},{text:draftMode==='action'?'保存并放入程序':'完成，放进程序',action:saveComplex}],true);
  renderConditionState();
  $('#modal-root').querySelector<HTMLInputElement>('#action-name')?.addEventListener('input',e=>{draftName=(e.target as HTMLInputElement).value;});
  $('#modal-root').querySelector<HTMLSelectElement>('#condition-select')?.addEventListener('change',e=>{if(draft?.type==='if'){rememberDraft();draft.condition=(e.target as HTMLSelectElement).value as Condition;renderComplex();}});
}
function renderConditionState(){const el=root.querySelector<HTMLElement>('#condition-current');if(el&&draft?.type==='if'){const result=conditionValue(draft.condition,world.actors[progress.selected],world);el.textContent=result?'现在成立 → 就这样做':'现在不成立 → 否则这样做';el.className=result?'condition-yes':'condition-no';}}
function saveComplex() {
  if(!draft)return;
  if(!draftCommands().length&&draft.type==='repeat'){toast('先放进至少一个动作吧');return;}
  if(draftIndex===null&&!activeRepeat&&world.actors[progress.selected].program.length>=48){toast('一个程序最多放 48 条指令');return;}
  const beforeActions=structuredClone(progress.actions);
  let command=structuredClone(draft);
  if(draftMode==='action') {
    if(!draftName.trim()){toast('给拿手动作起个名字吧');return;}
    if(progress.actions.length>=20&&!actionEditId){toast('最多保存 20 个拿手动作');return;}
    const action={id:actionEditId??`action-${Date.now()}`,name:draftName.trim().slice(0,24),body:structuredClone(draftCommands())};
    if(actionEditId)progress.actions[progress.actions.findIndex(a=>a.id===actionEditId)]=action;else progress.actions.push(action);
    command={type:'call',actionId:action.id};
  }
  closeModal();
  if(draftIndex!==null){const program=structuredClone(world.actors[progress.selected].program),list=listAt(program,draftIndex.slice(0,-1));if(list)list[draftIndex.at(-1)!]=command;selectedChip=null;edit(program,beforeActions);} else add(command,beforeActions);
}
function actionsLibrary() {
  openModal('我的拿手动作',`<p class="modal-intro">把熟悉的动作组合起来，一个图标就能再次使用。</p><div class="action-library">${progress.actions.map((a,i)=>`<div><button data-action="use-action" data-index="${i}"><span>${icon('sparkles',25)}</span><strong>${esc(a.name)}</strong><small>${a.body.length} 个动作</small>${icon('plus',20)}</button><button data-action="edit-action" data-index="${i}" class="icon-btn" aria-label="编辑${esc(a.name)}">${icon('edit',19)}</button></div>`).join('')}</div>`,[{text:'新建拿手动作',action:()=>complexEditor('action')}],true);
}
function changeChip() {
  if(selectedChip===null)return;
  const c=commandAt(world.actors[progress.selected].program,selectedChip);if(!c)return;
  if(c.type==='repeat'){activateRepeat(selectedChip);return;}
  if(c.type==='if'){complexEditor(c.type,selectedChip);return;}
  if(c.type==='call'){actionsLibrary();return;}
  openModal('换一个小指令',`<div class="replace-palette">${['up','down','left','right','clock'].map((name,i)=>`<button data-action="replace" data-command="${i}">${icon(name,30)}<span>${['向上','向下','向左','向右','等一等'][i]}</span></button>`).join('')}</div>`);
}
function basicCommand(index:number):Command {return index<4?{type:'move',direction:(['up','down','left','right'] as const)[index]}:{type:'wait'};}
function settings() {
  openModal('家长与设置',`<p class="modal-intro">给好奇心一点空间，让孩子在观察和尝试中，发现自己的答案。</p><div class="settings-info"><div><strong>适合 4～6 岁</strong><span>20 个单人关卡 · 10 个双人关卡</span></div><div><strong>离线也能玩</strong><span>不需登录，无广告与内购</span></div><div><strong>数据留在本机</strong><span>每次编辑及运行中自动保存</span></div><div><strong>快乐儿童语音</strong><span>AI 合成童声 · 引导与动作播报</span></div></div><div class="settings-actions"><button data-action="export">${icon('download',18)} 导出存档</button><label class="import-button">${icon('book',18)} 导入存档<input type="file" id="import-save" accept="application/json,.json"/></label><button data-action="reset-confirm" class="danger">${icon('reset',18)} 重新开始小镇</button></div><p class="gentle-note">v1.6.0 · 建议家长陪孩子完成第一关。关闭应用时会暂停小镇，回来后可以继续。</p>`);
  $('#import-save').addEventListener('change',async event=>{
    const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
    if(file.size>1_000_000){toast('存档文件太大，请选择本游戏导出的 JSON 存档');return;}
    const loaded=readSave(await file.text());if(!loaded){toast('这个文件不是有效的小镇存档');return;}
    openModal('用这份存档继续吗？','<p class="modal-intro">导入会替换本机的小镇进度。建议先导出当前进度留作备份。</p>',[{text:'取消',secondary:true,action:closeModal},{text:'导入并继续',action:()=>{pause();world=loaded.world;progress=loaded.progress;history=[];deleteMode=false;selectedChip=null;activeRepeat=null;audio.enabled=progress.sound;closeModal();renderAll();save();toast('存档导入成功，欢迎回到你的小镇');}}]);
  });
}
const nativeFiles=registerPlugin<{save(options:{data:string;filename:string}):Promise<{cancelled?:boolean}>}>('TownFiles');
async function exportSave() {
  const data=JSON.stringify(packSave(world,progress),null,2),filename=`奇想小镇存档-${new Date().toISOString().slice(0,10)}.json`;
  if(Capacitor.isNativePlatform()) {
    try {const result=await nativeFiles.save({data,filename});toast(result?.cancelled?'已取消导出':'存档已导出，请保管好这个文件');}
    catch {toast('这次没有保存成功，请换一个保存位置再试试');}
    return;
  }
  const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('存档已导出，请保管好这个文件');
}
function levelMap() {showLevelHome();}
function achievements() {openModal('我的探索徽章',`<div class="badge-display">${icon('star',64)}<h3>${progress.completed.length} 颗探索星星</h3><p>本关采了 ${world.stats.harvested} 颗萝卜 · 做了 ${world.stats.cooked} 碗汤 · 温暖了 ${world.stats.served} 位朋友</p></div><div class="level-map">${LEVELS.map((l,i)=>`<div class="badge-cell ${progress.completed.includes(i)?'complete':''}">${icon(l.icon,27)}<strong>${l.tag}</strong><small>${progress.completed.includes(i)?'已点亮':'等待你的发现'}</small></div>`).join('')}</div>`,[{text:'继续创造',action:closeModal}],true);}

root.addEventListener('click',event=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');if(!target||target.hasAttribute('disabled'))return;
  const action=target.dataset.action!,index=Number(target.dataset.index),path=parsePath(target.dataset.path),program=world.actors[progress.selected].program;
  if((action==='chip'||action==='nested-chip'||action==='repeat-select')&&commandDrag.suppressClick())return;
  if(action==='actor')selectActor(target.dataset.actor as ActorId);
  else if(action==='adventure')showLevelHome('solo');
  else if(action==='creative')creative();
  else if(action==='level')setLevel(Number(target.dataset.level));
  else if(action==='levels')levelMap();
  else if(action==='course-solo'||action==='course-pair'){homeCategory=action==='course-solo'?'solo':'pair';renderHome();window.scrollTo(0,0);}
  else if(action==='continue-level'){closeModal();hideLevelHome();renderAll();}
  else if(action==='menu')openModal('我的编程小镇',`<div class="town-menu"><button data-action="adventure">${icon('globe',24)} 小镇冒险</button><button data-action="creative">${icon('sparkles',24)} 自由创造</button><button data-action="help">${icon('help',24)} 玩法帮助</button><button data-action="achievements">${icon('star',24)} 我的星星</button></div><p class="modal-intro">${esc($('#mission-description').textContent??'')}</p>`);
  else if(action==='help')help();
  else if(action==='hint')hint();
  else if(action==='settings')settings();
  else if(action==='achievements')achievements();
  else if(action==='modal-close')closeModal();
  else if(action==='speak')replayGuide();
  else if(action==='sound'){progress.sound=!progress.sound;audio.enabled=progress.sound;if(!progress.sound)cancelNarration();else audio.effect('click');renderLevels();save();}
  else if(action==='grid'){const visible=town.scene.toggleGrid();target.classList.toggle('active',visible);target.setAttribute('aria-label',visible?'隐藏网格':'显示网格');target.setAttribute('aria-pressed',String(visible));$('#grid-note').textContent=visible?'每格 1 步':'网格已隐藏';}
  else if(action==='step-mode'){pause();stepMode=!stepMode;if(stepMode){enabledActors(progress).forEach(id=>{prepareRetry(world,progress,id);resetActor(world.actors[id]);});renderWorld();renderExecutionHighlight(false);toast('第一步是开始：重置位置。再点下一步，执行第一条指令');}renderRunning();}
  else if(action==='step')stepOnce();
  else if(action==='speed'){progress.speed=progress.speed===1?2:1;renderRunning();save();}
  else if(action==='run'){
    if(running)pause();else if(!enabledActors(progress).some(id=>world.actors[id].program.length)){toast('先点一个指令图标，让小程序开始吧');$('.palette-command').focus();}
    else {if(!readyToExecute())return;if(!progress.creative&&levelValue(world,progress.level)>=LEVELS[progress.level].goal)enabledActors(progress).forEach(id=>{prepareRetry(world,progress,id);resetActor(world.actors[id]);});stepEpoch++;cancelNarration();clearTimeout(stepTimer);stepping=false;stepMode=false;running=true;selectedChip=null;town.scene.setRunning(true);audio.effect('click');renderEditor();renderRunning();}
    save();
  }
  else if(action==='restart'){pause();ACTORS.forEach(a=>refundAndHome(a.id));selectedChip=null;renderAll();save();toast('小伙伴回到起点啦，程序、库存和已点亮的星星都保留着');}
  else if(action==='delete-mode'){deleteMode=!deleteMode;selectedChip=null;renderEditor();}
  else if(action==='clear'&&deleteMode&&program.length){selectedChip=null;edit([],undefined,null);}
  else if(action==='undo'){const previous=history.pop();if(previous){const actionsBefore=progress.actions;progress.actions=previous.actions;progress.selected=previous.id;activeRepeat=previous.activeRepeat;restartEditedProgram(previous.id,previous.program,actionsBefore);selectedChip=null;renderAll();save();}}
  else if(action==='palette'){
    const n=Number(target.dataset.command),level=progress.creative?3:LEVELS[progress.level].skill;
    if((n===5&&level<1)||(n===6&&level<2)||(n===7&&level<3)){toast('到重复、判断或拿手动作关卡试试；自由创造里也可以使用');return;}
    selectedChip=null;if(n<5)add(basicCommand(n));else if(n===5)add({type:'repeat',count:3,body:[]});else if(n===6)complexEditor('if');else actionsLibrary();
  }
  else if(action==='chip'&&path){if(deleteMode)removeCommand(path);else activateRepeat(path.length>1?path.slice(0,-1):null);}
  else if(action==='repeat-select'&&path)activateRepeat(path);
  else if(action==='repeat-delete'&&path&&deleteMode)removeCommand(path);
  else if((action==='repeat-less'||action==='repeat-more')&&path)changeRepeatCount(path,action==='repeat-less'?-1:1);
  else if(action==='chip-config'&&path){selectedChip=path;changeChip();}
  else if(action==='append'){activateRepeat(null);$('.palette-command').focus();toast('接下来添加到主队列');}
  else if(action==='next')nextCourse();
  else if(action==='count-minus'&&draft?.type==='repeat'&&draft.count>1){rememberDraft();draft.count--;renderComplex();}
  else if(action==='count-plus'&&draft?.type==='repeat'&&draft.count<9){rememberDraft();draft.count++;renderComplex();}
  else if(action==='branch-body'||action==='branch-otherwise'){draftBranch=action==='branch-body'?'body':'otherwise';draftSelected=null;renderComplex();}
  else if(action==='nested-add'){if(draftCommands().length<24){rememberDraft();draftCommands().push(basicCommand(Number(target.dataset.command)));draftSelected=null;renderComplex();}else toast('一个动作里最多放 24 条指令');}
  else if(action==='nested-chip'&&draftDeleteMode){rememberDraft();draftCommands().splice(index,1);renderComplex();}
  else if(action==='draft-delete-mode'){draftDeleteMode=!draftDeleteMode;renderComplex();}
  else if(action==='draft-clear'&&draftDeleteMode&&draftCommands().length){rememberDraft();draftCommands().splice(0);renderComplex();}
  else if(action==='draft-undo'){const previous=draftHistory.pop();if(previous){draft=previous;renderComplex();}}
  else if(action==='use-action'){const c:Command={type:'call',actionId:progress.actions[index].id};closeModal();if(selectedChip!==null&&commandAt(program,selectedChip)?.type==='call'){const p=structuredClone(program),list=listAt(p,selectedChip.slice(0,-1));if(list)list[selectedChip.at(-1)!]=c;selectedChip=null;edit(p);}else add(c);}
  else if(action==='edit-action'){pause();const a=progress.actions[index];draftMode='action';draftIndex=selectedChip;draftDeleteMode=false;draftHistory=[];draftBranch='body';draftSelected=null;actionEditId=a.id;draftName=a.name;draft={type:'repeat',count:1,body:structuredClone(a.body)};renderComplex();}
  else if(action==='export')exportSave();
  else if(action==='reset-confirm'){
    openModal('重新开始一座小镇？','<p class="modal-intro">这会清除所有角色程序、仓库物品和关卡进度。可以先到设置中导出存档。</p>',[{text:'保留我的小镇',secondary:true,action:closeModal},{text:'清空并重新开始',action:()=>{pause();world=freshWorld();progress=freshProgress();audio.enabled=true;history=[];deleteMode=false;selectedChip=null;activeRepeat=null;closeModal();renderAll();save();showLevelHome('solo');}}]);
  }
});

const commandDrag=bindCommandDrag(root,{begin:()=>{pause();manualTrackUntil=performance.now()+2500;},interact:()=>{manualTrackUntil=performance.now()+2500;},announce:toast,reorder:(scope,from,to)=>{
  if(scope==='track'||scope.startsWith('repeat:')){const p=structuredClone(world.actors[progress.selected].program),parent=scope==='track'?[]:parsePath(scope.slice(7));if(!parent)return;const list=listAt(p,parent);if(!list||from>=list.length||to>=list.length)return;const [moved]=list.splice(from,1);list.splice(to,0,moved);selectedChip=null;edit(p,undefined,selectionAfterMove(activeRepeat,parent,from,to));}
  else {rememberDraft();const p=draftCommands(),[moved]=p.splice(from,1);p.splice(to,0,moved);renderComplex();}
}});

function frame(now:number) {
  const dt=lastTime?Math.min(now-lastTime,1000):0;lastTime=now;
  if(running) {
    clock+=dt;
    if(clock>=780/progress.speed){clock=0;advanceWorld();}
    if(Date.now()-lastSaved>3000)save();
  }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();audio.stop();save();}});
window.addEventListener('pagehide',save);
document.addEventListener('keydown',event=>{if(event.code==='Space'&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLSelectElement)&&!(event.target instanceof HTMLButtonElement)&&!$('#modal-root').children.length&&!isLevelHome){event.preventDefault();$('#run-button').click();}});
renderAll();requestAnimationFrame(frame);
if(raw&&!restored)toast('旧存档无法读取，已为你准备一座新小镇');
else if(restored){save();toast(JSON.parse(raw!).progress?.levelSet!==2?'旧程序与星星已保留，单人和双人关卡准备好了':'欢迎回来，你的小镇和程序都在这里');}
// A small, read-only diagnostic snapshot supports reproducible smoke tests.
Object.defineProperty(window,'__townSnapshot',{get:()=>structuredClone({world,progress,isLevelHome,homeCategory,running,stepMode,stepping,deleteMode,activeRepeat,map:town.scene.mapLayout(),gridVisible:town.scene.gridVisible,audio:{voice:audio.voiceId,speaking:audio.speaking,busyActors:[...busyActors],caption:narrationCaption,presentation:town.scene.shownActor(progress.selected)}})});
