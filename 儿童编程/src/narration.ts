import type {Actor,GameEvent} from './model';
export type ActorPresentation=Pick<Actor,'x'|'y'|'carrying'>;
export interface NarratedStep {voice:string;event:GameEvent;presentation:ActorPresentation}
// Keep each utterance short. Automatic work is spoken before/after its movement.
export function narratedSteps(events:GameEvent[],before:Actor,after:Actor):NarratedStep[] {
  let state:ActorPresentation={x:before.x,y:before.y,carrying:before.carrying};
  return events.filter(e=>e.actor===before.id).map(event=>{
    let voice='action-wait';
    if(event.kind==='reset'){voice='action-start';state={...state,x:after.x,y:after.y};}
    else if(event.kind==='move'){voice=`action-${event.direction}`;state={...state,x:after.x,y:after.y};}
    else if(event.kind==='collect'){voice='action-collect';state={...state,carrying:'carrot'};}
    else if(event.kind==='take'){const cargo=event.cargo??(before.id==='duck'?'meal':'carrot');voice=cargo==='meal'?'action-take-meal':'action-take-carrot';state={...state,carrying:cargo};}
    else if(event.kind==='deposit'){voice='action-deposit';state={...state,carrying:null};}
    else if(event.kind==='cook'){voice='action-cook';state={...state,carrying:null};}
    else if(event.kind==='serve'){voice=event.cargo==='carrot'?'action-deliver-carrot':'action-serve';state={...state,carrying:null};}
    else if(event.kind==='attack')voice='action-attack';
    else if(event.kind==='lesson')voice=`action-try-${event.lesson}`;
    else if(event.kind==='blocked')voice='action-blocked';
    else if(event.kind==='failure')voice='action-failure';
    else if(event.kind==='complete')voice='action-complete';
    return {voice,event,presentation:{...state}};
  });
}
