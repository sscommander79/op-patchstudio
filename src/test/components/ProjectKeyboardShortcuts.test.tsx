import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProjectKeyboardShortcuts } from '../../components/common/ProjectKeyboardShortcuts';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { AppContextProvider, useAppContext } from '../../context/AppContext';

function Harness({dialog=false}:{dialog?:boolean}) {
  const {state,dispatch}=useAppContext();
  return <>
    <ProjectKeyboardShortcuts />
    <output aria-label="name">{state.drumSettings.presetName}</output>
    <button onClick={()=>dispatch({type:'SET_DRUM_PRESET_NAME',payload:'A'})}>A</button>
    <button onClick={()=>dispatch({type:'SET_DRUM_PRESET_NAME',payload:'B'})}>B</button>
    <input aria-label="typing" />
    <select aria-label="choice"><option>one</option></select>
    <div aria-label="editor" contentEditable />
    {dialog && <div role="dialog" aria-modal="true"><button>modal action</button></div>}
  </>;
}

describe('project keyboard shortcuts', () => {
  it('undoes and redoes once while ignoring repeats and IME composition', () => {
    render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'A'})); fireEvent.click(screen.getByRole('button',{name:'B'}));
    fireEvent.keyDown(document,{key:'z',ctrlKey:true});
    expect(screen.getByLabelText('name')).toHaveTextContent('A');
    fireEvent.keyDown(document,{key:'z',ctrlKey:true,repeat:true});
    fireEvent.keyDown(document,{key:'z',ctrlKey:true,isComposing:true});
    expect(screen.getByLabelText('name')).toHaveTextContent('A');
    fireEvent.keyDown(document,{key:'z',ctrlKey:true,shiftKey:true});
    expect(screen.getByLabelText('name')).toHaveTextContent('B');
    fireEvent.keyDown(document,{key:'z',metaKey:true});
    expect(screen.getByLabelText('name')).toHaveTextContent('A');
    fireEvent.keyDown(document,{key:'y',ctrlKey:true});
    expect(screen.getByLabelText('name')).toHaveTextContent('B');
  });

  it('leaves editable controls and open dialogs in charge of their keys', () => {
    const view=render(<AppContextProvider><Harness /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'A'}));
    for(const target of [screen.getByLabelText('typing'),screen.getByLabelText('choice'),screen.getByLabelText('editor')]) {
      target.focus(); fireEvent.keyDown(target,{key:'z',ctrlKey:true});
      expect(screen.getByLabelText('name')).toHaveTextContent('A');
    }
    view.rerender(<AppContextProvider><Harness dialog /></AppContextProvider>);
    screen.getByRole('button',{name:'modal action'}).focus();
    fireEvent.keyDown(document,{key:'z',ctrlKey:true});
    expect(screen.getByLabelText('name')).toHaveTextContent('A');
  });

  it('does not undo underneath the real confirmation modal', () => {
    render(<AppContextProvider><Harness /><ConfirmationModal isOpen message="reset project?" onConfirm={()=>{}} onCancel={()=>{}} /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'A'}));
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('reset project?');
    screen.getByRole('button',{name:'ok'}).focus();
    fireEvent.keyDown(document,{key:'z',ctrlKey:true});
    expect(screen.getByLabelText('name')).toHaveTextContent('A');
  });
});
