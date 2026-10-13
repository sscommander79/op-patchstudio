import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE='summary, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const dialogStack:symbol[]=[];

function isVisibleControl(control:HTMLElement,dialog:HTMLElement) {
    if(control.hidden||control.closest('[hidden], [aria-hidden="true"]'))return false;
    for(let node:HTMLElement|null=control;node&&node!==dialog;node=node.parentElement){
      if(node instanceof HTMLDetailsElement&&!node.open){
        const summary=[...node.children].find(child=>child.tagName==='SUMMARY');
        if(!summary?.contains(control))return false;
      }
      const style=getComputedStyle(node);
      if(style.display==='none'||style.visibility==='hidden')return false;
    }
    return true;
}
function controls(dialog:HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(control=>isVisibleControl(control,dialog));
}

/** Gives a custom modal one topmost Escape owner, a focus loop, and trigger restoration. */
export function useOwnedDialog({active,dialogRef,onClose,returnFocus}:{active:boolean;dialogRef:RefObject<HTMLElement|null>;onClose:()=>void;returnFocus?:HTMLElement|null}) {
  const id=useRef(Symbol('owned-dialog'));
  const closeRef=useRef(onClose);closeRef.current=onClose;
  const returnRef=useRef(returnFocus);returnRef.current=returnFocus;
  useEffect(()=>{
    if(!active)return;
    const token=id.current,previous=returnRef.current??(document.activeElement instanceof HTMLElement?document.activeElement:null);
    const previousId=previous?.id;
    dialogStack.push(token);
    const dialog=dialogRef.current;
    queueMicrotask(()=>{
      if(dialogStack.at(-1)!==token)return;
      const visible=dialog?controls(dialog):[];
      const initial=dialog?[...dialog.querySelectorAll<HTMLElement>('[data-initial-focus="true"]')].find(control=>!control.matches(':disabled')&&isVisibleControl(control,dialog)):undefined;
      const target=initial??visible[0]??dialog;
      target?.focus();
    });
    const key=(event:KeyboardEvent)=>{
      if(dialogStack.at(-1)!==token||!dialogRef.current)return;
      if(event.key==='Escape'){
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();closeRef.current();return;
      }
      if(event.key!=='Tab')return;
      const items=controls(dialogRef.current);
      if(!items.length){event.preventDefault();dialogRef.current.focus();return;}
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      else if(!dialogRef.current.contains(document.activeElement)){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key,true);
    return()=>{
      document.removeEventListener('keydown',key,true);
      const index=dialogStack.lastIndexOf(token),wasTop=index===dialogStack.length-1;if(index>=0)dialogStack.splice(index,1);
      if(wasTop)queueMicrotask(()=>{
        const target=previous?.isConnected?previous:(previousId?document.getElementById(previousId):null);
        target?.focus();
      });
    };
  },[active,dialogRef]);
}
