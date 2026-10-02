import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VirtualMidiKeyboard } from '../../components/multisample/VirtualMidiKeyboard';
import { AppContextProvider } from '../../context/AppContext';

vi.mock('../../hooks/useWebMidi',()=>({useWebMidi:()=>({
  onMidiEvent:vi.fn(()=>vi.fn()),state:{isSupported:true,isInitialized:true,isConnecting:false,devices:[]},initialize:vi.fn(),refreshDevices:vi.fn(),
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
  it('allows focused note activation and releases held notes on blur without repeats',()=>{
    const play=vi.fn(),release=vi.fn(),empty=vi.fn();
    render(<AppContextProvider><VirtualMidiKeyboard assignedNotes={[72]} onKeyClick={play} onKeyRelease={release} onUnassignedKeyClick={empty} isPinned={false} onTogglePin={()=>{}} /></AppContextProvider>);
    const key=screen.getByRole('button',{name:'MIDI note 72, loaded'});
    key.focus();fireEvent.keyDown(key,{key:'Enter'});fireEvent.keyDown(key,{key:'Enter',repeat:true});
    expect(play).toHaveBeenCalledTimes(1);expect(play).toHaveBeenCalledWith(72);
    fireEvent.blur(key);expect(release).toHaveBeenCalledTimes(1);expect(release).toHaveBeenCalledWith(72);
    fireEvent.keyUp(key,{key:'Enter'});expect(release).toHaveBeenCalledTimes(1);
    const unassigned=screen.getByRole('button',{name:'MIDI note 73, empty'});
    fireEvent.keyDown(unassigned,{key:' '});fireEvent.keyUp(unassigned,{key:' '});
    expect(empty).toHaveBeenCalledWith(73);
  });

  it('opens the MIDI panel and publishes channel changes without playing a note',()=>{
    const change=vi.fn(),play=vi.fn();
    render(<AppContextProvider><VirtualMidiKeyboard assignedNotes={[]} onKeyClick={play} onKeyRelease={vi.fn()} onMidiChannelChange={change} isPinned={false} onTogglePin={vi.fn()}/></AppContextProvider>);
    expect(screen.queryByRole('combobox',{name:'MIDI audition channel'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('connect midi devices'));
    fireEvent.change(screen.getByRole('combobox',{name:'MIDI audition channel'}),{target:{value:'16'}});
    expect(change).toHaveBeenCalledWith(16);expect(localStorage.setItem).toHaveBeenCalledWith('midi-channel','16');expect(play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('connect midi devices'));expect(screen.queryByRole('combobox',{name:'MIDI audition channel'})).not.toBeInTheDocument();
  });

  it.each(['window blur', 'deactivate', 'unmount'])('releases focused and physical notes on %s', (reason) => {
    const play=vi.fn(),release=vi.fn();
    const view=(active=true)=><AppContextProvider><VirtualMidiKeyboard assignedNotes={[72,74]} onKeyClick={play} onKeyRelease={release} isActive={active} isPinned={false} onTogglePin={()=>{}} /></AppContextProvider>;
    const mounted=render(view());
    fireEvent.keyDown(document,{key:'s',code:'KeyS'});
    fireEvent.keyDown(screen.getByRole('button',{name:'MIDI note 72, loaded'}),{key:'Enter'});
    expect(play.mock.calls).toEqual([[74],[72]]);
    if(reason==='window blur') fireEvent.blur(window);
    else if(reason==='deactivate') mounted.rerender(view(false));
    else mounted.unmount();
    expect(release.mock.calls.map(call=>call[0]).sort()).toEqual([72,74]);
    fireEvent.keyUp(document,{key:'s',code:'KeyS'});
    expect(release).toHaveBeenCalledTimes(2);
    if(reason==='deactivate') {
      fireEvent.keyDown(document,{key:'s',code:'KeyS'});
      expect(play).toHaveBeenCalledTimes(2);
    }
  });

  it('supports assistive click activation without duplicating a pointer gesture',async()=>{
    const play=vi.fn(),release=vi.fn(),empty=vi.fn();
    render(<AppContextProvider><VirtualMidiKeyboard assignedNotes={[72]} onKeyClick={play} onKeyRelease={release} onUnassignedKeyClick={empty} isPinned={false} onTogglePin={()=>{}} /></AppContextProvider>);
    const key=screen.getByRole('button',{name:'MIDI note 72, loaded'});
    await act(async()=>{fireEvent.click(key,{detail:0});});
    expect(play).toHaveBeenCalledTimes(1);expect(release).toHaveBeenCalledWith(72);
    fireEvent.mouseDown(key);fireEvent.mouseUp(key);fireEvent.click(key,{detail:1});
    expect(play).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button',{name:'MIDI note 73, empty'}),{detail:0});
    expect(empty).toHaveBeenCalledWith(73);
  });

  it.each(['mouseDown','touchStart'] as const)('releases a held pointer note after %s and window blur', (start) => {
    const play=vi.fn(),release=vi.fn();
    render(<AppContextProvider><VirtualMidiKeyboard assignedNotes={[72]} onKeyClick={play} onKeyRelease={release} isPinned={false} onTogglePin={()=>{}} /></AppContextProvider>);
    const key=screen.getByRole('button',{name:'MIDI note 72, loaded'});
    fireEvent[start](key);expect(play).toHaveBeenCalledWith(72);
    fireEvent.blur(window);expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(72);
  });

  it('releases assistive activation only after asynchronous playback has started',async()=>{
    let ready!:()=>void;
    const play=vi.fn(()=>new Promise<void>(resolve=>{ready=resolve;})),release=vi.fn();
    render(<AppContextProvider><VirtualMidiKeyboard assignedNotes={[72]} onKeyClick={play} onKeyRelease={release} isPinned={false} onTogglePin={()=>{}} /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'MIDI note 72, loaded'}),{detail:0});
    expect(play).toHaveBeenCalledWith(72);expect(release).not.toHaveBeenCalled();
    await act(async()=>{ready();});
    expect(release).toHaveBeenCalledExactlyOnceWith(72);
  });

  it('does not release a physical-key note when the pointer merely passes over it',()=>{
    const release=vi.fn();
    render(<AppContextProvider><VirtualMidiKeyboard assignedNotes={[72]} onKeyClick={vi.fn()} onKeyRelease={release} isPinned={false} onTogglePin={()=>{}} /></AppContextProvider>);
    fireEvent.keyDown(document,{key:'a'});
    const key=screen.getByRole('button',{name:'MIDI note 72, loaded'});
    fireEvent.mouseEnter(key);fireEvent.mouseLeave(key);
    expect(release).not.toHaveBeenCalled();
    fireEvent.keyUp(document,{key:'a'});expect(release).toHaveBeenCalledExactlyOnceWith(72);
  });

});
