import { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { shouldIgnoreKeyboardKeyDown } from '../../utils/keyboardOwnership';

export function ProjectKeyboardShortcuts() {
  const {dispatch}=useAppContext();
  useEffect(()=>{
    const onKeyDown=(event:KeyboardEvent) => {
      if(event.altKey || shouldIgnoreKeyboardKeyDown(event,{allowModifiers:true})) return;
      const modifier=event.metaKey || event.ctrlKey;
      const key=event.key.toLowerCase();
      const undo=modifier && key==='z' && !event.shiftKey;
      const redo=(modifier && key==='z' && event.shiftKey) || (event.ctrlKey && !event.metaKey && !event.shiftKey && key==='y');
      if(!undo && !redo) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(document.querySelector('[data-project-busy="true"]')) return;
      dispatch({type:undo?'UNDO':'REDO'});
    };
    document.addEventListener('keydown',onKeyDown,true);
    return ()=>document.removeEventListener('keydown',onKeyDown,true);
  },[dispatch]);
  return null;
}
