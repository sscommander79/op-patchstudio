import {drumComputerKeyHint} from '../../components/drum/drumKeyboardBindings';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionRestorationModal } from '../../components/common/SessionRestorationModal';
import { WaveformZoomModal } from '../../components/common/WaveformZoomModal';
import { DrumBulkEditModal } from '../../components/drum/DrumBulkEditModal';
import { DrumKeyboard } from '../../components/drum/DrumKeyboard';
import { SliceAudioModal } from '../../components/drum/SliceAudioModal';
import { MultisampleFocusWorkspace } from '../../components/multisample/MultisampleFocusWorkspace';
import { MultisampleGuide } from '../../components/multisample/MultisampleGuide';
import { recordedNoteName } from '../../components/multisample/multisampleHelp';
import { initialState, useAppContext, type AppState, type DrumSample, type MultisampleFile } from '../../context/AppContext';

const audio=vi.hoisted(()=>({play:vi.fn().mockResolvedValue(undefined),playWithADSR:vi.fn(async(_audio:AudioBuffer,id:string):Promise<string|null>=>id),releaseNote:vi.fn(),stopCurrentPlayback:vi.fn()}));
vi.mock('../../hooks/useAudioPlayer',()=>({useAudioPlayer:()=>audio}));
vi.mock('../../hooks/useWebMidi',()=>({useWebMidi:()=>({onMidiEvent:vi.fn(()=>vi.fn()),state:{isSupported:true,isInitialized:true,isConnecting:false,devices:[],error:null},initialize:vi.fn(),refreshDevices:vi.fn()})}));
vi.mock('../../utils/audioContext',()=>({audioContextManager:{getCurrentTime:()=>0,getSampleRate:()=>10_000}}));
vi.mock('../../components/common/SmallWaveform',()=>({SmallWaveform:()=><div>waveform</div>}));
vi.mock('../../context/AppContext',async importOriginal=>{
  const actual=await importOriginal<typeof import('../../context/AppContext')>();
  return {...actual,useAppContext:vi.fn()};
});

const dispatch=vi.fn();
function provideState(state:AppState){vi.mocked(useAppContext).mockReturnValue({state,dispatch} as ReturnType<typeof useAppContext>);}
function buffer(frames=1000,sampleRate=10_000){const value=new AudioContext().createBuffer(1,frames,sampleRate);value.getChannelData(0)[100]=1;value.getChannelData(0)[500]=.8;return value;}
function drumSample(audioBuffer:AudioBuffer,name='break.wav'):DrumSample{return{file:new File(['source'],name,{type:'audio/wav'}),audioBuffer,name,isLoaded:true,inPoint:0,outPoint:audioBuffer.duration,playmode:'oneshot',reverse:false,transpose:0,pan:0,gain:0,hasBeenEdited:false,isAssigned:true,assignedKey:0,originalBitDepth:16,originalSampleRate:48_000,originalChannels:1,fileSize:6,duration:audioBuffer.duration,isFloat:false};}

beforeEach(()=>{dispatch.mockClear();audio.playWithADSR.mockClear();audio.releaseNote.mockClear();provideState(initialState);});

describe('recovery dialog',()=>{
  const info={timestamp:Date.UTC(2026,9,6,12),drumSamplesCount:1,multisampleFilesCount:2};

  it('names the discard as a discard and never treats Escape as a decision',()=>{
    const onStartNew=vi.fn().mockResolvedValue(undefined),onLoadSession=vi.fn();
    render(<SessionRestorationModal isOpen onLoadSession={onLoadSession} onStartNew={onStartNew} sessionInfo={info}/>);
    const dialog=screen.getByRole('dialog',{name:'Restore saved work?'});
    expect(dialog).toHaveTextContent('1 drum sample and 2 multisample files');
    expect(dialog).toHaveTextContent(/cannot be brought back/i);
    fireEvent.keyDown(document,{key:'Escape'});
    expect(onStartNew).not.toHaveBeenCalled();expect(onLoadSession).not.toHaveBeenCalled();
    expect(screen.queryByRole('button',{name:/^start new$/i})).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button',{name:'Discard saved work and start new'}));
    expect(onStartNew).toHaveBeenCalledOnce();expect(onLoadSession).not.toHaveBeenCalled();
  });

  it('keeps both choices unavailable while a recovery action is pending',()=>{
    render(<SessionRestorationModal isOpen pending onLoadSession={vi.fn()} onStartNew={vi.fn()} sessionInfo={info}/>);
    expect(screen.getByRole('button',{name:'Discard saved work and start new'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Restore saved work'})).toBeDisabled();
  });
});

describe('waveform Save for all guard',()=>{
  const makeBuffer=()=>new (AudioBuffer as unknown as new (...args:unknown[])=>AudioBuffer)(1,100,100);
  function open(extra:Partial<Parameters<typeof WaveformZoomModal>[0]>={}){
    const onSaveForAll=vi.fn(),onClose=vi.fn(),onSave=vi.fn();
    render(<WaveformZoomModal isOpen onClose={onClose} audioBuffer={makeBuffer()} initialInPoint={0.2} initialOutPoint={0.8} onSave={onSave} onSaveForAll={onSaveForAll} {...extra}/>);
    return {onSaveForAll,onClose,onSave};
  }

  it('states the sample count and scope before replacing every marker',()=>{
    const {onSaveForAll,onClose}=open({saveForAllCount:3,saveForAllScope:'loaded drum samples'});
    fireEvent.click(screen.getByRole('button',{name:'Save for all…'}));
    expect(onSaveForAll).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();
    const question=screen.getByRole('alert');
    expect(question).toHaveTextContent('Replace markers on 3 samples?');
    expect(question).toHaveTextContent('Samples affected: 3 (loaded drum samples).');
    expect(question).toHaveTextContent(/playback start and end on each one/);
    expect(question).not.toHaveTextContent(/loop start/);
    fireEvent.click(within(question).getByRole('button',{name:'Replace markers on 3 samples'}));
    expect(onSaveForAll).toHaveBeenCalledOnce();
    expect(onSaveForAll.mock.calls[0][0]).toMatchObject({inPoint:0.2,outPoint:0.8});
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('names the scope when the count is unknown and lists loop markers when they are included',()=>{
    open({initialLoopStart:0.3,initialLoopEnd:0.6});
    fireEvent.click(screen.getByRole('button',{name:'Save for all…'}));
    const question=screen.getByRole('alert');
    expect(question).toHaveTextContent('Replace markers on every loaded sample?');
    expect(question).toHaveTextContent('Scope: all loaded samples in this instrument.');
    expect(question).toHaveTextContent(/loop start and end, and loop crossfade/);
  });

  it('keeps the draft open when the question is declined or Escape is pressed',()=>{
    const {onSaveForAll,onClose}=open({saveForAllCount:1});
    fireEvent.click(screen.getByRole('button',{name:'Save for all…'}));
    expect(screen.getByRole('button',{name:'Replace markers on 1 sample'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Save for all…'}));
    fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Save markers'})).toBeInTheDocument();
    expect(onSaveForAll).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();
  });
});

describe('slicer draft guard',()=>{
  function props(){
    const sourceBuffer=buffer(),sourceSample=drumSample(sourceBuffer);
    const existingSamples=Array.from({length:24},(_,index)=>index===0?sourceSample:{...drumSample(sourceBuffer),file:null,audioBuffer:null,name:'',isLoaded:false,isAssigned:true,assignedKey:index});
    return {isOpen:true,onClose:vi.fn(),onApply:vi.fn(),existingSamples,projectAssets:existingSamples,commitResult:undefined,midiNoteMapping:'C3' as const,
      request:{kind:'existing' as const,source:{audioBuffer:sourceBuffer,file:sourceSample.file!,metadata:{format:'wav' as const,sampleRate:48_000,bitDepth:16,channels:1,duration:sourceBuffer.duration,audioBuffer:sourceBuffer,fileSize:6,midiNote:60,loopStart:0,loopEnd:sourceBuffer.duration,hasLoopData:false},existingIndex:0}}};
  }
  const ready=()=>screen.findByText('Sound 1 of 2');

  it('closes an untouched analyzed draft without asking, even after selecting and playing',async()=>{
    const input=props();render(<SliceAudioModal {...input}/>);await ready();
    await userEvent.click(screen.getByRole('button',{name:'Next sound'}));
    await userEvent.click(screen.getByRole('button',{name:'Select sound 1'}));
    await userEvent.click(screen.getByRole('button',{name:'Cancel'}));
    expect(input.onClose).toHaveBeenCalledOnce();
  });

  it('asks before Cancel, the backdrop or Escape discards an edited draft',async()=>{
    const input=props();render(<SliceAudioModal {...input}/>);await ready();
    await userEvent.click(screen.getByRole('button',{name:'Add sound'}));
    expect(screen.getByRole('button',{name:'Select sound 3'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button',{name:'Cancel'}));
    expect(input.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Discard your slicing changes\?.*sound boundaries or the list of sounds/);
    await userEvent.click(screen.getByRole('button',{name:'Keep editing'}));
    expect(screen.getByRole('button',{name:'Select sound 3'})).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('dialog',{name:'slice audio'}));
    expect(input.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button',{name:'Discard changes and close'})).toBeInTheDocument();
    // Escape answers the question with "keep", then asks again on the next attempt.
    fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.queryByRole('button',{name:'Discard changes and close'})).not.toBeInTheDocument();
    expect(input.onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document,{key:'Escape'});
    await userEvent.click(screen.getByRole('button',{name:'Discard changes and close'}));
    expect(input.onClose).toHaveBeenCalledOnce();expect(input.onApply).not.toHaveBeenCalled();
  });

  it('keeps a typed numeric draft and restores its focus after Escape and Keep editing',async()=>{
    const input=props();render(<SliceAudioModal {...input}/>);await ready();
    const start=screen.getByLabelText('Sound 1 Start');
    start.focus();fireEvent.change(start,{target:{value:'0.005'}});
    fireEvent.keyDown(document,{key:'Escape'});
    expect(input.onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button',{name:'Keep editing'}));
    await waitFor(()=>expect(start).toHaveFocus());
    expect(start).toHaveValue(.005);
    fireEvent.blur(start);expect(start).toHaveValue(.005);
    expect(input.onApply).not.toHaveBeenCalled();
  });

  it('treats a pad assignment as work worth keeping',async()=>{
    const input=props();render(<SliceAudioModal {...input}/>);await ready();
    await userEvent.click(screen.getByRole('button',{name:'Auto-fill empty keys'}));
    await userEvent.click(screen.getByRole('button',{name:'Cancel'}));
    expect(input.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/2 pad assignments/);
  });

  it('treats changed detection settings as work worth keeping',async()=>{
    const input=props();render(<SliceAudioModal {...input}/>);await ready();
    await userEvent.click(screen.getByText('Detection settings',{exact:true}));
    fireEvent.change(screen.getByLabelText('Minimum spacing milliseconds'),{target:{value:'45'}});
    await userEvent.click(screen.getByRole('button',{name:'Cancel'}));
    expect(input.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/detection settings/);
  });
});

describe('drum editing names and key hints',()=>{
  it('gives every bulk edit control an accessible name and one play-mode vocabulary',()=>{
    render(<DrumBulkEditModal isOpen onClose={vi.fn()}/>);
    const dialog=screen.getByRole('dialog',{name:'Bulk edit samples'});
    expect(within(dialog).getByRole('combobox',{name:'Play mode'})).toHaveValue('oneshot');
    expect(within(dialog).getByRole('combobox',{name:'Direction'})).toHaveValue('forward');
    expect(within(dialog).getByRole('option',{name:'Hold to play (Gate) – play while held'})).toHaveValue('gate');
    for(const name of ['Transpose slider (semitones)','Gain slider (dB)','Pan slider'])expect(within(dialog).getByRole('slider',{name})).toBeInTheDocument();
    for(const name of [/^Transpose \(semitones/,/^Gain \(dB/,/^Pan \(/])expect(within(dialog).getByRole('spinbutton',{name})).toBeInTheDocument();
    const unnamed=[...dialog.querySelectorAll('select, input')].filter(control=>!control.getAttribute('aria-label')&&!(control.id&&dialog.querySelector(`label[for="${control.id}"]`)));
    expect(unnamed).toHaveLength(0);
  });

  it('generates the drum hint from the drum bindings, which use R and not T',()=>{
    expect(drumComputerKeyHint.upperRow).toContain('R');
    expect([...drumComputerKeyHint.upperRow,...drumComputerKeyHint.lowerRow]).not.toContain('T');
    render(<DrumKeyboard/>);
    const inactive=screen.getByRole('group',{name:'Upper octave drum keys'});
    expect(inactive).toHaveTextContent('Use Z or X to switch pad banks');
    expect(screen.getByRole('group',{name:'Lower octave drum keys'})).toHaveTextContent('Computer keys active');
    fireEvent.keyDown(document,{key:'x'});
    expect(inactive).toHaveTextContent('Computer keys active');
  });

  it('shows the loaded sound name and pad number ahead of the slot abbreviation',()=>{
    const drumSamples=[...initialState.drumSamples];
    drumSamples[0]={...drumSample(buffer(),'kick_808.wav')};
    provideState({...initialState,drumSamples});
    render(<DrumKeyboard/>);
    const pad=screen.getByRole('button',{name:'KD1 drum key A'});
    expect(pad.querySelector('.studio-drum-pad-name')).toHaveTextContent(/^kick_808\s*1 · KD1$/);
    expect(pad).toHaveAttribute('title','Pad 1 · kick_808.wav · KD1 · computer key A');
    expect(screen.getByRole('button',{name:'SD1 drum key S'}).querySelector('.studio-drum-pad-name')).toHaveTextContent(/^3 · SD1$/);
  });
});

describe('multisample teaching',()=>{
  const sample={name:'pad.wav',inPoint:0,outPoint:2,loopStart:.5,loopEnd:1.5,rootNote:60} as MultisampleFile;

  it('keeps optional teaching collapsed once a recording is loaded',()=>{
    const {container}=render(<MultisampleGuide topic={null} sample={sample} loopEnabled={false} multiple={false}/>);
    expect(container.querySelectorAll('details').length).toBeGreaterThan(2);
    expect(container.querySelectorAll('details[open]')).toHaveLength(0);
    expect(screen.getByRole('heading', {name: 'Try your sound'})).toBeInTheDocument();
    expect(screen.getByText(/farther from the recorded note may sound less natural/)).toBeInTheDocument();
    expect(screen.getByText('How do I set good loop points?')).toBeInTheDocument();
  });

  it('explains the focused loop field and that looping creates no recordings',()=>{
    const {container}=render(<MultisampleGuide topic="loopStart" sample={sample} loopEnabled={false} multiple={false}/>);
    const context=container.querySelector('.studio-guide-context')!;
    expect(context).toHaveTextContent('Loop start');
    expect(context).toHaveTextContent(/does not create new recordings/);
    expect(context).toHaveTextContent(/Looping is off for this instrument/);
  });

  it('names recorded notes in the project octave convention',()=>{
    expect(recordedNoteName(60,'C3')).toBe('C3');
    expect(recordedNoteName(60,'C4')).toBe('C4');
    expect(recordedNoteName(61)).toBe('C#3');
    expect(recordedNoteName(128)).toBe('');
  });

  function loopable():MultisampleFile{
    const audioBuffer=new AudioContext().createBuffer(1,8000,8_000),channel=audioBuffer.getChannelData(0);
    for(let frame=1000;frame<7000;frame++)channel[frame]=Math.sin(2*Math.PI*frame/40)*.5;
    return {file:new File(['sustain'],'sustain.wav'),audioBuffer,name:'sustain.wav',isLoaded:true,rootNote:60,note:'C3',inPoint:0,outPoint:1,loopStart:2/8_000,loopEnd:6/8_000,
      originalBitDepth:16,originalSampleRate:8_000,originalChannels:1,fileSize:4,duration:1,isFloat:false};
  }
  function renderFocus(loopEnabled:boolean,onApplyLoopAndEnableLooping?:(index:number,loop:Pick<MultisampleFile,'loopStart'|'loopEnd'>)=>void){
    provideState({...initialState,multisampleFiles:[loopable()],multisampleSettings:{...initialState.multisampleSettings,loopEnabled}} as AppState);
    render(<MultisampleFocusWorkspace selectedIndex={0} onSelect={vi.fn()} onBrowse={vi.fn()} onReplace={vi.fn()} onClear={vi.fn()} onRecord={vi.fn()} onApplyLoopAndEnableLooping={onApplyLoopAndEnableLooping}/>);
    fireEvent.click(screen.getByRole('button',{name:'Analyze sound'}));
  }

  it('turns looping on only through the action that says so',()=>{
    const enable=vi.fn();renderFocus(false,enable);
    expect(screen.getByRole('status')).toHaveTextContent(/switches looping on for the whole instrument/);
    fireEvent.click(screen.getByRole('button',{name:'Apply loop and turn looping on'}));
    expect(enable).toHaveBeenCalledOnce();
    expect(enable).toHaveBeenCalledWith(0,{loopStart:expect.any(Number),loopEnd:expect.any(Number)});
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.queryByRole('button',{name:'Apply loop'})).not.toBeInTheDocument();
  });

  it('keeps plain Apply loop to markers only while looping is off',()=>{
    const enable=vi.fn();renderFocus(false,enable);
    fireEvent.click(screen.getByRole('button',{name:'Apply loop'}));
    expect(enable).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({type:'UPDATE_MULTISAMPLE_FILE',payload:{index:0,updates:{loopStart:expect.any(Number),loopEnd:expect.any(Number)}}});
  });

  it('does not offer the combined action without an owner or when looping is already on',()=>{
    renderFocus(false);
    expect(screen.queryByRole('button',{name:'Apply loop and turn looping on'})).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/use the Looping switch beside the loop points/);
  });

  it('reports looping as already on instead of offering to switch it',()=>{
    renderFocus(true,vi.fn());
    expect(screen.queryByRole('button',{name:'Apply loop and turn looping on'})).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Looping is on for this instrument/);
  });
});
