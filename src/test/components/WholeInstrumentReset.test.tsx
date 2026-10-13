import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppContextProvider, useAppContext, useProjectHistory } from '../../context/AppContext';
import type { AppAction, AppState } from '../../context/AppContext';
import { DrumTool } from '../../components/drum/DrumTool';
import { MultisampleTool } from '../../components/multisample/MultisampleTool';
import { defaultDrumSettings, defaultMultisampleSettings } from '../../utils/defaultSettings';
import type { ImportedPresetJson } from '../../utils/jsonImport';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';

Object.defineProperty(HTMLElement.prototype,'scrollTo',{value:vi.fn(),configurable:true});

// Only leaf children are replaced. The tools, confirmation dialog, context, reducer and history are real.
vi.mock('../../utils/sessionStorageIndexedDB',()=>({sessionStorageIndexedDB:{resetSavedToLibraryFlag:vi.fn(()=>Promise.resolve())}}));
vi.mock('../../hooks/useAudioPlayer',()=>({useAudioPlayer:()=>({playWithADSR:vi.fn(),releaseNote:vi.fn(),stopCurrentPlayback:vi.fn(),stopAllNotes:vi.fn()})}));
vi.mock('../../hooks/useFileUpload',()=>({useFileUpload:()=>({handleDrumSampleUpload:vi.fn(),clearDrumSample:vi.fn(),handleMultisampleUpload:vi.fn(),clearMultisampleFile:vi.fn()})}));
vi.mock('../../components/common/RecordingModal',()=>({RecordingModal:()=>null}));
vi.mock('../../components/common/AudioProcessingSection',()=>({AudioProcessingSection:()=>null}));
vi.mock('../../components/drum/DrumKeyboardContainer',()=>({DrumKeyboardContainer:()=>null}));
vi.mock('../../components/drum/DrumFocusWorkspace',()=>({DrumFocusWorkspace:()=>null}));
vi.mock('../../components/drum/DrumSampleTable',()=>({DrumSampleTable:()=>null}));
vi.mock('../../components/drum/DrumPresetSettings',()=>({DrumPresetSettings:()=>null}));
vi.mock('../../components/drum/DrumBulkEditModal',()=>({DrumBulkEditModal:()=>null}));
vi.mock('../../components/drum/SliceAudioModal',()=>({SliceAudioModal:()=>null}));
vi.mock('../../components/drum/StudioDemoLoader',()=>({FirstPresetGuide:()=>null,KitSetupGuide:()=>null,StudioDemoLoader:()=>null}));
vi.mock('../../components/multisample/VirtualMidiKeyboard',()=>({VirtualMidiKeyboard:()=>null}));
vi.mock('../../components/multisample/MultisampleFocusWorkspace',()=>({MultisampleFocusWorkspace:()=>null}));
vi.mock('../../components/multisample/MultisampleSampleTable',()=>({MultisampleSampleTable:()=>null}));
vi.mock('../../components/multisample/MultisamplePresetSettings',()=>({MultisamplePresetSettings:()=>null}));
vi.mock('../../components/multisample/MultisampleGuide',()=>({MultisampleGuide:()=>null}));

const importedDrum = {name:'imported kit',octave:1,fx:{active:true,type:'z lowpass'},lfo:{active:true}} as ImportedPresetJson;
const importedMultisample = {name:'imported keys',octave:-1,fx:{active:true,type:'svf'},lfo:{active:false}} as ImportedPresetJson;

function seedActions(): AppAction[] {
  const asset = (name:string,midiNote:number) => {
    const audioBuffer = new AudioBuffer({length:4800,sampleRate:48000,numberOfChannels:1});
    return {file:new File([name],name),audioBuffer,metadata:{format:'wav' as const,duration:.1,sampleRate:48000,bitDepth:24,channels:1,isFloat:false,
      audioBuffer,fileSize:name.length,midiNote,loopStart:0,loopEnd:0,hasLoopData:false}};
  };
  return [
    {type:'LOAD_DRUM_SAMPLE',payload:{index:0,...asset('kick.wav',60)}},
    {type:'LOAD_DRUM_SAMPLE',payload:{index:5,...asset('snare.wav',60)}},
    {type:'UPDATE_DRUM_SAMPLE',payload:{index:5,updates:{reverse:true,pan:-30,gain:4}}},
    {type:'SET_DRUM_PRESET_NAME',payload:'seeded kit'},
    {type:'SET_DRUM_SAMPLE_RATE',payload:22050},
    {type:'SET_DRUM_BIT_DEPTH',payload:24},
    {type:'SET_DRUM_CHANNELS',payload:1},
    {type:'SET_DRUM_NORMALIZE',payload:true},
    {type:'SET_DRUM_NORMALIZE_LEVEL',payload:-3},
    {type:'SET_DRUM_AUTO_ZERO_CROSSING',payload:true},
    {type:'SET_DRUM_RENAME_FILES',payload:true},
    {type:'SET_DRUM_FILENAME_SEPARATOR',payload:'-'},
    {type:'SET_DRUM_AUDIO_FORMAT',payload:'aiff'},
    {type:'SET_DRUM_PRESET_PLAYMODE',payload:'mono'},
    {type:'SET_DRUM_PRESET_TRANSPOSE',payload:7},
    {type:'SET_DRUM_PRESET_VELOCITY',payload:55},
    {type:'SET_DRUM_PRESET_VOLUME',payload:80},
    {type:'SET_DRUM_PRESET_WIDTH',payload:40},
    {type:'SET_IMPORTED_DRUM_PRESET',payload:importedDrum},
    {type:'LOAD_MULTISAMPLE_FILE',payload:{...asset('C3.wav',60),rootNoteOverride:60}},
    {type:'LOAD_MULTISAMPLE_FILE',payload:{...asset('G3.wav',67),rootNoteOverride:67}},
    {type:'SET_MULTISAMPLE_PRESET_NAME',payload:'seeded keys'},
    {type:'SET_MULTISAMPLE_SAMPLE_RATE',payload:22050},
    {type:'SET_MULTISAMPLE_BIT_DEPTH',payload:24},
    {type:'SET_MULTISAMPLE_CHANNELS',payload:1},
    {type:'SET_MULTISAMPLE_NORMALIZE',payload:true},
    {type:'SET_MULTISAMPLE_NORMALIZE_LEVEL',payload:-4},
    {type:'SET_MULTISAMPLE_AUTO_ZERO_CROSSING',payload:true},
    {type:'SET_MULTISAMPLE_CUT_AT_LOOP_END',payload:true},
    {type:'SET_MULTISAMPLE_GAIN',payload:6},
    {type:'SET_MULTISAMPLE_LOOP_ENABLED',payload:false},
    {type:'SET_MULTISAMPLE_LOOP_ON_RELEASE',payload:false},
    {type:'SET_MULTISAMPLE_RENAME_FILES',payload:true},
    {type:'SET_MULTISAMPLE_FILENAME_SEPARATOR',payload:'-'},
    {type:'SET_MULTISAMPLE_AUDIO_FORMAT',payload:'aiff'},
    {type:'SET_MULTISAMPLE_PLAYMODE',payload:'legato'},
    {type:'SET_MULTISAMPLE_TRANSPOSE',payload:-5},
    {type:'SET_MULTISAMPLE_VELOCITY_SENSITIVITY',payload:64},
    {type:'SET_MULTISAMPLE_VOLUME',payload:33},
    {type:'SET_MULTISAMPLE_WIDTH',payload:77},
    {type:'SET_MULTISAMPLE_HIGHPASS',payload:12},
    {type:'SET_MULTISAMPLE_PORTAMENTO_TYPE',payload:'exponential'},
    {type:'SET_MULTISAMPLE_PORTAMENTO_AMOUNT',payload:45},
    {type:'SET_MULTISAMPLE_TUNING_ROOT',payload:9},
    {type:'SET_MULTISAMPLE_AMP_ENVELOPE',payload:{attack:1111,decay:2222,sustain:3333,release:4444}},
    {type:'SET_MULTISAMPLE_FILTER_ENVELOPE',payload:{attack:5555,decay:6666,sustain:7777,release:8888}},
    {type:'SET_IMPORTED_MULTISAMPLE_PRESET',payload:importedMultisample},
  ];
}

let current!: AppState;
let undoAvailable = false;

function Harness({ instrument }: { instrument:'drum'|'multisample' }) {
  const { state, dispatch } = useAppContext();
  const { canUndo } = useProjectHistory();
  current = state;
  undoAvailable = canUndo;
  return <>
    <button onClick={()=>dispatch({type:'BATCH_EDIT',payload:seedActions()})}>seed both instruments</button>
    <button onClick={()=>dispatch({type:'UNDO'})}>undo test</button>
    {instrument==='drum' ? <DrumTool/> : <MultisampleTool/>}
  </>;
}

type Instrument = {settings:unknown;imported:unknown;sounds:Array<{file:File|null;audioBuffer:AudioBuffer|null}>};
const drum = (state:AppState):Instrument => ({settings:state.drumSettings,imported:state.importedDrumPreset,sounds:state.drumSamples});
const multisample = (state:AppState):Instrument => ({settings:state.multisampleSettings,imported:state.importedMultisamplePreset,sounds:state.multisampleFiles});

/** Settings, imported metadata and per-sound edits by value; File and AudioBuffer assets by identity. */
function expectSameInstrument(actual:Instrument,expected:Instrument) {
  const metadata = (sounds:Instrument['sounds']) => sounds.map(sound=>({...sound,file:null,audioBuffer:null}));
  expect(actual.settings).toEqual(expected.settings);
  expect(actual.imported).toEqual(expected.imported);
  expect(metadata(actual.sounds)).toEqual(metadata(expected.sounds));
  actual.sounds.forEach((sound,index)=>{
    expect(sound.file).toBe(expected.sounds[index].file);
    expect(sound.audioBuffer).toBe(expected.sounds[index].audioBuffer);
  });
}

async function seedThenReset(instrument:'drum'|'multisample') {
  render(<AppContextProvider><Harness instrument={instrument}/></AppContextProvider>);
  fireEvent.click(screen.getByRole('button',{name:'seed both instruments'}));
  const seeded = current;
  // Guard the seed itself, so a rejected load cannot make the reset look complete.
  expect(seeded.drumSamples.filter(sample=>sample.isLoaded)).toHaveLength(2);
  expect(seeded.multisampleFiles).toHaveLength(2);
  expect(seeded.importedDrumPreset).toEqual(importedDrum);
  expect(seeded.importedMultisamplePreset).toEqual(importedMultisample);

  fireEvent.click(screen.getByRole('button',{name:'Reset whole instrument'}));
  expect(screen.getByRole('dialog')).toHaveTextContent(/imported preset data/i);
  fireEvent.click(screen.getByRole('button',{name:'ok'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  return seeded;
}

describe('when the saved-to-library marker cannot be written after the change is applied', () => {
  const cases = [
    {instrument:'drum',button:'Reset whole instrument',title:'instrument reset'},
    {instrument:'drum',button:'Clear all sounds',title:'all sounds removed'},
    {instrument:'multisample',button:'Reset whole instrument',title:'instrument reset'},
    {instrument:'multisample',button:'Clear all sounds',title:'all sounds removed'},
  ] as const;
  for (const {instrument,button,title} of cases) it(`${button} on the ${instrument} closes its dialog and warns about the marker only`, async () => {
    vi.mocked(sessionStorageIndexedDB.resetSavedToLibraryFlag).mockRejectedValueOnce(new Error('IndexedDB write failed'));
    render(<AppContextProvider><Harness instrument={instrument}/></AppContextProvider>);
    fireEvent.click(screen.getByRole('button',{name:'seed both instruments'}));
    expect(current.drumSamples.filter(sample=>sample.isLoaded)).toHaveLength(2);
    expect(current.multisampleFiles).toHaveLength(2);

    fireEvent.click(screen.getByRole('button',{name:button}));
    fireEvent.click(screen.getByRole('button',{name:'ok'}));
    // The dialog must not stay open offering "try again" for a change that already happened.
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText(/that did not finish/i)).not.toBeInTheDocument();

    if (instrument==='drum') expect(current.drumSamples.some(sample=>sample.isLoaded)).toBe(false);
    else expect(current.multisampleFiles).toEqual([]);
    expect(current.notifications.filter(notification=>notification.type==='error')).toEqual([]);
    expect(current.notifications.filter(notification=>notification.type==='warning')).toEqual([
      expect.objectContaining({title,message:expect.stringMatching(/change was applied.*saved-to-library marker/i)}),
    ]);
  });
});

describe('Reset whole instrument', () => {
  it('returns every drum setting and imported preset to factory values, leaves the multisample alone, and one undo restores the kit', async () => {
    const seeded = await seedThenReset('drum');

    // 0 selects "original" for the three format controls; every other value is the factory default.
    expect(current.drumSettings).toEqual({...defaultDrumSettings,sampleRate:0,bitDepth:0,channels:0});
    expect(current.importedDrumPreset).toBeNull();
    expect(current.drumSamples).toHaveLength(24);
    expect(current.drumSamples.some(sample=>sample.isLoaded||sample.file||sample.audioBuffer)).toBe(false);
    expect(current.projectGeneration).toBe((seeded.projectGeneration??0)+1);
    expectSameInstrument(multisample(current),multisample(seeded));

    fireEvent.click(screen.getByRole('button',{name:'undo test'}));
    expectSameInstrument(drum(current),drum(seeded));
    expectSameInstrument(multisample(current),multisample(seeded));
    // Exactly one history entry was spent on the reset: the seed is the only one left.
    expect(undoAvailable).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'undo test'}));
    expect(undoAvailable).toBe(false);
  });

  it('returns every multisample setting, envelope and imported preset to factory values, leaves the drum kit alone, and one undo restores it', async () => {
    const seeded = await seedThenReset('multisample');

    expect(current.multisampleSettings).toEqual({...defaultMultisampleSettings,sampleRate:0,bitDepth:0,channels:0});
    expect(current.importedMultisamplePreset).toBeNull();
    expect(current.multisampleFiles).toEqual([]);
    expect(current.projectGeneration).toBe((seeded.projectGeneration??0)+1);
    expectSameInstrument(drum(current),drum(seeded));

    fireEvent.click(screen.getByRole('button',{name:'undo test'}));
    expectSameInstrument(multisample(current),multisample(seeded));
    expectSameInstrument(drum(current),drum(seeded));
    expect(undoAvailable).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'undo test'}));
    expect(undoAvailable).toBe(false);
  });
});
