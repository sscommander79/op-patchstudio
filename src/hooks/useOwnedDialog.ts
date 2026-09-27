import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const dialogStack:symbol[]=[];

function controls(dialog:HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(control=>!control.hidden&&!control.closest('[hidden], [aria-hidden="true"]'));
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
      const target=dialog?.querySelector<HTMLElement>('[data-initial-focus="true"]')??(dialog?controls(dialog)[0]:null)??dialog;
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
