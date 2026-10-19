// Every physical feature occupies whole grid cells. Rendering and movement use
// this same list; working pads remain walkable in front of the solid scenery.
export const GRID={cols:7,rows:8};
export const STATIONS={farm:{x:1,y:2},store:{x:4,y:2},kitchen:{x:4,y:5},counter:{x:4,y:6},customer:{x:1,y:6}};
export const MAP_FEATURES=[
  {id:'field',kind:'field',x:0,y:0,width:1,height:3},
  {id:'store-building',kind:'store',x:4,y:0,width:2,height:2},
  {id:'trees',kind:'tree',x:6,y:0,width:1,height:2},
  {id:'kitchen-building',kind:'kitchen',x:5,y:4,width:2,height:2},
  {id:'garden',kind:'garden',x:0,y:7,width:2,height:1},
  {id:'counter-bench',kind:'counter',x:3,y:7,width:2,height:1},
  {id:'pond',kind:'water',x:5,y:7,width:2,height:1},
] as const;
export const BLOCKED=new Set<string>(MAP_FEATURES.flatMap(f=>Array.from({length:f.width*f.height},(_,i)=>`${f.x+i%f.width},${f.y+Math.floor(i/f.width)}`)));
export interface Board {kind:'village'|'maze';cols:number;rows:number;path:{x:number;y:number}[]|null}
export const villageBoard=():Board=>({kind:'village',...GRID,path:null});
export const GRID_VIEW={cell:78,x:0,y:0};
export const mapPoint=(x:number,y:number)=>({x:GRID_VIEW.x+(x+.5)*GRID_VIEW.cell,y:GRID_VIEW.y+(y+.5)*GRID_VIEW.cell});
