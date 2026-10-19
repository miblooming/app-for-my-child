import type {Actor,Command} from './model';
export type CommandPath=number[];
export function commandAt(program:Command[],path:CommandPath):Command|undefined{
  let list=program,command:Command|undefined;
  for(let i=0;i<path.length;i++){
    command=list[path[i]];if(!command)return;
    if(i<path.length-1){if(command.type!=='repeat')return;list=command.body;}
  }
  return command;
}
export function listAt(program:Command[],parent:CommandPath=[]):Command[]|undefined{
  if(!parent.length)return program;
  const command=commandAt(program,parent);return command?.type==='repeat'?command.body:undefined;
}
export function parsePath(value:string|undefined):CommandPath|null{
  if(!value||!/^\d+(\.\d+)*$/.test(value))return null;
  return value.split('.').map(Number);
}
const prefix=(parent:CommandPath,child:CommandPath)=>parent.every((v,i)=>child[i]===v);
export function selectionAfterRemoval(active:CommandPath|null,removed:CommandPath):CommandPath|null{
  if(!active)return null;
  if(prefix(removed,active))return removed.length>1?removed.slice(0,-1):null;
  const next=[...active],parent=removed.slice(0,-1),depth=parent.length;
  if(prefix(parent,next)&&next.length>depth&&next[depth]>removed.at(-1)!)next[depth]--;
  return next;
}
export function selectionAfterMove(active:CommandPath|null,parent:CommandPath,from:number,to:number):CommandPath|null{
  if(!active)return null;const next=[...active],depth=parent.length;
  if(!prefix(parent,next)||next.length<=depth)return next;
  const index=next[depth];next[depth]=index===from?to:from<index&&index<=to?index-1:to<=index&&index<from?index+1:index;
  return next;
}
// Parent frames have already advanced past the container; the leaf cursor advances
// after a completed primitive, but stays on a blocked primitive for retry.
export function executingPath(actor:Actor):CommandPath|null{
  if(actor.current<0||actor.startPending)return null;
  const path=[actor.current];
  for(let i=1;i<actor.frames.length;i++){
    const parent=commandAt(actor.program,path);if(parent?.type!=='repeat')break;
    const frame=actor.frames[i],blocked=i===actor.frames.length-1&&(actor.status==='blocked'||actor.status==='waiting'&&!actor.needsWork);
    const index=frame.index-(blocked?0:1);if(index<0||index>=parent.body.length)break;path.push(index);
  }
  return path;
}
