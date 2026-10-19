import Phaser from 'phaser';
import {ART} from './art';
import type {ActorPresentation} from './narration';
import {ACTORS,LEVELS,enabledActors,isWalkable,type ActorId,type GameEvent,type Progress,type World} from './model';
import {MAP_FEATURES,GRID_VIEW,mapPoint as point} from './map';
const C=GRID_VIEW.cell;
interface SceneSource {world:()=>World;progress:()=>Progress;select:(id:ActorId)=>void;station:(name:string)=>void;canInteract:()=>boolean}
export class TownScene extends Phaser.Scene {
  private source:SceneSource;
  private figures=new Map<ActorId,Phaser.GameObjects.Container>();
  private texts=new Map<ActorId,Phaser.GameObjects.Text>();
  private badges=new Map<ActorId,Phaser.GameObjects.Image>();
  private lastPositions=new Map<ActorId,string>();
  private presentations=new Map<ActorId,ActorPresentation>();
  private heldDefeats=new Set<string>();
  private monsterImages=new Map<string,Phaser.GameObjects.Image>();
  private carts=new Map<string,Phaser.GameObjects.Image>();
  private cartPositions=new Map<string,string>();
  private cropImages:Phaser.GameObjects.Image[]=[];
  private tiles?:Phaser.GameObjects.Container;
  private scenery?:Phaser.GameObjects.Container;
  private sites?:Phaser.GameObjects.Container;
  private tracks?:Phaser.GameObjects.Graphics;
  private grid?:Phaser.GameObjects.Graphics;
  private routeGuide?:Phaser.GameObjects.Container;
  private selectedRing?:Phaser.GameObjects.Ellipse;
  private boardKey='';private terrainKey='';private routeKey='';
  private renderedTiles:{x:number;y:number;walkable:boolean;fill:number;bounds:{x:number;y:number;width:number;height:number}}[]=[];
  private featureBounds:{id:string;bounds:{x:number;y:number;width:number;height:number};artBounds:{x:number;y:number;width:number;height:number}}[]=[];
  private run=false;private showGrid=true;
  constructor(source:SceneSource){super('town');this.source=source;}
  preload(){for(const [name,svg] of Object.entries(ART))this.load.svg(name,`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`);}
  create(){
    this.selectedRing=this.add.ellipse(0,0,66,24,0xfffbe5,.55).setStrokeStyle(3.5,0x438c70).setDepth(90);
    for(const def of ACTORS){
      const pos=point(def.home.x,def.home.y),shadow=this.add.ellipse(0,27,57,16,0x4e7054,.13);
      const sprite=this.add.image(0,-3,def.id).setDisplaySize(76,76).setInteractive({useHandCursor:true});sprite.on('pointerup',(p:Phaser.Input.Pointer)=>{if(this.isTap(p))this.source.select(def.id);});
      const cargo=this.add.image(25,4,'carrot').setDisplaySize(27,27).setVisible(false);
      const text=this.add.text(0,-47,def.name,{fontFamily:'"Microsoft YaHei",sans-serif',fontSize:'22px',color:'#3d644d',backgroundColor:'#fffbea',padding:{x:7,y:2}}).setOrigin(.5).setVisible(false);
      this.figures.set(def.id,this.add.container(pos.x,pos.y,[shadow,sprite,cargo,text]).setDepth(100));this.texts.set(def.id,text);this.badges.set(def.id,cargo);
    }
    this.sync();
  }
  private isTap(p:Phaser.Input.Pointer){return this.source.canInteract()&&p.downElement===this.game.canvas&&p.upElement===this.game.canvas&&p.getDistance()<10&&p.getDuration()<600;}
  private drawTiles(){
    this.tiles?.destroy();this.tiles=this.add.container(0,0).setDepth(1);this.renderedTiles=[];
    const w=this.source.world(),selected=this.source.progress().selected;
    for(let y=0;y<w.board.rows;y++)for(let x=0;x<w.board.cols;x++){
      const p=point(x,y),walkable=isWalkable(w,x,y,selected),fill=walkable?0xfff2cf:0xc7d1bc;
      const tile=this.add.rectangle(p.x,p.y,C-3,C-3,fill).setStrokeStyle(2,walkable?0xc9b995:0x85937d);this.tiles.add(tile);
      const bounds={x:x*C,y:y*C,width:C,height:C};this.renderedTiles.push({x,y,walkable,fill:tile.fillColor,bounds});
      if(!walkable){const hatch=this.add.graphics();hatch.lineStyle(2,0x788972,.5);for(let offset=-C+8;offset<C;offset+=14){const left=Math.max(4,offset),right=Math.min(C-4,offset+C-8);hatch.lineBetween(bounds.x+left,bounds.y+C-4-(left-offset),bounds.x+right,bounds.y+C-4-(right-offset));}this.tiles.add(hatch);}
    }
    for(const tile of w.barriers){const p=point(tile.x,tile.y),g=this.add.graphics();g.fillStyle(0xe3bd9f);g.fillRoundedRect(p.x-C/2+4,p.y-C/2+4,C-8,C-8,5);g.lineStyle(4,0xa16f4b);g.strokeRoundedRect(p.x-C/2+4,p.y-C/2+4,C-8,C-8,5);g.lineStyle(8,0xa66646);g.lineBetween(p.x-19,p.y-24,p.x+19,p.y+9);g.lineBetween(p.x+19,p.y-24,p.x-19,p.y+9);this.tiles.add(g);this.tiles.add(this.add.text(p.x,p.y+24,'路障',{fontFamily:'"Microsoft YaHei",sans-serif',fontSize:'20px',color:'#865e3f',backgroundColor:'#ffefd0',padding:{x:3,y:1}}).setOrigin(.5));}
  }
  private drawBoard(){
    const w=this.source.world();this.scale.setGameSize(w.board.cols*C,w.board.rows*C);
    this.grid?.destroy();this.grid=this.add.graphics().setDepth(5).setVisible(this.showGrid);this.grid.lineStyle(2,0x6f8059,.6);
    for(let x=0;x<=w.board.cols;x++)this.grid.lineBetween(x*C,0,x*C,w.board.rows*C);for(let y=0;y<=w.board.rows;y++)this.grid.lineBetween(0,y*C,w.board.cols*C,y*C);
    this.scenery?.destroy();this.scenery=this.add.container(0,0).setDepth(2);this.cropImages=[];this.featureBounds=[];
    const add=<T extends Phaser.GameObjects.GameObject>(object:T)=>{this.scenery!.add(object);return object;};
    for(const f of w.board.kind==='village'?MAP_FEATURES:[]){
      const left=f.x*C,top=f.y*C,width=f.width*C,height=f.height*C,g=add(this.add.graphics());g.lineStyle(4,0x809074);g.strokeRect(left+2,top+2,width-4,height-4);let art:Phaser.GameObjects.Image|undefined;
      if(f.kind==='store'||f.kind==='kitchen')art=add(this.add.image(left+width/2,top+height/2,f.kind).setDisplaySize(width-10,height-10));
      else if(f.kind==='field')for(let row=0;row<f.height;row++){g.fillStyle(0xbca078);g.fillRect(left+6,top+row*C+7,C-12,C-14);for(let i=0;i<2;i++)this.cropImages.push(add(this.add.image(left+C/2+(i?18:-18),top+(row+.5)*C,'carrot').setDisplaySize(34,45)));}
      else if(f.kind==='tree')for(let row=0;row<f.height;row++)add(this.add.image(left+C/2,top+(row+.5)*C,'tree').setDisplaySize(C-12,C-12));
      else if(f.kind==='garden'){add(this.add.image(left+C/2,top+C/2,'tree').setDisplaySize(C-12,C-12));add(this.add.image(left+C*1.5,top+C/2,'table').setDisplaySize(C-10,C-10));}
      else if(f.kind==='counter'){g.fillStyle(0x7da995);g.fillRoundedRect(left+7,top+31,width-14,36,6);g.fillStyle(0xd0e4cf);g.fillRoundedRect(left+5,top+28,width-10,12,4);add(this.add.image(left+C/2,top+23,'soup').setDisplaySize(40,40));add(this.add.image(left+C*1.5,top+23,'soup').setDisplaySize(40,40));}
      else if(f.kind==='water'){g.fillStyle(0x8dbcb8);g.fillRect(left+5,top+5,width-10,height-10);g.lineStyle(3,0xd6eeea);for(let row=0;row<3;row++)for(let col=0;col<4;col++)g.lineBetween(left+14+col*35,top+19+row*20,left+33+col*35,top+19+row*20);}
      const b=art?.getBounds();this.featureBounds.push({id:f.id,bounds:{x:left,y:top,width,height},artBounds:b?{x:b.x,y:b.y,width:b.width,height:b.height}:{x:left+4,y:top+4,width:width-8,height:height-8}});
    }
    this.sites?.destroy();this.sites=this.add.container(0,0).setDepth(7);
    for(const site of w.sites){const p=point(site.x,site.y),pad=this.add.rectangle(p.x,p.y,C-9,C-9,0xe3efd7,.85).setStrokeStyle(4,0x648f62).setInteractive({useHandCursor:true});pad.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(this.isTap(pointer))this.source.station(site.name);});this.sites.add(pad);this.sites.add(this.add.image(p.x,p.y-10,site.art).setDisplaySize(38,38));const label=this.add.text(p.x,p.y+18,site.label,{fontFamily:'"Microsoft YaHei",sans-serif',fontSize:'28px',color:'#476e48',backgroundColor:'#e9f2dd',padding:{x:3,y:2}}).setOrigin(.5).setInteractive({useHandCursor:true});label.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(this.isTap(pointer))this.source.station(site.name);});this.sites.add(label);}
    this.tracks?.destroy();this.tracks=this.add.graphics().setDepth(30);this.tracks.lineStyle(5,0x86aeb7,.55);for(const gate of w.gates)for(let i=1;i<gate.positions.length;i++){const a=point(gate.positions[i-1].x,gate.positions[i-1].y),b=point(gate.positions[i].x,gate.positions[i].y);this.tracks.lineBetween(a.x,a.y,b.x,b.y);}
    this.terrainKey='';this.routeKey='';
  }
  private drawRoute(){
    this.routeGuide?.destroy();this.routeGuide=this.add.container(0,0).setDepth(10).setVisible(this.showGrid);
    const p=this.source.progress(),a=this.source.world().actors[p.selected],route=p.creative?Array(a.id==='fox'?2:3).fill(a.id==='rabbit'?'right':a.id==='bear'||a.id==='fox'?'down':'left') as ('right'|'down'|'left')[]:LEVELS[p.level].roles.find(r=>r.id===p.selected)?.route??[];
    const g=this.add.graphics();this.routeGuide.add(g);let x=a.origin.x,y=a.origin.y;
    for(let i=0;i<=route.length;i++){
      if(i){const [dx,dy]={right:[1,0],down:[0,1],left:[-1,0],up:[0,-1]}[route[i-1]];x+=dx;y+=dy;}const q=point(x,y);
      g.fillStyle(i?0xffe5a1:0xcce4bb,.2);g.fillRoundedRect(q.x-C/2+4,q.y-C/2+4,C-8,C-8,5);g.lineStyle(3,i?0xa98d4e:0x4e8457,.85);g.strokeRoundedRect(q.x-C/2+4,q.y-C/2+4,C-8,C-8,5);
      const nx=i?q.x-23:q.x,ny=i?q.y-22:q.y+27;if(i){g.fillStyle(0xfff5d8,.97);g.fillCircle(nx,ny,14);g.lineStyle(2,0xa78c50);g.strokeCircle(nx,ny,14);}
      this.routeGuide.add(this.add.text(nx,ny,i?String(i):'起点',{fontFamily:'"Microsoft YaHei",sans-serif',fontSize:i?'22px':'20px',fontStyle:'bold',color:i?'#836535':'#3e7149',backgroundColor:i?undefined:'#e2edcb',padding:{x:i?0:3,y:0}}).setOrigin(.5));
    }
    const end=point(a.target.x,a.target.y);g.lineStyle(5,0xc19d43);g.strokeRoundedRect(end.x-C/2+3,end.y-C/2+3,C-6,C-6,7);
  }
  private drawEntities(){
    const w=this.source.world();for(const image of this.monsterImages.values())image.setVisible(false);for(const image of this.carts.values())image.setVisible(false);
    for(const monster of w.monsters){let image=this.monsterImages.get(monster.id);if(!image){image=this.add.image(0,0,'monster').setDisplaySize(66,66).setDepth(36);this.monsterImages.set(monster.id,image);}const p=point(monster.x,monster.y);image.setPosition(p.x,p.y).setVisible(monster.alive||this.heldDefeats.has(`${monster.x},${monster.y}`));}
    for(const gate of w.gates){let image=this.carts.get(gate.id);if(!image){image=this.add.image(0,0,'cart').setDisplaySize(72,72).setDepth(34);this.carts.set(gate.id,image);}image.setVisible(true);const tile=gate.positions[gate.index],p=point(tile.x,tile.y),key=`${tile.x},${tile.y}`;if(this.cartPositions.get(gate.id)!==key){this.tweens.killTweensOf(image);if(this.run&&this.cartPositions.has(gate.id))this.tweens.add({targets:image,x:p.x,y:p.y,duration:230,ease:'Sine.easeInOut'});else image.setPosition(p.x,p.y);this.cartPositions.set(gate.id,key);}}
  }
  mapLayout(){return {cell:C,origin:{x:0,y:0},cols:this.source.world().board.cols,rows:this.source.world().board.rows,tiles:this.renderedTiles,features:this.featureBounds,stations:this.source.world().sites.map(s=>({...s,center:point(s.x,s.y)})),monsters:this.source.world().monsters.map(m=>({...m,visible:this.monsterImages.get(m.id)?.visible??false}))};}
  setRunning(running:boolean){this.run=running;}
  get gridVisible(){return this.showGrid;}
  shownActor(id:ActorId):ActorPresentation{const a=this.presentations.get(id)??this.source.world().actors[id];return {x:a.x,y:a.y,carrying:a.carrying};}
  presentActor(id:ActorId,presentation:ActorPresentation){this.presentations.set(id,presentation);this.sync();}
  releaseActor(id:ActorId){this.presentations.delete(id);this.heldDefeats.clear();this.sync();}
  deferDefeat(p:{x:number;y:number}){this.heldDefeats.add(`${p.x},${p.y}`);}
  toggleGrid(){this.showGrid=!this.showGrid;this.grid?.setVisible(this.showGrid);this.routeGuide?.setVisible(this.showGrid);return this.showGrid;}
  resetPosition(id:ActorId){this.presentations.delete(id);const figure=this.figures.get(id);if(!figure)return;const a=this.source.world().actors[id],p=point(a.x,a.y);this.tweens.killTweensOf(figure);figure.setPosition(p.x,p.y).setAlpha(1);this.lastPositions.set(id,`${a.x},${a.y}`);}
  sync(){
    if(!this.figures.size)return;const w=this.source.world(),p=this.source.progress(),enabled=enabledActors(p);
    const boardKey=JSON.stringify([w.board,w.sites,w.gates.map(g=>g.positions)]);if(this.boardKey!==boardKey){this.boardKey=boardKey;this.cartPositions.clear();this.drawBoard();}
    const terrainKey=JSON.stringify([w.barriers,w.gates.map(g=>g.index),w.monsters.map(m=>[m.x,m.y,m.alive]),p.selected]);if(this.terrainKey!==terrainKey){this.terrainKey=terrainKey;this.drawTiles();}
    const a=w.actors[p.selected],routeKey=`${p.creative?'creative':p.level}:${p.selected}:${a.origin.x},${a.origin.y}:${a.target.x},${a.target.y}`;if(this.routeKey!==routeKey){this.routeKey=routeKey;this.drawRoute();}
    for(const def of ACTORS){const actor=w.actors[def.id],figure=this.figures.get(def.id)!;figure.setVisible(enabled.includes(def.id));const visual=this.presentations.get(def.id)??actor,pos=point(visual.x,visual.y),key=`${visual.x},${visual.y}`;if(this.lastPositions.get(def.id)!==key){this.tweens.killTweensOf(figure);if(actor.current===-1)figure.setPosition(pos.x,pos.y);else this.tweens.add({targets:figure,x:pos.x,y:pos.y,duration:this.run?340/p.speed:150,ease:'Sine.easeInOut'});this.lastPositions.set(def.id,key);}figure.setDepth(100+actor.y+(def.id===p.selected?20:0));figure.setAlpha(def.id!==p.selected&&actor.x===a.x&&actor.y===a.y?.55:1);this.texts.get(def.id)!.setVisible(def.id===p.selected).setText(def.name+(actor.status==='waiting'?' · 等一等':''));const cargo=this.badges.get(def.id)!;cargo.setVisible(!!visual.carrying);if(visual.carrying)cargo.setTexture(visual.carrying==='carrot'?'carrot':'soup');}
    this.cropImages.forEach((image,i)=>image.setVisible(i<w.crop));this.drawEntities();
  }
  showEvents(events:GameEvent[]){
    for(const e of events){if(!['collect','deposit','cook','serve','attack','failure','complete'].includes(e.kind))continue;const a=e.position??this.presentations.get(e.actor)??this.source.world().actors[e.actor],p=point(a.x,a.y);if(e.kind==='attack'){this.heldDefeats.delete(`${a.x},${a.y}`);this.drawEntities();}
      const value=e.kind==='attack'?'清理 +1':e.kind==='failure'?'再试一试':e.kind==='complete'?'到达啦！':e.kind==='serve'?'♥ +1':e.kind==='cook'?'热汤 +1':e.kind==='deposit'?'入库 +1':'萝卜 +1';const text=this.add.text(p.x,p.y-45,value,{fontFamily:'sans-serif',fontSize:'26px',fontStyle:'bold',color:e.kind==='failure'?'#a15a45':'#3d7854',stroke:'#fffae7',strokeThickness:5}).setOrigin(.5).setDepth(220);this.tweens.add({targets:text,y:'-=27',alpha:0,duration:1000,onComplete:()=>text.destroy()});
      if(e.kind==='attack'||e.kind==='serve')for(let i=0;i<6;i++){const star=this.add.text(p.x,p.y-5,'✦',{fontSize:'26px',color:i%2?'#e39c66':'#e8c35e'}).setDepth(221);this.tweens.add({targets:star,x:p.x+Math.cos(i)*36,y:p.y-30-Math.abs(Math.sin(i))*35,alpha:0,angle:80,duration:800,onComplete:()=>star.destroy()});}
    }
  }
  update(time:number){const figure=this.figures.get(this.source.progress().selected);if(figure&&this.selectedRing)this.selectedRing.setPosition(figure.x,figure.y+27).setAlpha(.7+Math.sin(time/400)*.18);for(const [id,fig] of this.figures)(fig.list[1] as Phaser.GameObjects.Image).y=-3+(this.run&&this.source.world().actors[id].status==='working'?Math.sin(time/100)*1.5:Math.sin(time/700)*.5);}
}
export function createTown(parent:HTMLElement,source:SceneSource){const scene=new TownScene(source),w=source.world();const game=new Phaser.Game({type:Phaser.AUTO,parent,width:w.board.cols*C,height:w.board.rows*C,backgroundColor:'#e7efd2',scene:[scene],scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},input:{touch:{capture:false}},render:{antialias:true},audio:{noAudio:true},banner:false});const resize=new ResizeObserver(()=>game.scale.refresh());resize.observe(parent);game.events.once('destroy',()=>resize.disconnect());return {game,scene};}
