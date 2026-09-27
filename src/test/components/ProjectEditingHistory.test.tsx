import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrumPresetSettings } from '../../components/drum/DrumPresetSettings';
import { DrumBulkEditModal } from '../../components/drum/DrumBulkEditModal';
import { AppContextProvider, useAppContext, useProjectHistory } from '../../context/AppContext';

const { importPresetFromFile } = vi.hoisted(() => ({ importPresetFromFile: vi.fn() }));
vi.mock('../../utils/presetImport', async () => {
  const actual = await vi.importActual<typeof import('../../utils/presetImport')>('../../utils/presetImport');
  return { ...actual, importPresetFromFile };
});

vi.mock('@carbon/react', async () => {
  const ReactModule = await import('react');
  return {
    Select: ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { labelText?: string; size?: string }) => {
      const { labelText: _labelText, size: _size, ...selectProps } = props;
      return <select {...selectProps}>{children}</select>;
    },
    SelectItem: ({ value, text }: { value: string; text: string }) => <option value={value}>{text}</option>,
    Slider: ({ id, value, min, max, step, onChange, onRelease, onPointerDownCapture, onKeyDownCapture, onKeyUp, onBlur }: {
      id: string; value: number; min: number; max: number; step: number;
      onChange: (data: { value: number }) => void; onRelease?: () => void;
      onPointerDownCapture?: React.PointerEventHandler<HTMLInputElement>;
      onKeyDownCapture?: React.KeyboardEventHandler<HTMLInputElement>;
      onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
      onBlur?: React.FocusEventHandler<HTMLInputElement>;
    }) => <input aria-label={id} type="range" min={min} max={max} step={step} value={value}
      onChange={event=>onChange({value:Number(event.target.value)})} onMouseUp={onRelease}
      onPointerDownCapture={onPointerDownCapture} onKeyDownCapture={onKeyDownCapture} onKeyUp={onKeyUp} onBlur={onBlur} />,
    Toggle: () => <ReactModule.Fragment />,
  };
});

function HistoryControls() {
  const { state, dispatch } = useAppContext();
  const { canUndo } = useProjectHistory();
  const loadTwo = () => {
    const actions = [0,1].map(index => ({
      type: 'LOAD_DRUM_SAMPLE' as const,
      payload: (() => {
        const audioBuffer = { duration:8/44100, sampleRate:44100, length:8, numberOfChannels:1 } as AudioBuffer;
        return {
        index,
        file: new File([String(index)], `${index}.wav`),
        audioBuffer,
        metadata: { format:'wav' as const, duration:8/44100, sampleRate:44100, bitDepth:16, channels:1, isFloat:false,
          audioBuffer, fileSize:1, midiNote:60, loopStart:0, loopEnd:0, hasLoopData:false },
      }; })(),
    }));
    dispatch({type:'BATCH_EDIT',payload:actions});
  };
  const setPreset = () => dispatch({type:'BATCH_EDIT',payload:[
    {type:'SET_DRUM_PRESET_PLAYMODE',payload:'mono'},
    {type:'SET_DRUM_PRESET_TRANSPOSE',payload:11},
    {type:'SET_DRUM_PRESET_VELOCITY',payload:42},
    {type:'SET_DRUM_PRESET_VOLUME',payload:55},
    {type:'SET_DRUM_PRESET_WIDTH',payload:66},
  ]});
  return <>
    <button onClick={()=>dispatch({type:'UNDO'})} disabled={!canUndo}>undo test</button>
    <button onClick={loadTwo}>load two</button>
    <button onClick={setPreset}>set preset</button>
    <output aria-label="preset-state">{JSON.stringify({
      ...state.drumSettings.presetSettings,
      imported:Boolean(state.importedDrumPreset),
    })}</output>
    <output aria-label="sample-state">{JSON.stringify(state.drumSamples.slice(0,2).map(sample=>({
      loaded:sample.isLoaded, reverse:sample.reverse, transpose:sample.transpose, gain:sample.gain, pan:sample.pan,
    })))}</output>
  </>;
}

function Setup({ bulk=false }: { bulk?: boolean }) {
  return <AppContextProvider>
    <HistoryControls />
    {bulk ? <DrumBulkEditModal isOpen onClose={()=>{}} /> : <DrumPresetSettings />}
  </AppContextProvider>;
}

describe('production compound edit history', () => {
  beforeEach(()=>importPresetFromFile.mockReset());

  it('undoes one preset import and one reset as complete operations', async () => {
    const imported = { type:'drum', engine:{ playmode:'legato', transpose:9, 'velocity.sensitivity':16384, volume:24576, width:8192 } };
    importPresetFromFile.mockResolvedValue({success:true,data:imported});
    const { container }=render(<Setup />);
    fireEvent.change(container.querySelector('input[type="file"]')!,{target:{files:[new File(['{}'],'patch.json')]}});
    await waitFor(()=>expect(screen.getByLabelText('preset-state')).toHaveTextContent('"imported":true'));
    fireEvent.click(screen.getByRole('button',{name:'undo test'}));
    expect(screen.getByLabelText('preset-state')).toHaveTextContent('{"playmode":"poly","transpose":0,"velocity":20,"volume":69,"width":0,"imported":false}');

    fireEvent.click(screen.getByRole('button',{name:'set preset'}));
    fireEvent.click(screen.getByRole('button',{name:'reset settings'}));
    fireEvent.click(screen.getByRole('button',{name:'ok'}));
    expect(screen.getByLabelText('preset-state')).toHaveTextContent('{"playmode":"poly","transpose":0,"velocity":20,"volume":69,"width":0,"imported":false}');
    fireEvent.click(screen.getByRole('button',{name:'undo test'}));
    expect(screen.getByLabelText('preset-state')).toHaveTextContent('{"playmode":"mono","transpose":11,"velocity":42,"volume":55,"width":66,"imported":false}');
  });

  it('undoes a bulk save for every loaded sample in one step', () => {
    const { container }=render(<Setup bulk />);
    fireEvent.click(screen.getByRole('button',{name:'load two'}));
    const selects=container.querySelectorAll('select');
    fireEvent.change(selects[1],{target:{value:'reverse'}});
    const ranges=container.querySelectorAll('input[type="range"]');
    fireEvent.change(ranges[0],{target:{value:'7'}});
    fireEvent.click(screen.getByRole('button',{name:'apply to 2 samples'}));
    expect(screen.getByLabelText('sample-state')).toHaveTextContent('"reverse":true');
    expect(screen.getByLabelText('sample-state')).toHaveTextContent('"transpose":7');
    fireEvent.click(screen.getByRole('button',{name:'undo test'}));
    expect(screen.getByLabelText('sample-state')).toHaveTextContent('[{"loaded":true,"reverse":false,"transpose":0,"gain":0,"pan":0},{"loaded":true,"reverse":false,"transpose":0,"gain":0,"pan":0}]');
  });

  it('coalesces one slider drag and keeps two completed gestures separate', () => {
    render(<Setup />);
    const slider=screen.getByLabelText('preset-transpose');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider,{target:{value:'2'}});
    fireEvent.change(slider,{target:{value:'4'}});
    fireEvent.mouseUp(slider);
    fireEvent.click(screen.getByRole('button',{name:'undo test'}));
    expect(screen.getByLabelText('preset-state')).toHaveTextContent('"transpose":0');

    fireEvent.pointerDown(slider);
    fireEvent.change(slider,{target:{value:'5'}});
    fireEvent.mouseUp(slider);
    fireEvent.pointerDown(slider);
    fireEvent.change(slider,{target:{value:'8'}});
    fireEvent.mouseUp(slider);
    fireEvent.click(screen.getByRole('button',{name:'undo test'}));
    expect(screen.getByLabelText('preset-state')).toHaveTextContent('"transpose":5');
    fireEvent.click(screen.getByRole('button',{name:'undo test'}));
    expect(screen.getByLabelText('preset-state')).toHaveTextContent('"transpose":0');
  });
});
