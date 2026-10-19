import {LEVELS,LEGACY_LEVEL_MAP,type Point,type Technique} from './levels';
import {GRID,STATIONS,BLOCKED,villageBoard,type Board} from './map';
export {LEVELS} from './levels';
export {GRID,STATIONS,BLOCKED} from './map';
export type ActorId = 'rabbit' | 'bear' | 'duck' | 'fox';
export type Direction = 'up' | 'down' | 'left' | 'right';
export const CONDITIONS=[
  {id:'right-clear',label:'右边能走',group:'道路',description:'检查人物右边一格：没有路障，也没有超出地图。'},
  {id:'down-clear',label:'下方能走',group:'道路',description:'检查人物下方一格是否可以走。'},
  {id:'left-clear',label:'左边能走',group:'道路',description:'检查人物左边一格是否可以走。'},
  {id:'up-clear',label:'上方能走',group:'道路',description:'检查人物上方一格是否可以走。'},
  {id:'target-right',label:'目的地在右边',group:'目的地',description:'目的地比人物更靠右时成立，移动后会重新判断。'},
  {id:'target-down',label:'目的地在下方',group:'目的地',description:'目的地比人物更靠下时成立。'},
  {id:'target-left',label:'目的地在左边',group:'目的地',description:'目的地比人物更靠左时成立。'},
  {id:'target-up',label:'目的地在上方',group:'目的地',description:'目的地比人物更靠上时成立。'},
  {id:'at-target',label:'已经到达目的地',group:'目的地',description:'人物正好站在自己这一关的目的地。'},
  {id:'at-home',label:'还在起点',group:'目的地',description:'人物正好站在这一关的起点。'},
  {id:'target-row',label:'与目的地同一行',group:'目的地',description:'人物和目的地处于同一横行，只需考虑左右方向。'},
  {id:'target-column',label:'与目的地同一列',group:'目的地',description:'人物和目的地处于同一竖列，只需考虑上下方向。'},
  {id:'carrying',label:'手里有东西',group:'手中物品',description:'人物拿着萝卜或热汤时成立。'},
  {id:'empty',label:'两手空空',group:'手中物品',description:'人物手里什么也没有时成立。'},
  {id:'has-carrot',label:'手里拿着萝卜',group:'手中物品',description:'只判断人物手里的萝卜，不会把仓库库存当成已拿到。'},
  {id:'has-meal',label:'手里端着热汤',group:'手中物品',description:'只判断人物手里的热汤。'},
  {id:'carrots',label:'仓库还有萝卜',group:'公共库存',description:'判断公共仓库是否还有萝卜，不包括人物已拿走的萝卜。'},
  {id:'meals',label:'取餐台还有热汤',group:'公共库存',description:'判断公共取餐台是否还有热汤。'},
  {id:'monster-right',label:'右边有怪物',group:'怪物与伙伴',description:'检查右边一格是否还有未清理的小怪物。'},
  {id:'monster-down',label:'下方有怪物',group:'怪物与伙伴',description:'检查下方一格是否还有未清理的小怪物。'},
  {id:'monster-left',label:'左边有怪物',group:'怪物与伙伴',description:'检查左边一格是否还有未清理的小怪物。'},
  {id:'monster-up',label:'上方有怪物',group:'怪物与伙伴',description:'检查上方一格是否还有未清理的小怪物。'},
  {id:'monsters-left',label:'场上还有怪物',group:'怪物与伙伴',description:'场上只要还有一只未清理的怪物就成立。'},
  {id:'partner-waiting',label:'伙伴正在等待',group:'怪物与伙伴',description:'另一位参与本关的伙伴正在等食材、怪物或道路时成立。'},
] as const;
export type Condition=typeof CONDITIONS[number]['id'];
export type Command =
  | { type: 'move'; direction: Direction }
  | { type: 'wait' }
  | { type: 'repeat'; count: number; body: Command[] }
  | { type: 'if'; condition: Condition; body: Command[]; otherwise: Command[] }
  | { type: 'call'; actionId: string };
export interface Action { id: string; name: string; body: Command[] }
export interface Frame { commands: Command[]; index: number; remaining: number; rootIndex: number }
export interface Actor {
  id: ActorId; x: number; y: number; carrying: 'carrot' | 'meal' | null;
  origin:Point;target:Point;pickup:Point;delivery:'carrot'|'meal';required:Technique|null;usedRepeat:boolean;usedIf:boolean;roundWork:boolean;program: Command[]; frames: Frame[]; current: number; cycles: number; needsWork: boolean; startPending: boolean;
  status: 'idle' | 'working' | 'waiting' | 'blocked'; message: string;
}
export interface Stats { harvested: number; deposited: number; cooked: number; served: number; deliveredCarrots:number; defeated:number;repeats: number; conditions: number; calls: number }
export interface MovingGate {id:string;positions:Point[];index:number;remaining:number;driver:ActorId}
export interface Monster extends Point {id:string;alive:boolean;pendingBy?:ActorId}
export interface Site extends Point {name:string;label:string;art:string}
export interface World { board:Board;sites:Site[];gates:MovingGate[];monsters:Monster[];seed:number;commandLimit:number|null;participants:ActorId[];barriers:Point[];successes:Record<ActorId,number>;actors: Record<ActorId, Actor>; carrots: number; meals: number; crop: number; cropClock: number; stats: Stats; ticks: number }
export interface Progress { levelSet:2;courseRevision:2;programs:Record<string,Partial<Record<ActorId,Command[]>>>;level: number; completed: number[]; creative: boolean; sound: boolean; speed: number; selected: ActorId; actions: Action[] }
export interface Save { version: 2; world: World; progress: Progress; savedAt: number }
export interface GameEvent {actor: ActorId; kind: 'move' | 'collect' | 'deposit' | 'cook' | 'take' | 'serve' | 'attack' | 'lesson' | 'wait' | 'blocked' | 'reset' | 'failure' | 'complete'; message: string;direction?:Direction;retry?:boolean;cargo?:'carrot'|'meal';position?:Point;lesson?:'repeat'|'if'|'limit'}
export const ACTORS: { id:ActorId;name:string;role:string;color:string;home:{x:number;y:number} }[] = [
  {id:'rabbit',name:'米米',role:'小兔采集员',color:'#e69273',home:STATIONS.farm},
  {id:'bear',name:'布布',role:'小熊厨师',color:'#b58b5c',home:STATIONS.store},
  {id:'duck',name:'点点',role:'小鸭配送员',color:'#d8ad42',home:STATIONS.counter},
  {id:'fox',name:'闪闪',role:'小狐卫士',color:'#ce8754',home:{x:2,y:4}},
];
const mv=(direction:Direction):Command=>({type:'move',direction});
export function recipe(id:ActorId,compact=false):Command[] {
  const direction:Direction=id==='rabbit'?'right':id==='bear'||id==='fox'?'down':'left',count=id==='fox'?2:3;
  return compact?[{type:'repeat',count,body:[mv(direction)]}]:Array.from({length:count},()=>mv(direction));
}
export const DESTINATIONS:Record<ActorId,Point>={rabbit:STATIONS.store,bear:STATIONS.kitchen,duck:STATIONS.customer,fox:{x:2,y:6}};
export const villageSites=():Site[]=>Object.entries(STATIONS).map(([name,p])=>({name,...p,label:({farm:'菜田',store:'仓库',kitchen:'厨房',counter:'取餐',customer:'花园'} as Record<string,string>)[name],art:({farm:'carrot',store:'store',kitchen:'kitchen',counter:'soup',customer:'table'} as Record<string,string>)[name]}));
export function freshWorld():World {
  const make=(id:ActorId):Actor=>({id,...ACTORS.find(a=>a.id===id)!.home,carrying:null,origin:{...ACTORS.find(a=>a.id===id)!.home},target:{...DESTINATIONS[id]},pickup:{...ACTORS.find(a=>a.id===id)!.home},delivery:'meal',required:null,usedRepeat:false,usedIf:false,roundWork:false,program:[],frames:[],current:-1,cycles:0,needsWork:true,startPending:true,status:'idle',message:'等你来编程'});
  return {board:villageBoard(),sites:villageSites(),gates:[],monsters:[],seed:1,commandLimit:null,participants:ACTORS.map(a=>a.id),barriers:[],successes:{rabbit:0,bear:0,duck:0,fox:0},actors:{rabbit:make('rabbit'),bear:make('bear'),duck:make('duck'),fox:make('fox')},carrots:0,meals:0,crop:6,cropClock:0,stats:{harvested:0,deposited:0,cooked:0,served:0,deliveredCarrots:0,defeated:0,repeats:0,conditions:0,calls:0},ticks:0};
}
export function freshProgress():Progress {return {levelSet:2,courseRevision:2,programs:{},level:0,completed:[],creative:false,sound:true,speed:1,selected:'rabbit',actions:[{id:'right3',name:'去仓库',body:recipe('rabbit')},{id:'to-kitchen',name:'去厨房',body:recipe('bear')},{id:'to-garden',name:'去花园',body:recipe('duck')}]};}
export function resetActor(actor:Actor,resetPosition=false) {
  actor.roundWork=false;actor.usedRepeat=false;actor.usedIf=false;actor.frames=[];actor.current=-1;actor.needsWork=true;actor.startPending=true;actor.status='idle';actor.message=actor.program.length?'准备出发':'等你来编程';
  if(resetPosition){Object.assign(actor,actor.origin);actor.carrying=null;}
}
// A program change starts a fresh run from home without losing carried resources.
export function applyProgramEdit(actor:Actor,program:Command[]) {
  actor.program=structuredClone(program);
  const cargo=actor.carrying;resetActor(actor,true);actor.carrying=cargo;
}
export function enabledActors(progress:Progress):ActorId[] {return progress.creative?ACTORS.map(a=>a.id):LEVELS[progress.level].roles.map(r=>r.id);}
function randomInt(w:World,max:number){w.seed=(Math.imul(1664525,w.seed)+1013904223)>>>0;return w.seed%max;}
export function worldForLevel(index:number,programs:Partial<Record<ActorId,Command[]>>={},seed=Math.floor(Math.random()*0xffffffff)):World {
  const w=freshWorld(),level=LEVELS[index];w.barriers=structuredClone(level.barriers??[]);w.carrots=level.stock?.carrots??0;w.meals=level.stock?.meals??0;
  w.seed=seed>>>0;w.board=structuredClone(level.board??villageBoard());w.commandLimit=level.commandLimit??null;w.participants=level.roles.map(r=>r.id);
  w.monsters=(level.monsters??[]).map((p,i)=>({...p,id:`monster-${i}`,alive:true}));
  w.gates=(level.gates??[]).map((g,i)=>({id:`gate-${i}`,positions:structuredClone(g.positions),index:randomInt(w,g.positions.length),remaining:1+randomInt(w,3),driver:g.driver}));
  if(level.board)w.sites=[];
  const addSite=(site:Site)=>{const old=w.sites.find(p=>p.x===site.x&&p.y===site.y);if(!old)w.sites.push(site);else if(site.name==='kitchen')Object.assign(old,site);};
  for(const role of level.roles){const a=w.actors[role.id];a.origin={...role.origin};Object.assign(a,role.origin);a.target={...(role.target??DESTINATIONS[role.id])};a.pickup={...(role.pickup??(level.board?role.origin:role.id==='duck'&&role.delivery==='carrot'?STATIONS.store:ACTORS.find(d=>d.id===role.id)!.home))};a.delivery=role.delivery??'meal';a.required=role.requires??level.requires??null;a.carrying=role.cargo??null;a.program=structuredClone(programs[role.id]??[]);
    if(level.board){if(role.id!=='fox')addSite({...a.pickup,name:role.id==='rabbit'?'farm':role.id==='bear'?'store':'counter',label:role.id==='rabbit'?'起点':role.id==='bear'?'食材':'取餐',art:role.id==='rabbit'?'carrot':role.id==='bear'?'store':'soup'});addSite({...a.target,name:role.id==='rabbit'?'store':role.id==='bear'?'kitchen':role.id==='duck'?'customer':'exit',label:role.id==='rabbit'?'仓库':role.id==='bear'?'厨房':role.id==='duck'?'朋友':'出口',art:role.id==='rabbit'?'store':role.id==='bear'?'kitchen':role.id==='duck'?'table':'shield'});}
  }
  return w;
}
export function prepareRetry(w:World,p:Progress,id:ActorId){
  if(p.creative)return;
  const level=LEVELS[p.level],role=level.roles.find(r=>r.id===id);if(!role)return;
  w.successes[id]=0;
  const actor=w.actors[id];
  if(!actor.carrying&&role.cargo)actor.carrying=role.cargo;
  if(id==='bear'&&level.stock?.carrots)w.carrots=Math.max(level.goal-(actor.carrying==='carrot'?1:0),w.carrots);
  if(id==='duck'&&level.stock?.meals)w.meals=Math.max(level.goal-(actor.carrying==='meal'?1:0),w.meals);
}
export function isTerrainWalkable(w:World,x:number,y:number){return x>=0&&x<w.board.cols&&y>=0&&y<w.board.rows&&(w.board.kind==='village'?!BLOCKED.has(`${x},${y}`):!!w.board.path?.some(p=>p.x===x&&p.y===y))&&!w.barriers.some(p=>p.x===x&&p.y===y);}
export function isWalkable(w:World,x:number,y:number,id?:ActorId){return isTerrainWalkable(w,x,y)&&!w.gates.some(g=>g.positions[g.index].x===x&&g.positions[g.index].y===y)&&(id===undefined||id==='fox'||!w.monsters.some(m=>(m.alive||m.pendingBy)&&m.x===x&&m.y===y));}
export function countCommands(commands:Command[]):number{return commands.reduce((n,c)=>n+1+(c.type==='repeat'?countCommands(c.body):c.type==='if'?countCommands(c.body)+countCommands(c.otherwise):0),0);}
function hasType(commands:Command[],type:'repeat'|'if'):boolean{return commands.some(c=>c.type===type||(c.type==='repeat'&&hasType(c.body,type))||(c.type==='if'&&(hasType(c.body,type)||hasType(c.otherwise,type))));}
export function programIssue(a:Actor,w:World):'limit'|'repeat'|'if'|null{
  if(w.commandLimit&&countCommands(a.program)>w.commandLimit)return 'limit';
  if((a.required==='repeat'||a.required==='both')&&!hasType(a.program,'repeat'))return 'repeat';
  if((a.required==='if'||a.required==='both')&&!hasType(a.program,'if'))return 'if';return null;
}
export function conditionValue(c:Condition,a:Actor,w:World):boolean {
  const delta:Partial<Record<Condition,[number,number]>>={'right-clear':[1,0],'down-clear':[0,1],'left-clear':[-1,0],'up-clear':[0,-1]};
  const d=delta[c];if(d)return isWalkable(w,a.x+d[0],a.y+d[1],a.id);
  const monsterDelta:Partial<Record<Condition,[number,number]>>={'monster-right':[1,0],'monster-down':[0,1],'monster-left':[-1,0],'monster-up':[0,-1]};const md=monsterDelta[c];if(md)return w.monsters.some(m=>(m.alive||m.pendingBy)&&m.x===a.x+md[0]&&m.y===a.y+md[1]);
  switch(c){
    case 'target-right':return a.target.x>a.x;case 'target-down':return a.target.y>a.y;case 'target-left':return a.target.x<a.x;case 'target-up':return a.target.y<a.y;
    case 'at-target':return a.target.x===a.x&&a.target.y===a.y;case 'at-home':return a.origin.x===a.x&&a.origin.y===a.y;
    case 'target-row':return a.target.y===a.y;case 'target-column':return a.target.x===a.x;
    case 'carrying':return !!a.carrying;case 'empty':return !a.carrying;case 'has-carrot':return a.carrying==='carrot';case 'has-meal':return a.carrying==='meal';
    case 'carrots':return w.carrots>0;case 'meals':return w.meals>0;
    case 'monsters-left':return w.monsters.some(m=>m.alive||m.pendingBy);case 'partner-waiting':return w.participants.some(id=>id!==a.id&&w.actors[id].status==='waiting');
  }
  return false;
}

type Result=Omit<GameEvent,'actor'> & {retry?:boolean};
// A visit is handled once. Missing resources keep this visit pending without skipping movement.
function job(actor:Actor,world:World,deferAttack=false):Result|undefined {
  const at=(station:{x:number;y:number})=>actor.x===station.x&&actor.y===station.y;
  if(actor.id==='rabbit') {
    if(at(actor.pickup)&&!actor.carrying) {
      if(!world.crop)return {kind:'wait',message:'萝卜正在长大，等一等',retry:true};
      world.crop--;world.stats.harvested++;actor.carrying='carrot';return {kind:'collect',message:'米米自动采好萝卜，准备出发！'};
    }
    if(at(actor.target)&&actor.carrying==='carrot') {world.carrots++;world.stats.deposited++;actor.roundWork=true;actor.carrying=null;return {kind:'deposit',message:'到仓库啦，萝卜自动放好了！'};}
  } else if(actor.id==='bear') {
    if(at(actor.pickup)&&!actor.carrying) {
      if(!world.carrots)return {kind:'wait',message:'等米米送来萝卜，再出发',retry:true};
      world.carrots--;actor.carrying='carrot';return {kind:'take',cargo:'carrot',message:'布布自动拿好萝卜啦'};
    }
    if(at(actor.target)&&actor.carrying==='carrot') {actor.carrying=null;world.meals++;world.stats.cooked++;actor.roundWork=true;return {kind:'cook',message:'到厨房啦，布布自动做好一碗汤！'};}
  } else if(actor.id==='duck') {
    if(at(actor.pickup)&&!actor.carrying) {
      const carrot=actor.delivery==='carrot',stock=carrot?'carrots':'meals';
      if(!world[stock])return {kind:'wait',message:carrot?'等米米把萝卜入库，再取货':'等布布做好热汤，再出发',retry:true};
      world[stock]--;actor.carrying=carrot?'carrot':'meal';return {kind:'take',cargo:actor.carrying,message:carrot?'点点从仓库取到萝卜啦':'点点自动拿好热汤啦'};
    }
    if(at(actor.target)&&actor.carrying===actor.delivery) {const cargo=actor.carrying;actor.carrying=null;if(cargo==='carrot')world.stats.deliveredCarrots++;else world.stats.served++;actor.roundWork=true;return {kind:'serve',cargo,message:cargo==='carrot'?'萝卜送到朋友家啦！':'送到朋友家，热汤自动送出啦！'};}
  } else if(actor.id==='fox'){
    const monster=world.monsters.find(m=>m.alive&&m.x===actor.x&&m.y===actor.y);
    if(monster){monster.alive=false;if(deferAttack)monster.pendingBy=actor.id;world.stats.defeated++;actor.roundWork=true;return {kind:'attack',position:{x:monster.x,y:monster.y},message:'闪闪把小怪物变成星星啦！'};}
    if(!world.monsters.some(m=>m.alive))actor.roundWork=true;
  }
}
function applyJob(actor:Actor,world:World,deferAttack=false):Result|undefined {
  const result=job(actor,world,deferAttack);actor.needsWork=!!result?.retry;
  if(result){actor.status=result.retry?'waiting':'working';actor.message=result.message;}
  return result;
}
function resolve(actor:Actor,world:World,actions:Action[]):{command:Command}|{reset:true;success:boolean}|undefined {
  for(let safety=0;safety<96;safety++) {
    if(!actor.frames.length)actor.frames.push({commands:actor.program,index:0,remaining:1,rootIndex:-1});
    const frame=actor.frames[actor.frames.length-1];
    if(frame.index>=frame.commands.length) {
      if(frame.remaining>1){frame.remaining--;frame.index=0;continue;}
      actor.frames.pop();
      if(!actor.frames.length) {
        const technique=(!(actor.required==='repeat'||actor.required==='both')||actor.usedRepeat)&&(!(actor.required==='if'||actor.required==='both')||actor.usedIf);
        const success=actor.x===actor.target.x&&actor.y===actor.target.y&&actor.roundWork&&technique&&(actor.id!=='fox'||!world.monsters.some(m=>m.alive));if(success)world.successes[actor.id]++;
        actor.cycles++;Object.assign(actor,actor.origin);actor.roundWork=false;actor.usedRepeat=false;actor.usedIf=false;
        // Reset position and cursor only. Cargo and all shared resources stay conserved.
        actor.current=-1;actor.needsWork=true;actor.startPending=false;actor.status='working';actor.message='开始：回到起点，从第一条再出发';return {reset:true,success};
      }
      continue;
    }
    const command=frame.commands[frame.index];actor.current=frame.rootIndex<0?frame.index:frame.rootIndex;
    if(command.type==='repeat') {
      frame.index++;world.stats.repeats++;actor.usedRepeat=true;
      if(command.body.length)actor.frames.push({commands:command.body,index:0,remaining:command.count,rootIndex:actor.current});
    } else if(command.type==='if') {
      frame.index++;world.stats.conditions++;actor.usedIf=true;const branch=conditionValue(command.condition,actor,world)?command.body:command.otherwise;
      if(branch.length)actor.frames.push({commands:branch,index:0,remaining:1,rootIndex:actor.current});
    } else if(command.type==='call') {
      frame.index++;const action=actions.find(a=>a.id===command.actionId);
      if(action?.body.length&&actor.frames.length<10){world.stats.calls++;actor.frames.push({commands:action.body,index:0,remaining:1,rootIndex:actor.current});}
      else {actor.status='blocked';actor.message='这个动作还没有内容，点铅笔改一改';return;}
    } else return {command};
  }
  actor.status='blocked';actor.message='动作绕圈了，放进一个移动或等待吧';return;
}
export function tick(world:World,progress:Progress,options:{skipActors?:ReadonlySet<ActorId>;narrateActor?:ActorId}={}):GameEvent[] {
  world.ticks++;if(++world.cropClock>=4){world.crop=Math.min(6,world.crop+1);world.cropClock=0;}
  const events:GameEvent[]=[];
  if(!progress.creative&&levelValue(world,progress.level)>=LEVELS[progress.level].goal)return events;
  for(const gate of world.gates){
    if(options.skipActors?.has(gate.driver)||!world.actors[gate.driver].program.length)continue;
    if(--gate.remaining>0)continue;
    const next=(gate.index+1)%gate.positions.length,p=gate.positions[next];
    if(enabledActors(progress).some(id=>world.actors[id].x===p.x&&world.actors[id].y===p.y)){gate.remaining=1;continue;}
    gate.index=next;gate.remaining=1+randomInt(world,3);
  }
  for(const id of enabledActors(progress)) {
    if(options.skipActors?.has(id))continue;
    const actor=world.actors[id];
    if(!actor.program.length){actor.status='idle';actor.message='等你来编程';continue;}
    if(id==='fox'&&!progress.creative&&world.successes.fox>=LEVELS[progress.level].goal)continue;
    const issue=programIssue(actor,world);if(issue){actor.status='blocked';actor.message=issue==='limit'?`本关最多 ${world.commandLimit} 格，试试重复让程序变短`:issue==='repeat'?'本关要用重复，找找路线里相同的一组':'本关要用如果，先判断旁边是否安全';events.push({actor:id,kind:'lesson',lesson:issue,message:actor.message});continue;}
    if(actor.startPending){
      Object.assign(actor,actor.origin);actor.roundWork=false;actor.usedRepeat=false;actor.usedIf=false;actor.frames=[];actor.current=-1;actor.startPending=false;actor.needsWork=true;
      actor.status='working';actor.message='开始：回到起点，准备第一条指令';events.push({actor:id,kind:'reset',message:actor.message});continue;
    }
    if(actor.needsWork){const result=applyJob(actor,world,options.narrateActor===id);if(result){events.push({actor:id,...result});if(result.retry)continue;}}
    const resolved=resolve(actor,world,progress.actions);if(!resolved)continue;
    if('reset' in resolved){events.push({actor:id,kind:resolved.success?'complete':'failure',message:resolved.success?'到达目的地，任务完成啦！':'未到达目的地，任务失败了'});events.push({actor:id,kind:'reset',message:actor.message});continue;}
    const command=resolved.command;
    if(command.type==='move') {
      const delta={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[command.direction],x=actor.x+delta[0],y=actor.y+delta[1];
      if(id!=='fox'&&world.monsters.some(m=>(m.alive||m.pendingBy)&&m.x===x&&m.y===y)){actor.status='waiting';actor.message='前面有怪物，等闪闪清路';events.push({actor:id,kind:'wait',retry:true,message:actor.message});continue;}
      if(!isWalkable(world,x,y,id)) {
        if(world.gates.some(g=>g.positions[g.index].x===x&&g.positions[g.index].y===y)){
          actor.cycles++;const cargo=actor.carrying;resetActor(actor,true);actor.carrying=cargo;actor.startPending=false;events.push({actor:id,kind:'failure',message:'撞上移动路障了，先用如果判断再走'});events.push({actor:id,kind:'reset',message:'开始：回到起点'});continue;
        }
        actor.status='blocked';actor.message='前面走不通啦，换个方向试试';events.push({actor:id,kind:'blocked',message:actor.message});continue;
      }
      actor.x=x;actor.y=y;actor.needsWork=true;actor.status='working';actor.message='向'+({up:'上',down:'下',left:'左',right:'右'}[command.direction])+'走一格';
      actor.frames[actor.frames.length-1].index++;events.push({actor:id,kind:'move',message:actor.message,direction:command.direction});
      const result=applyJob(actor,world,options.narrateActor===id);if(result)events.push({actor:id,...result});
    } else {actor.status='working';actor.message='等一等，再出发';actor.frames[actor.frames.length-1].index++;events.push({actor:id,kind:'wait',message:actor.message});}
  }
  return events;
}
export function levelValue(world:World,index:number):number {return Math.min(...LEVELS[index].roles.map(r=>world.successes[r.id]));}
export function validateCommands(input:unknown,depth=0):input is Command[] {
  if(!Array.isArray(input)||input.length>48||depth>4)return false;
  return input.every((c:any)=>c&&typeof c==='object'&&((c.type==='move'&&['up','down','left','right'].includes(c.direction))||c.type==='wait'||(c.type==='repeat'&&Number.isInteger(c.count)&&c.count>=1&&c.count<=9&&validateCommands(c.body,depth+1))||(c.type==='if'&&CONDITIONS.some(d=>d.id===c.condition)&&validateCommands(c.body,depth+1)&&validateCommands(c.otherwise,depth+1))||(c.type==='call'&&typeof c.actionId==='string'&&c.actionId.length<=80)));
}
function legacyCommands(input:unknown,depth=0):Command[]|null {
  if(!Array.isArray(input)||input.length>48||depth>4)return null;
  const result:Command[]=[];
  for(const original of input) {
    if(!original||typeof original!=='object')return null;if(original.type==='interact')continue;
    const c=structuredClone(original);
    if(c.type==='repeat'||c.type==='if') {const body=legacyCommands(c.body,depth+1);if(!body)return null;c.body=body;if(c.type==='if'){const otherwise=legacyCommands(c.otherwise,depth+1);if(!otherwise)return null;c.otherwise=otherwise;}}
    if(!validateCommands([c],depth))return null;result.push(c);
  }
  return result;
}
export function packSave(world:World,progress:Progress):Save {return {version:2,world:structuredClone(world),progress:structuredClone(progress),savedAt:Date.now()};}
export function readSave(raw:string|null):Save|null {
  try {
    if(!raw||raw.length>1_000_000)return null;
    const value=JSON.parse(raw),legacy=value.version===1;
    if((!legacy&&value.version!==2)||!value.world||!value.progress)return null;
    const p=value.progress as Progress,w=value.world as World;
    const oldLevels=p.levelSet!==2;if(p.levelSet!==undefined&&p.levelSet!==2)return null;
    if(!Number.isInteger(p.level)||p.level<0||p.level>=LEVELS.length||!ACTORS.some(a=>a.id===p.selected))return null;
    if(!Array.isArray(p.completed)||!p.completed.every(x=>Number.isInteger(x)&&x>=0&&x<LEVELS.length))return null;
    if(!Array.isArray(p.actions)||p.actions.length>20)return null;
    for(const action of p.actions) {if(!action||typeof action.id!=='string'||typeof action.name!=='string'||action.name.length>24)return null;if(legacy){const body=legacyCommands(action.body);if(!body)return null;action.body=body;}if(!validateCommands(action.body))return null;}
    const defaults=freshWorld(),oldCurriculum=p.courseRevision!==2;
    w.board??=villageBoard();w.sites??=villageSites();w.gates??=[];w.monsters??=[];w.seed??=1;w.commandLimit??=null;w.participants??=enabledActors(p);
    if(!w.board||!['village','maze'].includes(w.board.kind)||!Number.isInteger(w.board.cols)||w.board.cols<3||w.board.cols>16||!Number.isInteger(w.board.rows)||w.board.rows<3||w.board.rows>20)return null;
    const pointValid=(point:any)=>point&&Number.isInteger(point.x)&&Number.isInteger(point.y)&&point.x>=0&&point.x<w.board.cols&&point.y>=0&&point.y<w.board.rows;
    if(w.board.kind==='maze'&&(!Array.isArray(w.board.path)||!w.board.path.length||w.board.path.length>320||!w.board.path.every(pointValid)))return null;
    if(!Number.isInteger(w.seed)||w.seed<0||w.seed>0xffffffff||w.commandLimit!==null&&(!Number.isInteger(w.commandLimit)||w.commandLimit<1||w.commandLimit>48))return null;
    if(!Array.isArray(w.gates)||w.gates.length>8||!w.gates.every(g=>g&&typeof g.id==='string'&&Array.isArray(g.positions)&&g.positions.length>=2&&g.positions.length<=8&&g.positions.every(pointValid)&&Number.isInteger(g.index)&&g.index>=0&&g.index<g.positions.length&&Number.isInteger(g.remaining)&&g.remaining>=1&&g.remaining<=3&&ACTORS.some(a=>a.id===g.driver)))return null;
    if(!Array.isArray(w.monsters)||w.monsters.length>64||!w.monsters.every(m=>pointValid(m)&&typeof m.id==='string'&&typeof m.alive==='boolean'))return null;
    for(const monster of w.monsters)delete monster.pendingBy;
    if(!Array.isArray(w.sites)||w.sites.length>12||!w.sites.every(s=>pointValid(s)&&typeof s.name==='string'&&s.name.length<=24&&typeof s.label==='string'&&s.label.length<=12&&['carrot','store','kitchen','soup','table','shield'].includes(s.art)))return null;
    if(!Array.isArray(w.participants)||w.participants.length>4||!w.participants.every(id=>ACTORS.some(a=>a.id===id)))return null;
    if(!w.actors||!w.stats)return null;w.actors.fox??=defaults.actors.fox;w.stats.deliveredCarrots??=0;w.stats.defeated??=0;
    for(const key of ['carrots','meals','crop','cropClock','ticks'] as const)if(!Number.isFinite(w[key])||w[key]<0)return null;
    if(w.crop>6||!w.stats||!Object.values(w.stats).every(x=>Number.isFinite(x)&&x>=0)||!w.actors)return null;
    if(!Object.keys(freshWorld().stats).every(k=>Number.isFinite(w.stats[k as keyof Stats])))return null;
    w.barriers??=[];w.successes??={rabbit:0,bear:0,duck:0,fox:0};w.successes.fox??=0;
    if(!Array.isArray(w.barriers)||w.barriers.length>320||!w.barriers.every(pointValid)||!ACTORS.every(a=>Number.isInteger(w.successes[a.id])&&w.successes[a.id]>=0))return null;
    for(const def of ACTORS) {
      const actor=w.actors[def.id];if(!actor||actor.id!==def.id||!['carrot','meal',null].includes(actor.carrying)||!Number.isInteger(actor.cycles)||actor.cycles<0)return null;
      actor.origin??={...def.home};actor.target??={...DESTINATIONS[def.id]};actor.roundWork??=false;
      actor.pickup??={...def.home};actor.delivery??='meal';actor.required??=null;actor.usedRepeat??=false;actor.usedIf??=false;
      if(!pointValid(actor.pickup)||!['carrot','meal'].includes(actor.delivery)||![null,'repeat','if','both'].includes(actor.required)||typeof actor.usedRepeat!=='boolean'||typeof actor.usedIf!=='boolean')return null;
      if(!pointValid(actor.origin)||!pointValid(actor.target)||typeof actor.roundWork!=='boolean')return null;
      if(legacy) {
        const program=legacyCommands(actor.program);if(!program)return null;
        const types=program.map(c=>c.type==='move'?c.direction:c.type).join(',');
        const known=types==='right,right,right,left,left,left'||types==='right,right,down,up,left,left';
        const compact=program.length===2&&program.every(c=>c.type==='repeat'&&c.count===3&&c.body.length===1&&c.body[0].type==='move')&&program.map(c=>c.type==='repeat'&&c.body[0].type==='move'?c.body[0].direction:'').join(',')==='right,left';
        actor.program=known||compact?recipe(def.id,compact):program;
        if(actor.carrying&&((def.id==='duck')!==(actor.carrying==='meal'))){if(actor.carrying==='meal')w.meals++;else w.carrots++;actor.carrying=null;}
        const cargo=actor.carrying;resetActor(actor,true);actor.carrying=cargo;
      }
      if(!validateCommands(actor.program)||!pointValid(actor))return null;
      if(typeof actor.needsWork!=='boolean'||!Array.isArray(actor.frames)||actor.frames.length>10||!actor.frames.every(f=>validateCommands(f.commands)&&Number.isInteger(f.index)&&f.index>=0&&f.index<=f.commands.length&&Number.isInteger(f.remaining)&&f.remaining>=1&&f.remaining<=9&&Number.isInteger(f.rootIndex)&&f.rootIndex>=-1&&f.rootIndex<48))return null;
      if(actor.startPending===undefined)actor.startPending=actor.frames.length===0&&actor.current<0;
      if(typeof actor.startPending!=='boolean')return null;
      if(!Number.isInteger(actor.current)||actor.current< -1||actor.current>=48)return null;
      if(!isWalkable(w,actor.x,actor.y)){
        if(!isWalkable(w,actor.origin.x,actor.origin.y))actor.origin={...def.home};
        const cargo=actor.carrying;resetActor(actor,true);actor.carrying=cargo;
      }
      actor.status='idle';actor.message=actor.program.length?'已保存，继续出发吧':'等你来编程';
    }
    if(oldLevels){
      const oldPrograms=Object.fromEntries(ACTORS.map(a=>[a.id,structuredClone(w.actors[a.id].program)]));
      p.level=LEGACY_LEVEL_MAP[p.level]??0;p.completed=p.completed.map(i=>LEGACY_LEVEL_MAP[i]??0);p.levelSet=2;
      p.programs={creative:oldPrograms,[LEVELS[p.level].id]:oldPrograms};
      w.barriers=structuredClone(p.creative?[]:LEVELS[p.level].barriers??[]);w.successes={rabbit:0,bear:0,duck:0,fox:0};
      if(!p.creative){w.carrots=Math.max(w.carrots,LEVELS[p.level].stock?.carrots??0);w.meals=Math.max(w.meals,LEVELS[p.level].stock?.meals??0);}
      for(const def of ACTORS){const actor=w.actors[def.id],role=!p.creative?LEVELS[p.level].roles.find(r=>r.id===def.id):undefined;actor.origin={...(role?.origin??def.home)};actor.target={...DESTINATIONS[def.id]};applyProgramEdit(actor,actor.program);}
    }
    if(oldCurriculum&&!p.creative&&(p.level===16||p.level===17)){
      const previousStats=w.stats,carrots=w.carrots,meals=w.meals,programs=Object.fromEntries(ACTORS.map(a=>[a.id,w.actors[a.id].program]));Object.assign(w,worldForLevel(p.level,programs));w.stats=previousStats;w.carrots=carrots;w.meals=meals;
    }
    if(oldCurriculum)p.completed=p.completed.filter(i=>i!==16&&i!==17);p.courseRevision=2;
    p.programs??={};
    const validKeys=new Set(['creative',...LEVELS.map(l=>l.id)]);
    if(!p.programs||Array.isArray(p.programs)||typeof p.programs!=='object'||Object.keys(p.programs).length>LEVELS.length+1||!Object.entries(p.programs).every(([key,programs])=>validKeys.has(key)&&programs&&typeof programs==='object'&&!Array.isArray(programs)&&Object.entries(programs).every(([id,program])=>ACTORS.some(a=>a.id===id)&&validateCommands(program))))return null;
    for(const action of freshProgress().actions)if(!p.actions.some(a=>a.id===action.id)&&p.actions.length<20)p.actions.push(action);
    p.completed=[...new Set(p.completed)];p.sound=typeof p.sound==='boolean'?p.sound:true;p.creative=!!p.creative;p.speed=p.speed===2?2:1;if(!enabledActors(p).includes(p.selected))p.selected=enabledActors(p)[0];
    return {version:2,world:w,progress:p,savedAt:Number(value.savedAt)||Date.now()};
  } catch {return null;}
}
