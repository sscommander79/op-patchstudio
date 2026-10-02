import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceAudioModal } from '../../components/drum/SliceAudioModal';
import { SLICE_DRAG_TYPE } from '../../components/drum/SliceKeyboardMapping';
import type { DrumSample } from '../../context/AppContext';
import { prepareSliceApplication } from '../../utils/audioSlicing';

const audioFormatMocks=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('../../utils/audioFormats',()=>({readAudioMetadataFromArrayBuffer:audioFormatMocks.read}));
const playWithADSR=vi.fn(async(_audio:AudioBuffer,id:string,options?:{onEnded?:()=>void}):Promise<string|null>=>{void options;return id;}),releaseNote=vi.fn();
vi.mock('../../hooks/useAudioPlayer',()=>({useAudioPlayer:()=>({playWithADSR,releaseNote})}));
let audioClock=10;
vi.mock('../../utils/audioContext',()=>({audioContextManager:{getCurrentTime:()=>audioClock,getSampleRate:()=>10_000}}));

const PositionalAudioBuffer=globalThis.AudioBuffer as unknown as new(numberOfChannels:number,length:number,sampleRate:number)=>AudioBuffer;
beforeAll(()=>vi.stubGlobal('AudioBuffer',class extends PositionalAudioBuffer{constructor(options:AudioBufferOptions){super(options.numberOfChannels??1,options.length??1,options.sampleRate);}}));
afterAll(()=>vi.unstubAllGlobals());

function audio(frames=1000,sampleRate=10_000){const value=new AudioContext().createBuffer(1,frames,sampleRate);value.getChannelData(0)[100]=1;value.getChannelData(0)[500]=.8;return value;}
function wavBytes(frames=1000){const bytes=new Uint8Array(44+frames*2),view=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('RIFF'),0);view.setUint32(4,bytes.length-8,true);bytes.set(new TextEncoder().encode('WAVEfmt '),8);view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,10_000,true);view.setUint32(28,20_000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);bytes.set(new TextEncoder().encode('data'),36);view.setUint32(40,frames*2,true);return bytes.buffer;}
function wavFile(name:string){return new File([wavBytes()],name,{type:'audio/wav'});}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
function sample(audioBuffer:AudioBuffer):DrumSample{return{file:new File(['source'],'break.wav',{type:'audio/wav'}),audioBuffer,name:'break.wav',isLoaded:true,inPoint:0,outPoint:audioBuffer.duration,playmode:'oneshot',reverse:false,transpose:0,pan:0,gain:0,hasBeenEdited:false,isAssigned:true,assignedKey:0,originalBitDepth:16,originalSampleRate:48_000,originalChannels:1,fileSize:6,duration:audioBuffer.duration,isFloat:false};}
function props(emptyPads=23){const sourceBuffer=audio(),sourceSample=sample(sourceBuffer);const existingSamples=Array.from({length:24},(_,index)=>index===0||index>emptyPads?sourceSample:{...sample(sourceBuffer),file:null,audioBuffer:null,name:'',isLoaded:false,isAssigned:true,assignedKey:index});return{isOpen:true,onClose:vi.fn(),onApply:vi.fn(),existingSamples,projectAssets:existingSamples,commitResult:undefined,request:{kind:'existing' as const,source:{audioBuffer:sourceBuffer,file:sourceSample.file!,metadata:{format:'wav' as const,sampleRate:48_000,bitDepth:16,channels:1,duration:sourceBuffer.duration,audioBuffer:sourceBuffer,fileSize:6,midiNote:60,loopStart:0,loopEnd:sourceBuffer.duration,hasLoopData:false},existingIndex:0}},midiNoteMapping:'C3' as const};}
async function ready(){await screen.findByText('Sound 1 of 2');}
async function advanced(){await userEvent.click(screen.getByText('Detection settings',{exact:true}));const timing=screen.queryByText('Detailed timing',{exact:true});if(timing)await userEvent.click(timing);}

describe('SliceAudioModal beginner workflow',()=>{
  beforeEach(()=>{vi.clearAllMocks();playWithADSR.mockImplementation(async(_audio:AudioBuffer,id:string)=>id);audioClock=10;});

  it('adds a manually selected sound without committing and keeps the source intact',async()=>{
    const input=props();render(<SliceAudioModal {...input}/>);await ready();await advanced();
    const original=input.request.source.audioBuffer;const samples=Array.from(original.getChannelData(0));
    await userEvent.click(screen.getByRole('button',{name:'Add sound'}));
    expect(screen.getByRole('button',{name:'Select sound 3'})).toBeInTheDocument();
    expect(input.onApply).not.toHaveBeenCalled();expect(Array.from(original.getChannelData(0))).toEqual(samples);
    await userEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(input.onClose).toHaveBeenCalledOnce();expect(input.onApply).not.toHaveBeenCalled();
  });

  it('shows one selected sound, linked navigation, human units, and no autoplay',async()=>{const input=props();render(<SliceAudioModal {...input}/>);await ready();
    expect(screen.getByRole('heading',{name:'Turn a loop into drum sounds'})).toBeInTheDocument();
    expect(screen.getByLabelText('Loop overview')).toBeInTheDocument();expect(screen.getByLabelText('Sound 1 waveform')).toBeInTheDocument();
    expect(screen.getByLabelText('Sound 1 Start')).toHaveValue(.01);expect(screen.getByLabelText('Sound 1 End')).toHaveValue(.05);
    expect(screen.getByRole('button',{name:'Select sound 1'})).toHaveAttribute('aria-pressed','true');expect(playWithADSR).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button',{name:'Next sound'}));expect(screen.getByText('Sound 2 of 2')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Select sound 2'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByText(/overlapping or mixed instruments cannot be separated/i)).toBeInTheDocument();
  });

  it('selects and auditions the exact clicked sound range',async()=>{const input=props();render(<SliceAudioModal {...input}/>);await ready();
    await userEvent.click(screen.getByRole('button',{name:'Select sound 2'}));
    expect(screen.getByText('Sound 2 of 2')).toBeInTheDocument();
    expect(playWithADSR).toHaveBeenLastCalledWith(input.request.source.audioBuffer,expect.any(String),expect.objectContaining({inFrame:500,outFrame:501}));
  });

  it('retriggers a numbered sound when its selected number is clicked again',async()=>{render(<SliceAudioModal {...props()}/>);await ready();const sound=screen.getByRole('button',{name:'Select sound 1'});
    await userEvent.click(sound);await userEvent.click(sound);
    expect(playWithADSR).toHaveBeenCalledTimes(2);expect(releaseNote).toHaveBeenCalledTimes(1);
  });

  it('cancels a late numbered preview during rapid clicks',async()=>{const first=deferred<string>();playWithADSR.mockImplementationOnce(()=>first.promise);render(<SliceAudioModal {...props()}/>);await ready();
    await userEvent.click(screen.getByRole('button',{name:'Select sound 1'}));await userEvent.click(screen.getByRole('button',{name:'Select sound 2'}));first.resolve('late-first-note');
    await waitFor(()=>expect(releaseNote).toHaveBeenCalledWith('late-first-note',true));expect(screen.getByText('Sound 2 of 2')).toBeInTheDocument();
  });

  it('edits one End independently and uses the same ranges for preview and Apply',async()=>{const input=props();render(<SliceAudioModal {...input}/>);await ready();
    fireEvent.change(screen.getByLabelText('Sound 1 End'),{target:{value:'0.040'}});fireEvent.blur(screen.getByLabelText('Sound 1 End'));
    await userEvent.click(screen.getByRole('button',{name:'Next sound'}));expect(screen.getByLabelText('Sound 2 Start')).toHaveValue(.05);
    await userEvent.click(screen.getByRole('button',{name:'Previous sound'}));await userEvent.click(screen.getByRole('button',{name:'Play sound'}));
    expect(playWithADSR).toHaveBeenLastCalledWith(input.request.source.audioBuffer,expect.any(String),expect.objectContaining({inFrame:100,outFrame:400}));
    await userEvent.click(screen.getByRole('button',{name:'Stop'}));await userEvent.click(screen.getByRole('button',{name:'Auto-fill empty keys'}));await userEvent.click(screen.getByRole('button',{name:'Add sounds to kit'}));await waitFor(()=>expect(input.onApply).toHaveBeenCalledTimes(1));
    expect(input.onApply.mock.calls[0][1].ranges).toEqual([{start:100,end:400},{start:500,end:501}]);expect(input.onApply.mock.calls[0][1].mapping).toEqual([1,2]);
  });

  it('does not round an untouched non-millisecond boundary when seconds receives focus',async()=>{const input=props(),prepareApplication=vi.fn(async(options:{ranges:readonly {start:number;end:number}[]})=>({actions:[],source:input.request.source,ranges:options.ranges,sourceIdentity:'source',targetKeys:[],assignedCount:0,overflowCount:0}));const analyzeAudio=vi.fn(async()=>({onsets:[4805],ranges:[{start:4805,end:9000}]}));const sourceBuffer=audio(10_000,48_000);input.request.source.audioBuffer=sourceBuffer;input.request.source.metadata.audioBuffer=sourceBuffer;render(<SliceAudioModal {...input} analyzeAudio={analyzeAudio} prepareApplication={prepareApplication as never}/>);await screen.findByText('Sound 1 of 1');const start=screen.getByLabelText('Sound 1 Start');await userEvent.click(start);await userEvent.tab();await userEvent.click(screen.getByRole('button',{name:'Auto-fill empty keys'}));await userEvent.click(screen.getByRole('button',{name:'Add sounds to kit'}));await waitFor(()=>expect(prepareApplication).toHaveBeenCalled());expect(prepareApplication.mock.calls[0][0].ranges).toEqual([{start:4805,end:9000}]);});

  it('keeps exact frame edits focused and clamps every sound to a nonempty source range',async()=>{render(<SliceAudioModal {...props()}/>);await ready();await advanced();const end=screen.getByLabelText('Sound 1 End frame');
    await userEvent.click(end);await userEvent.clear(end);await userEvent.type(end,'50{Enter}');expect(end).toHaveFocus();expect(end).toHaveValue(101);
    const start=screen.getByLabelText('Sound 1 Start frame');await userEvent.clear(start);await userEvent.type(start,'9999{Enter}');expect(start).toHaveValue(100);
  });

  it('does not destroy edits without an inline confirmation on reanalysis or reset',async()=>{render(<SliceAudioModal {...props()}/>);await ready();fireEvent.change(screen.getByLabelText('Sound 1 End'),{target:{value:'.04'}});fireEvent.blur(screen.getByLabelText('Sound 1 End'));await advanced();
    await userEvent.click(screen.getByRole('button',{name:'Detect sounds again'}));expect(screen.getByRole('alert')).toHaveTextContent(/replace your boundary edits/i);await userEvent.click(screen.getByRole('button',{name:'Keep edits'}));expect(screen.getByLabelText('Sound 1 End frame')).toHaveValue(400);
    await userEvent.click(screen.getByRole('button',{name:'Reset to full source'}));await userEvent.click(screen.getByRole('button',{name:'Replace edits'}));expect(screen.getByText('Sound 1 of 1')).toBeInTheDocument();expect(screen.getByLabelText('Sound 1 End frame')).toHaveValue(1000);
  });

  it('splits and deletes deterministically while preserving neighboring independent ranges',async()=>{render(<SliceAudioModal {...props()}/>);await ready();await advanced();
    await userEvent.click(screen.getByRole('button',{name:'Split sound'}));expect(screen.getByText('Sound 2 of 3')).toBeInTheDocument();expect(screen.getByLabelText('Sound 2 Start frame')).toHaveValue(300);expect(screen.getByLabelText('Sound 2 End frame')).toHaveValue(500);
    await userEvent.click(screen.getByRole('button',{name:'Delete sound'}));expect(screen.getByText('Sound 2 of 2')).toBeInTheDocument();expect(screen.getByLabelText('Sound 2 Start frame')).toHaveValue(500);
  });

  it('keeps advanced detection settings separate and accepts automatic ranges directly',async()=>{const input=props();const analyzeAudio=vi.fn(async()=>({onsets:[10,700],ranges:[{start:10,end:600},{start:700,end:900}]}));render(<SliceAudioModal {...input} analyzeAudio={analyzeAudio}/>);await ready();await advanced();
    fireEvent.change(screen.getByLabelText('Detection sensitivity'),{target:{value:'90'}});fireEvent.change(screen.getByLabelText('Minimum spacing milliseconds'),{target:{value:'2'}});await userEvent.click(screen.getByRole('button',{name:'Detect sounds again'}));
    await waitFor(()=>expect(screen.getByLabelText('Sound 1 End frame')).toHaveValue(600));await userEvent.click(screen.getByRole('button',{name:'Next sound'}));expect(screen.getByLabelText('Sound 2 Start frame')).toHaveValue(700);
  });

  it('starts manually unmapped and auto-fills only empty keys',async()=>{render(<SliceAudioModal {...props(1)}/>);await ready();expect(screen.getByText(/0 sounds are assigned\. 2 remain in Unassigned sounds/i)).toBeInTheDocument();const apply=screen.getByRole('button',{name:'Add sounds to kit'});expect(apply).toBeDisabled();await userEvent.click(screen.getByRole('button',{name:'Auto-fill empty keys'}));expect(screen.getByText(/1 sound is assigned\. 1 remains in Unassigned sounds/i)).toBeInTheDocument();expect(screen.getByRole('button',{name:/Pad 2, KD2, Sound 1/i})).toBeInTheDocument();await userEvent.click(screen.getByRole('checkbox'));expect(apply).toBeEnabled();});

  it('supports non-drag assignment, moving, replacement confirmation, preview, and unassign',async()=>{const input=props(1);render(<SliceAudioModal {...input}/>);await ready();const destination=screen.getByLabelText('Destination pad');await userEvent.selectOptions(destination,'8');await userEvent.click(screen.getByRole('button',{name:'Assign selected sound'}));expect(screen.getByRole('alert')).toHaveTextContent(/preserve the existing sound/i);await userEvent.click(screen.getByRole('button',{name:'Keep'}));await userEvent.selectOptions(destination,'1');await userEvent.click(screen.getByRole('button',{name:'Assign selected sound'}));expect(screen.getByRole('button',{name:/Pad 2, KD2, Sound 1/i})).toBeInTheDocument();await userEvent.selectOptions(destination,'2');await userEvent.click(screen.getByRole('button',{name:'Assign selected sound'}));expect(screen.getByRole('alert')).toHaveTextContent(/preserve the existing sound/i);await userEvent.click(screen.getByRole('button',{name:'Replace'}));expect(screen.getByRole('button',{name:/Pad 3, SD1, Sound 1/i})).toBeInTheDocument();expect(screen.getByRole('button',{name:/Pad 2, KD2, Empty/i})).toBeInTheDocument();await userEvent.click(screen.getByRole('button',{name:/Pad 3, SD1, Sound 1/i}));expect(playWithADSR).toHaveBeenLastCalledWith(input.request.source.audioBuffer,expect.any(String),expect.objectContaining({inFrame:100,outFrame:500}));await userEvent.click(screen.getByRole('button',{name:'Unassign pad sound'}));expect(screen.getByText(/0 sounds are assigned/i)).toBeInTheDocument();});

  it('confirms before replacing another staged sound and Keep preserves it',async()=>{render(<SliceAudioModal {...props()}/>);await ready();const destination=screen.getByLabelText('Destination pad');await userEvent.selectOptions(destination,'1');await userEvent.click(screen.getByRole('button',{name:'Assign selected sound'}));await userEvent.click(screen.getByRole('button',{name:'Select sound 2'}));await userEvent.click(screen.getByRole('button',{name:'Assign selected sound'}));expect(screen.getByRole('alert')).toHaveTextContent(/Sound 1.*Unassigned/i);await userEvent.click(screen.getByRole('button',{name:'Keep'}));expect(screen.getByRole('button',{name:/Pad 2, KD2, Sound 1/i})).toBeInTheDocument();await userEvent.click(screen.getByRole('button',{name:'Assign selected sound'}));await userEvent.click(screen.getByRole('button',{name:'Replace'}));expect(screen.getByRole('button',{name:/Pad 2, KD2, Sound 2/i})).toBeInTheDocument();expect(screen.getByText(/1 sound is assigned\. 1 remains in Unassigned sounds/i)).toBeInTheDocument();});

  it('accepts only an internal current range id on drop and moves a staged sound',async()=>{render(<SliceAudioModal {...props()}/>);await ready();const sound=screen.getByRole('button',{name:'Select sound 1'}),pad9=screen.getByRole('button',{name:/Pad 9, CH, Empty/i});const values=new Map<string,string>(),dataTransfer={types:[SLICE_DRAG_TYPE],effectAllowed:'none',setData:(type:string,value:string)=>values.set(type,value),getData:(type:string)=>values.get(type)??''};fireEvent.dragStart(sound,{dataTransfer});fireEvent.drop(pad9,{dataTransfer});expect(screen.getByRole('button',{name:/Pad 9, CH, Sound 1/i})).toBeInTheDocument();const invalid={types:[SLICE_DRAG_TYPE],getData:()=> 'stale-sound'};fireEvent.drop(screen.getByRole('button',{name:/Pad 10, CL, Empty/i}),{dataTransfer:invalid});expect(screen.getByRole('button',{name:/Pad 10, CL, Empty/i})).toBeInTheDocument();const rangeId=values.get(SLICE_DRAG_TYPE)!,external={types:['text/plain'],getData:()=>rangeId};fireEvent.drop(screen.getByRole('button',{name:/Pad 10, CL, Empty/i}),{dataTransfer:external});expect(screen.getByRole('button',{name:/Pad 10, CL, Empty/i})).toBeInTheDocument();});

  it('keeps the original assignment through split and clears mapping on delete and confirmed reset',async()=>{render(<SliceAudioModal {...props()}/>);await ready();await userEvent.selectOptions(screen.getByLabelText('Destination pad'),'8');await userEvent.click(screen.getByRole('button',{name:'Assign selected sound'}));await advanced();await userEvent.click(screen.getByRole('button',{name:'Split sound'}));expect(screen.getByRole('button',{name:/Pad 9, CH, Sound 1/i})).toBeInTheDocument();await userEvent.click(screen.getByRole('button',{name:'Delete sound'}));expect(screen.getByRole('button',{name:/Pad 9, CH, Sound 1/i})).toBeInTheDocument();await userEvent.click(screen.getByRole('button',{name:'Select sound 1'}));await userEvent.click(screen.getByRole('button',{name:'Stop'}));await userEvent.click(screen.getByRole('button',{name:'Delete sound'}));expect(screen.getByRole('button',{name:/Pad 9, CH, Empty/i})).toBeInTheDocument();await userEvent.selectOptions(screen.getByLabelText('Destination pad'),'9');await userEvent.click(screen.getByRole('button',{name:'Assign selected sound'}));await userEvent.click(screen.getByRole('button',{name:'Reset to full source'}));expect(screen.getByRole('alert')).toHaveTextContent(/boundary edits and assignments/i);await userEvent.click(screen.getByRole('button',{name:'Replace edits'}));expect(screen.getByText(/0 sounds are assigned/i)).toBeInTheDocument();});

  it('failed preview startup stays stopped, reports failure and permits retry',async()=>{
    render(<SliceAudioModal {...props()}/>);await ready();
    playWithADSR.mockResolvedValueOnce(null);
    await userEvent.click(screen.getByRole('button',{name:'Play sound'}));
    expect(screen.getByRole('button',{name:'Stop'})).toBeDisabled();
    expect(screen.getByLabelText('Sound 1 End')).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/could not play/i);
    await userEvent.click(screen.getByRole('button',{name:'Play sound'}));
    expect(screen.getByRole('button',{name:'Stop'})).toBeEnabled();
    expect(screen.queryByText(/could not play/i)).not.toBeInTheDocument();
  });

  it('ignores a failed preview that settles after closing without releasing a phantom note',async()=>{
    const input=props(),view=render(<SliceAudioModal {...input}/>);await ready();
    const late=deferred<string|null>();playWithADSR.mockImplementationOnce(()=>late.promise);
    await userEvent.click(screen.getByRole('button',{name:'Play sound'}));
    view.rerender(<SliceAudioModal {...input} isOpen={false} request={null}/>);
    await act(async()=>{late.resolve(null);await late.promise;});
    expect(screen.queryByText(/could not play/i)).not.toBeInTheDocument();
    expect(releaseNote).not.toHaveBeenCalled();
  });

  it('changing selected sound stops owned playback and editing is disabled while playing',async()=>{render(<SliceAudioModal {...props()}/>);await ready();await userEvent.click(screen.getByRole('button',{name:'Play sound'}));expect(screen.getByLabelText('Sound 1 End')).toBeDisabled();await userEvent.click(screen.getByRole('button',{name:'Next sound'}));expect(releaseNote).toHaveBeenCalledTimes(1);expect(screen.getByLabelText('Sound 2 End')).toBeEnabled();});

  it('stops owned playback before an unedited reset replaces ranges',async()=>{render(<SliceAudioModal {...props()}/>);await ready();await advanced();await userEvent.click(screen.getByRole('button',{name:'Play sound'}));await userEvent.click(screen.getByRole('button',{name:'Reset to full source'}));expect(releaseNote).toHaveBeenCalledTimes(1);expect(screen.getByText('Sound 1 of 1')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Play sound'})).toBeEnabled();});

  it('captures a clock split only while the dialog owns the M shortcut',async()=>{render(<SliceAudioModal {...props()}/>);await ready();await advanced();await userEvent.click(screen.getByRole('button',{name:'Reset to full source'}));await userEvent.click(screen.getByRole('button',{name:'Play source'}));audioClock=10.004;fireEvent.keyDown(document,{key:'m'});expect(screen.getByText('Sound 2 of 2')).toBeInTheDocument();expect(screen.getByLabelText('Sound 2 Start frame')).toHaveValue(40);fireEvent.keyDown(screen.getByLabelText('Sound 2 Start frame'),{key:'m'});expect(screen.getAllByRole('button',{name:/Select sound/})).toHaveLength(2);});

  it('keeps an edited draft when stale analysis finishes',async()=>{const held=deferred<{onsets:number[];ranges:Array<{start:number;end:number}>}>();render(<SliceAudioModal {...props()} analyzeAudio={vi.fn(()=>held.promise)}/>);await advanced();await userEvent.click(screen.getByRole('button',{name:'Start manual editing'}));expect(screen.getByText('Sound 1 of 1')).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Sound 1 End'),{target:{value:'.08'}});fireEvent.blur(screen.getByLabelText('Sound 1 End'));await act(async()=>held.resolve({onsets:[100,500],ranges:[{start:100,end:500},{start:500,end:501}]}));expect(screen.getByText('Sound 1 of 1')).toBeInTheDocument();expect(screen.getByLabelText('Sound 1 End')).toHaveValue(.08);});

  it('does not let a stale file read replace a newer source',async()=>{const input=props(),oldRead=deferred<ArrayBuffer>(),newRead=deferred<ArrayBuffer>(),oldFile=wavFile('old.wav'),newFile=wavFile('new.wav');Object.defineProperty(oldFile,'arrayBuffer',{value:vi.fn(()=>oldRead.promise)});Object.defineProperty(newFile,'arrayBuffer',{value:vi.fn(()=>newRead.promise)});audioFormatMocks.read.mockImplementation(async(_bytes:ArrayBuffer,name:string,size:number)=>{const decoded=audio(name==='new.wav'?900:800);return{format:'wav',sampleRate:10_000,bitDepth:16,channels:1,duration:decoded.duration,audioBuffer:decoded,fileSize:size,midiNote:60,loopStart:0,loopEnd:decoded.duration,hasLoopData:false};});const view=render(<SliceAudioModal {...input} request={{kind:'file',file:oldFile}}/>);view.rerender(<SliceAudioModal {...input} request={{kind:'file',file:newFile}}/>);newRead.resolve(wavBytes());await waitFor(()=>expect(screen.getByText('new.wav',{exact:false})).toBeInTheDocument());await act(async()=>oldRead.resolve(wavBytes()));expect(screen.queryByText('old.wav',{exact:false})).not.toBeInTheDocument();});

  it('preserves cancel/apply atomicity and commit receipt handling',async()=>{const input=props(),view=render(<SliceAudioModal {...input}/>);await ready();await userEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(input.onApply).not.toHaveBeenCalled();expect(input.onClose).toHaveBeenCalledTimes(1);view.rerender(<SliceAudioModal {...input}/>);await ready();await userEvent.click(screen.getByRole('button',{name:'Auto-fill empty keys'}));await userEvent.click(screen.getByRole('button',{name:'Add sounds to kit'}));await waitFor(()=>expect(input.onApply).toHaveBeenCalled());const [operationId]=input.onApply.mock.calls[0];view.rerender(<SliceAudioModal {...input} commitResult={{operationId,status:'rejected',error:'Project filled while preparing; retry.'}}/>);expect(await screen.findByRole('alert')).toHaveTextContent(/project filled/i);expect(input.onClose).toHaveBeenCalledTimes(1);});

  it('releases active and late-starting owned previews on apply and close',async()=>{const input=props(),view=render(<SliceAudioModal {...input}/>);await ready();await userEvent.click(screen.getByRole('button',{name:'Play sound'}));await userEvent.click(screen.getByRole('button',{name:'Stop'}));expect(releaseNote).toHaveBeenCalledTimes(1);const late=deferred<string>();playWithADSR.mockImplementationOnce(()=>late.promise);await userEvent.click(screen.getByRole('button',{name:'Play sound'}));view.rerender(<SliceAudioModal {...input} isOpen={false} request={null}/>);late.resolve('late-owned-note');await waitFor(()=>expect(releaseNote).toHaveBeenCalledWith('late-owned-note',true));});
});

it('selected waveform pointer changes only the draft and Cancel leaves its source intact',async()=>{
 const input=props();render(<SliceAudioModal {...input}/>);await ready();const originalBytes=Array.from(input.request.source.audioBuffer.getChannelData(0));const canvas=screen.getByLabelText('Sound 1 waveform');vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:1000,height:180,right:1000,bottom:180,x:0,y:0,toJSON:()=>({})});const before=[screen.getByLabelText('Sound 1 Start').getAttribute('value'),screen.getByLabelText('Sound 1 End').getAttribute('value')];const event=new Event('pointerdown',{bubbles:true,cancelable:true});Object.defineProperties(event,{clientX:{value:300},pointerId:{value:1}});fireEvent(canvas,event);expect([screen.getByLabelText('Sound 1 Start').getAttribute('value'),screen.getByLabelText('Sound 1 End').getAttribute('value')]).not.toEqual(before);fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(input.onApply).not.toHaveBeenCalled();expect(Array.from(input.request.source.audioBuffer.getChannelData(0))).toEqual(originalBytes);expect(input.onClose).toHaveBeenCalledOnce();
});


describe('slicer organization and decision safety',()=>{
  it('unassigns a staged replacement first and restores the original before a second unassignment',async()=>{
    const input=props(1),prepareApplication=vi.fn(prepareSliceApplication);render(<SliceAudioModal {...input} prepareApplication={prepareApplication}/>);await ready();
    await userEvent.click(screen.getByRole('button',{name:'Pad 3, SD1, break.wav'}));await userEvent.click(screen.getByRole('button',{name:'Assign selected sound'}));await userEvent.click(screen.getByRole('button',{name:'Replace'}));
    await userEvent.click(screen.getByRole('button',{name:'Unassign pad sound'}));
    expect(screen.getByRole('button',{name:'Pad 3, SD1, break.wav'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button',{name:'Unassign pad sound'}));expect(screen.getByRole('button',{name:'Pad 3, SD1, Empty'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));await userEvent.click(screen.getByRole('button',{name:'Add sounds to kit'}));await waitFor(()=>expect(input.onApply).toHaveBeenCalledOnce());
    expect(prepareApplication.mock.calls[0][0].unassignmentApprovals).toEqual([{targetKeyIndex:2,sample:input.existingSamples[2]}]);
  });

  it('shows a changed loaded pad and allows its unassignment to be reviewed again',async()=>{
    const input=props(1),prepareApplication=vi.fn(prepareSliceApplication),view=render(<SliceAudioModal {...input} prepareApplication={prepareApplication}/>);await ready();
    await userEvent.click(screen.getByRole('button',{name:'Pad 3, SD1, break.wav'}));await userEvent.click(screen.getByRole('button',{name:'Unassign pad sound'}));
    const changed={...input.existingSamples[2],name:'changed.wav',gain:8},existingSamples=input.existingSamples.map((sample,index)=>index===2?changed:sample);
    view.rerender(<SliceAudioModal {...input} existingSamples={existingSamples} projectAssets={existingSamples} prepareApplication={prepareApplication}/>);
    expect(screen.getByRole('button',{name:'Pad 3, SD1, changed.wav'})).toBeInTheDocument();expect(screen.getByRole('alert')).toHaveTextContent(/changed.*unassignment.*cancelled/i);await userEvent.click(screen.getByRole('button',{name:'Play sound'}));expect(screen.getByRole('alert')).toHaveTextContent(/changed.*unassignment.*cancelled/i);await userEvent.click(screen.getByRole('button',{name:'Stop'}));
    await userEvent.click(screen.getByRole('button',{name:'Unassign pad sound'}));await userEvent.click(screen.getByRole('checkbox'));await userEvent.click(screen.getByRole('button',{name:'Add sounds to kit'}));await waitFor(()=>expect(input.onApply).toHaveBeenCalledOnce());
    expect(prepareApplication.mock.calls[0][0].unassignmentApprovals).toEqual([{targetKeyIndex:2,sample:changed}]);
  });

  it('auto-fills an explicitly freed source pad with the exact approval and keeps manual Add available with no slices',async()=>{
    const input=props(0),prepareApplication=vi.fn(prepareSliceApplication);render(<SliceAudioModal {...input} prepareApplication={prepareApplication}/>);await ready();
    await userEvent.click(screen.getByRole('button',{name:'Unassign pad sound'}));await userEvent.click(screen.getByRole('button',{name:'Auto-fill empty keys'}));
    await userEvent.click(screen.getByRole('checkbox'));await userEvent.click(screen.getByRole('button',{name:'Add sounds to kit'}));await waitFor(()=>expect(input.onApply).toHaveBeenCalledOnce());
    expect(prepareApplication.mock.calls[0][0].replacementApprovals).toEqual([{targetKeyIndex:0,sample:input.existingSamples[0]}]);
    expect(prepareApplication.mock.calls[0][0].unassignmentApprovals).toEqual([]);
  });

  it('does not steal replacement focus when the preview ends',async()=>{
    render(<SliceAudioModal {...props(1)}/>);await ready();await userEvent.click(screen.getByRole('button',{name:'Play sound'}));
    await userEvent.click(screen.getByRole('button',{name:'Pad 3, SD1, break.wav'}));await userEvent.click(screen.getByRole('button',{name:'Assign selected sound'}));
    const replace=screen.getByRole('button',{name:'Replace'});replace.focus();
    const options=playWithADSR.mock.calls.at(-1)![2] as {onEnded:()=>void};act(()=>options.onEnded());expect(replace).toHaveFocus();
  });

  it('can add a manual sound after deleting every detected sound',async()=>{
    render(<SliceAudioModal {...props()}/>);await ready();await userEvent.click(screen.getByRole('button',{name:'Delete sound'}));await userEvent.click(screen.getByRole('button',{name:'Delete sound'}));
    expect(screen.getByRole('button',{name:'Add sound'})).toBeEnabled();await userEvent.click(screen.getByRole('button',{name:'Add sound'}));expect(screen.getByRole('button',{name:'Select sound 1'})).toBeInTheDocument();
  });

  it('places numbered sounds below the waveform and lets loaded pads be selected and unassigned without applying',async()=>{
    const input=props(1);render(<SliceAudioModal {...input}/>);await ready();
    const waveform=screen.getByLabelText('Sound 1 waveform'),selector=screen.getByRole('button',{name:'Select sound 1'});
    expect(waveform.nextElementSibling).toContainElement(selector);
    expect(waveform.nextElementSibling).toHaveClass('studio-slicer-sounds');
    await userEvent.click(screen.getByRole('button',{name:'Pad 3, SD1, break.wav'}));
    expect(screen.getByLabelText('Destination pad')).toHaveValue('2');
    await userEvent.click(screen.getByRole('button',{name:'Unassign pad sound'}));
    expect(screen.getByRole('button',{name:'Pad 3, SD1, Empty'})).toBeInTheDocument();
    expect(input.existingSamples[2].isLoaded).toBe(true);expect(input.onApply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(input.onApply).not.toHaveBeenCalled();
  });

  it('accepts a dropped replacement on the original source pad after an explicit Keep or Replace decision',async()=>{
    const input=props();render(<SliceAudioModal {...input}/>);await ready();
    const dataTransfer={types:[SLICE_DRAG_TYPE],getData:()=> 'sound-1'};
    fireEvent.drop(screen.getByRole('button',{name:'Pad 1, KD1, break.wav'}),{dataTransfer});
    expect(screen.getByRole('alert')).toHaveTextContent(/preserve the existing sound/i);
    await userEvent.click(screen.getByRole('button',{name:'Keep'}));
    expect(screen.getByRole('button',{name:'Pad 1, KD1, break.wav'})).toBeInTheDocument();
    fireEvent.drop(screen.getByRole('button',{name:'Pad 1, KD1, break.wav'}),{dataTransfer});
    await userEvent.click(screen.getByRole('button',{name:'Replace'}));
    expect(screen.getByRole('button',{name:'Pad 1, KD1, Sound 1'})).toBeInTheDocument();
    expect(screen.getByLabelText('Destination pad')).toHaveValue('0');
    expect(input.existingSamples[0].audioBuffer).toBe(input.request.source.audioBuffer);
  });

  it('keeps slice editing discoverable without expanding detection settings',async()=>{
    render(<SliceAudioModal {...props()}/>);await ready();
    const make=screen.getByRole('region',{name:'Make slices'});
    const edit=screen.getByRole('region',{name:'Edit and listen'});
    const assign=screen.getByRole('region',{name:'Assign to keys'});
    expect(within(make).getByRole('button',{name:'Reset to full source'})).toBeVisible();
    expect(within(edit).getByRole('button',{name:'Split sound'})).toBeVisible();
    expect(within(edit).getByRole('button',{name:'Delete sound'})).toBeVisible();
    expect(within(assign).getByLabelText('Destination pad')).toBeVisible();
    expect(screen.getByLabelText('Detection sensitivity')).not.toBeVisible();
    await userEvent.click(screen.getByText('Detection settings',{exact:true}));
    expect(screen.getByLabelText('Detection sensitivity')).toBeVisible();
    expect(screen.getByLabelText('Sound 1 Start frame')).not.toBeVisible();
    await userEvent.click(screen.getByText('Detailed timing',{exact:true}));
    expect(screen.getByLabelText('Sound 1 Start frame')).toBeVisible();
    expect(screen.getByLabelText('Sound 1 Start')).toHaveValue(.01);
  });

  it.each(['Reset to full source','Detect sounds again'])('blocks competing draft edits while %s waits for a decision and Keep preserves the exact draft',async(action)=>{
    const input=props();render(<SliceAudioModal {...input}/>);await ready();await advanced();
    fireEvent.change(screen.getByLabelText('Sound 1 End'),{target:{value:'.04'}});fireEvent.blur(screen.getByLabelText('Sound 1 End'));
    await userEvent.click(screen.getByRole('button',{name:'Auto-fill empty keys'}));
    const tile=screen.getByRole('button',{name:'Select sound 1'}),values=new Map<string,string>();
    const dataTransfer={types:[SLICE_DRAG_TYPE],effectAllowed:'none',setData:(type:string,value:string)=>values.set(type,value),getData:(type:string)=>values.get(type)??''};
    fireEvent.dragStart(tile,{dataTransfer});
    await userEvent.click(screen.getByRole('button',{name:action}));
    expect(screen.getByRole('alert')).toHaveTextContent(/replace your boundary edits and assignments/i);
    for(const name of ['Split sound','Add sound','Delete sound','Assign selected sound','Unassign pad sound','Auto-fill empty keys','Add sounds to kit','Reset to full source','Detect sounds again','Select sound 1']) expect(screen.getByRole('button',{name})).toBeDisabled();
    expect(screen.getByLabelText('Sound 1 End')).toBeDisabled();expect(screen.getByLabelText('Sound 1 End frame')).toBeDisabled();
    fireEvent.drop(screen.getByRole('button',{name:'Pad 9, CH, Empty'}),{dataTransfer});
    fireEvent.pointerDown(screen.getByLabelText('Sound 1 waveform'),{clientX:100,pointerId:1});
    expect(screen.getByRole('button',{name:'Pad 2, KD2, Sound 1'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Pad 9, CH, Empty'})).toBeInTheDocument();
    expect(screen.getByLabelText('Sound 1 End frame')).toHaveValue(400);
    expect(screen.getByRole('button',{name:'Cancel'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button',{name:'Keep edits'}));
    expect(screen.getByText('Sound 1 of 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Sound 1 End frame')).toHaveValue(400);
    await userEvent.click(screen.getByRole('button',{name:'Add sounds to kit'}));
    await waitFor(()=>expect(input.onApply).toHaveBeenCalledOnce());
    expect(input.onApply.mock.calls[0][1].ranges).toEqual([{start:100,end:400},{start:500,end:501}]);
    expect(input.onApply.mock.calls[0][1].mapping).toEqual([1,2]);
  });

  it('confirmed reset followed by Split makes exactly two nonempty halves of the preserved source',async()=>{
    const input=props(),original=Array.from(input.request.source.audioBuffer.getChannelData(0));render(<SliceAudioModal {...input}/>);await ready();await advanced();
    await userEvent.click(screen.getByRole('button',{name:'Split sound'}));
    await userEvent.click(screen.getByRole('button',{name:'Reset to full source'}));
    await userEvent.click(screen.getByRole('button',{name:'Replace edits'}));
    expect(screen.getByText('Sound 1 of 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button',{name:'Split sound'}));
    await userEvent.click(screen.getByRole('button',{name:'Auto-fill empty keys'}));
    await userEvent.click(screen.getByRole('button',{name:'Add sounds to kit'}));
    await waitFor(()=>expect(input.onApply).toHaveBeenCalledOnce());
    expect(input.onApply.mock.calls[0][1].ranges).toEqual([{start:0,end:500},{start:500,end:1000}]);
    expect(Array.from(input.request.source.audioBuffer.getChannelData(0))).toEqual(original);
  });

  it('keeps an existing source draft when its setup effect reruns and initializes fresh after explicit close',async()=>{
    const input=props(),view=render(<SliceAudioModal {...input}/>);await ready();await advanced();
    fireEvent.change(screen.getByLabelText('Sound 1 End'),{target:{value:'.04'}});fireEvent.blur(screen.getByLabelText('Sound 1 End'));
    await userEvent.click(screen.getByRole('button',{name:'Auto-fill empty keys'}));
    await userEvent.click(screen.getByRole('button',{name:'Reset to full source'}));
    view.rerender(<SliceAudioModal {...input} midiNoteMapping="C4"/>);
    expect(await screen.findByLabelText('Sound 1 End')).toHaveValue(.04);
    expect(screen.getByRole('button',{name:'Pad 2, KD2, Sound 1'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Keep edits'})).toBeInTheDocument();
    view.rerender(<SliceAudioModal {...input} isOpen={false}/>);
    view.rerender(<SliceAudioModal {...input}/>);await ready();
    expect(screen.getByLabelText('Sound 1 End')).toHaveValue(.05);
    expect(screen.getByRole('button',{name:'Pad 2, KD2, Empty'})).toBeInTheDocument();
  });
});


it('drags the selected sound beside its destinations without losing exact range identity',async()=>{
  const input=props();render(<SliceAudioModal {...input}/>);await ready();
  await userEvent.click(screen.getByRole('button',{name:'Next sound'}));
  const assign=screen.getByRole('region',{name:'Assign to keys'});
  const drag=screen.getByRole('button',{name:'Select sound 2'});
  const values=new Map<string,string>(),dataTransfer={types:[SLICE_DRAG_TYPE],effectAllowed:'none',setData:(type:string,value:string)=>values.set(type,value),getData:(type:string)=>values.get(type)??''};
  fireEvent.dragStart(drag,{dataTransfer});fireEvent.drop(within(assign).getByRole('button',{name:'Pad 9, CH, Empty'}),{dataTransfer});
  expect(screen.getByRole('button',{name:'Pad 9, CH, Sound 2'})).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox'));await userEvent.click(screen.getByRole('button',{name:'Add sounds to kit'}));
  await waitFor(()=>expect(input.onApply).toHaveBeenCalledOnce());
  expect(input.onApply.mock.calls[0][1].ranges).toEqual([{start:100,end:500},{start:500,end:501}]);
  expect(input.onApply.mock.calls[0][1].mapping).toEqual([null,8]);
});


it('ignores the M split shortcut while a reset decision is pending',async()=>{
  render(<SliceAudioModal {...props()}/>);await ready();
  fireEvent.change(screen.getByLabelText('Sound 1 End'),{target:{value:'.04'}});fireEvent.blur(screen.getByLabelText('Sound 1 End'));
  await userEvent.click(screen.getByRole('button',{name:'Play source'}));
  await userEvent.click(screen.getByRole('button',{name:'Reset to full source'}));audioClock=10.02;
  fireEvent.keyDown(document,{key:'m'});
  expect(screen.getByText('Sound 1 of 2')).toBeInTheDocument();
  expect(screen.getByLabelText('Sound 1 End')).toHaveValue(.04);
  await userEvent.click(screen.getByRole('button',{name:'Keep edits'}));
  screen.getByRole('main',{name:'Slicing controls'}).focus();
  fireEvent.keyDown(document,{key:'m'});
  expect(screen.getByText('Sound 2 of 3')).toBeInTheDocument();
});
