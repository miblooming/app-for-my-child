interface DragCallbacks {begin:()=>void;interact:()=>void;announce:(message:string)=>void;reorder:(scope:string,from:number,to:number)=>void}
// Pointer events support touch, pen and mouse. A short press is left to the normal delete click.
export function bindCommandDrag(root:HTMLElement,callbacks:DragCallbacks){
  let state:{id:number;from:number;to:number;scope:string;item:HTMLElement;track:HTMLElement;startX:number;startY:number;x:number;y:number;active:boolean;scrolling:'x'|'y'|null;timer:ReturnType<typeof setTimeout>;ghost?:HTMLElement;raf?:number}|null=null;
  let ignoreUntil=0;
  function clear(commit:boolean){
    const drag=state;if(!drag)return;state=null;clearTimeout(drag.timer);if(drag.raf)cancelAnimationFrame(drag.raf);
    if(drag.track.hasPointerCapture(drag.id))drag.track.releasePointerCapture(drag.id);
    drag.ghost?.remove();root.querySelectorAll('.drag-source,.drop-target,.hold-pending').forEach(el=>el.classList.remove('drag-source','drop-target','hold-pending'));document.body.classList.remove('command-dragging');
    if(drag.active||drag.scrolling)ignoreUntil=performance.now()+650;
    if(drag.active&&commit&&drag.from!==drag.to){callbacks.reorder(drag.scope,drag.from,drag.to);callbacks.announce('顺序调整好啦');}
  }
  function position(){
    const drag=state;if(!drag?.active)return;
    if(drag.ghost){drag.ghost.style.left=`${drag.x-42}px`;drag.ghost.style.top=`${drag.y-48}px`;}
    const items=Array.from(drag.track.querySelectorAll<HTMLElement>(`.command-item[data-scope="${drag.scope}"]`));
    const bounds=drag.track.getBoundingClientRect();
    if(drag.y>=bounds.top-70&&drag.y<=bounds.bottom+70){
      if(drag.x>bounds.right-35)drag.track.scrollLeft+=9;else if(drag.x<bounds.left+35)drag.track.scrollLeft-=9;
      const nearest=items.reduce<HTMLElement|undefined>((best,item)=>{
        const r=item.getBoundingClientRect(),b=best?.getBoundingClientRect();return !b||Math.abs(r.x+r.width/2-drag.x)<Math.abs(b.x+b.width/2-drag.x)?item:best;
      },undefined);
      items.forEach(el=>el.classList.toggle('drop-target',el===nearest&&Number(el.dataset.index)!==drag.from));
      if(nearest)drag.to=Number(nearest.dataset.index);
    }
    drag.raf=requestAnimationFrame(position);
  }
  root.addEventListener('pointerdown',event=>{
    const target=(event.target as Element).closest<HTMLElement>('.command-chip,.repeat-drag-handle');if(!target||state||event.button!==0)return;
    ignoreUntil=0;callbacks.interact();
    const item=target.closest<HTMLElement>('.command-item')!,track=item.closest<HTMLElement>('.track-scroller,.nested-track')!;
    const pending={id:event.pointerId,from:Number(item.dataset.index),to:Number(item.dataset.index),scope:item.dataset.scope!,item,track,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false,scrolling:null as 'x'|'y'|null,timer:0 as unknown as ReturnType<typeof setTimeout>,ghost:undefined as HTMLElement|undefined,raf:undefined as number|undefined};
    state=pending;item.classList.add('hold-pending');
    pending.timer=setTimeout(()=>{
      if(state!==pending)return;callbacks.begin();pending.active=true;ignoreUntil=performance.now()+650;
      item.classList.remove('hold-pending');item.classList.add('drag-source');document.body.classList.add('command-dragging');
      track.setPointerCapture(event.pointerId);
      const ghost=item.cloneNode(true) as HTMLElement;ghost.className='command-item drag-ghost';ghost.setAttribute('aria-hidden','true');ghost.style.width=`${item.getBoundingClientRect().width}px`;document.body.append(ghost);pending.ghost=ghost;
      callbacks.announce('拖动到想放的位置，再松开');position();
    },380);
  });
  root.addEventListener('pointermove',event=>{
    if(!state||state.id!==event.pointerId)return;
    const dx=event.clientX-state.x,dy=event.clientY-state.y;state.x=event.clientX;state.y=event.clientY;
    if(!state.active&&!state.scrolling&&Math.hypot(state.x-state.startX,state.y-state.startY)>10){
      clearTimeout(state.timer);state.item.classList.remove('hold-pending');
      state.scrolling=Math.abs(state.x-state.startX)>Math.abs(state.y-state.startY)?'x':'y';
      state.track.setPointerCapture(state.id);
    }
    if(state.scrolling){
      callbacks.interact();event.preventDefault();
      if(state.scrolling==='x')state.track.scrollLeft-=dx;
      else {const modal=state.track.closest<HTMLElement>('.modal');if(modal)modal.scrollTop-=dy;else window.scrollBy(0,-dy);}
    } else if(state.active)event.preventDefault();
  },{passive:false});
  window.addEventListener('pointerup',event=>{if(state?.id===event.pointerId)clear(true);});
  window.addEventListener('pointercancel',event=>{if(state?.id===event.pointerId)clear(false);});
  window.addEventListener('blur',()=>clear(false));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear(false);});
  root.addEventListener('contextmenu',event=>{if((event.target as Element).closest('.command-chip,.repeat-drag-handle'))event.preventDefault();});
  // Keyboard users can sort without the long-press gesture.
  root.addEventListener('keydown',event=>{
    const item=(event.target as Element).closest<HTMLElement>('.command-item');if(!item||!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();const index=Number(item.dataset.index),next=index+(event.key==='ArrowLeft'?-1:1),count=item.parentElement!.querySelectorAll(`.command-item[data-scope="${item.dataset.scope}"]`).length;
    if(next>=0&&next<count){callbacks.begin();callbacks.reorder(item.dataset.scope!,index,next);}
  });
  return {suppressClick:()=>performance.now()<ignoreUntil};
}
