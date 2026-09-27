import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VirtualMidiKeyboard } from '../../components/multisample/VirtualMidiKeyboard';
import { AppContextProvider } from '../../context/AppContext';

vi.mock('../../hooks/useWebMidi',()=>({useWebMidi:()=>({
  onMidiEvent:vi.fn(()=>vi.fn()),state:{isInitialized:true,isConnecting:false,devices:[]},initialize:vi.fn(),refreshDevices:vi.fn(),
})}));
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});

describe('VirtualMidiKeyboard global key ownership', () => {
  it('releases the note captured at key-down after focus and octave change', () => {
    const onKeyClick=vi.fn(),onKeyRelease=vi.fn();
    render(<AppContextProvider><VirtualMidiKeyboard assignedNotes={[72,84]} onKeyClick={onKeyClick} onKeyRelease={onKeyRelease} isPinned={false} onTogglePin={()=>{}} /></AppContextProvider>);
    fireEvent.keyDown(document,{key:'a',ctrlKey:true});
    expect(onKeyClick).not.toHaveBeenCalled();
    fireEvent.keyDown(document,{key:'a'});
    expect(onKeyClick).toHaveBeenCalledWith(72);
    fireEvent.keyDown(document,{key:'x'});
    const input=document.createElement('input'); document.body.append(input); input.focus();
    fireEvent.keyUp(document,{key:'a'});
    expect(onKeyRelease).toHaveBeenCalledWith(72);
    expect(onKeyRelease).not.toHaveBeenCalledWith(84);
    input.remove();
  });

  it('leaves selects, dialogs, IME, repeats, and modified keys in charge', () => {
    const onKeyClick=vi.fn();
    render(<AppContextProvider><VirtualMidiKeyboard assignedNotes={[72,84]} onKeyClick={onKeyClick} isPinned={false} onTogglePin={()=>{}} /></AppContextProvider>);
    const select=document.createElement('select'); document.body.append(select); select.focus();
    fireEvent.keyDown(select,{key:'a'});
    select.remove();
    const dialog=document.createElement('div'); dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true'); document.body.append(dialog);
    fireEvent.keyDown(document,{key:'a'});
    dialog.remove();
    fireEvent.keyDown(document,{key:'a',isComposing:true});
    fireEvent.keyDown(document,{key:'a',repeat:true});
    fireEvent.keyDown(document,{key:'a',metaKey:true});
    expect(onKeyClick).not.toHaveBeenCalled();

    fireEvent.keyDown(document,{key:'x'});
    fireEvent.keyDown(document,{key:'x',repeat:true});
    fireEvent.keyDown(document,{key:'a'});
    expect(onKeyClick).toHaveBeenCalledWith(84);
  });
});
