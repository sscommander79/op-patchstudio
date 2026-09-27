import {Blob as NodeBlob,File as NodeFile} from 'node:buffer';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AppContextProvider,useAppContext,useProjectHistory} from '../../context/AppContext';
import {useAudioImport} from '../../components/common/AudioImportContext';
import {AudioImportProvider} from '../../components/common/AudioImportProvider';

const mocked=vi.hoisted(()=>({prepare:vi.fn()}));
vi.mock('../../utils/audioImport',async importOriginal=>{
  const actual=await importOriginal<typeof import('../../utils/audioImport')>();
  return {...actual,prepareAudioImportFiles:mocked.prepare};
});

function buffer(value=.2){const result=new AudioContext().createBuffer(1,8,8_000);result.getChannelData(0).fill(value);return result;}
function metadata(audioBuffer:AudioBuffer){return {format:'wav' as const,sampleRate:8_000,sourceSampleRate:8_000,bitDepth:16,channels:1,sourceChannels:1,duration:audioBuffer.duration,audioBuffer,fileSize:1,midiNote:-1,loopStart:0,loopEnd:audioBuffer.duration,hasLoopData:false};}
function Harness({occupied=false}:{occupied?:boolean}){const intake=useAudioImport();const {state,dispatch}=useAppContext();const {canUndo}=useProjectHistory();
  return <><button onClick={()=>intake?.beginFiles([new File(['new'],'kick.wav')],{instrument:'drum',drumPads:[0]})}>Start import</button>
    <button onClick={()=>intake?.beginFiles([new File(['texture'],'texture.wav'),new File(['kick'],'kick.wav')],{instrument:'drum',drumPads:[0]})}>Start explicit batch</button>
    <button onClick={()=>intake?.beginFiles([new File(['texture'],'texture.wav'),new File([], 'empty.wav'),new File(['kick'],'kick.wav')],{instrument:'drum',drumPads:[0,1,2]})}>Start batch with rejection</button>
    <button onClick={()=>dispatch({type:'BUMP_PROJECT_GENERATION'})}>Replace project</button>
    {occupied&&<><button onClick={()=>{const audioBuffer=buffer(.7);dispatch({type:'LOAD_DRUM_SAMPLE',payload:{index:0,file:new File(['old'],'old.wav'),audioBuffer,metadata:metadata(audioBuffer)}})}}>Load occupied</button>
      <button onClick={()=>{const audioBuffer=buffer(.9);dispatch({type:'UPDATE_DRUM_SAMPLE',payload:{index:0,updates:{file:new File(['changed'],'changed.wav'),audioBuffer}}})}}>Change target</button></>}
    <button onClick={()=>dispatch({type:'UNDO'})}>Undo</button>
    <output aria-label="drum state">{JSON.stringify({pad0:state.drumSamples[0]?.file?.name,loaded:state.drumSamples.filter(sample=>sample?.isLoaded).map(sample=>sample.file?.name),canUndo})}</output>
  </>}
function MultiHarness(){const intake=useAudioImport();const {state,dispatch}=useAppContext();const load=(rootNote:number,name:string)=>{const audioBuffer=buffer(.4);return {type:'LOAD_MULTISAMPLE_FILE' as const,payload:{file:new File([name],name),audioBuffer,metadata:{...metadata(audioBuffer),midiNote:rootNote},rootNoteOverride:rootNote}}};
  return <><button onClick={()=>dispatch({type:'BATCH_EDIT',payload:Array.from({length:23},(_,note)=>load(note,`old-${note}.wav`))})}>Load 23</button>
    <button onClick={()=>dispatch(load(60,'old-60.wav'))}>Load root 60</button><button onClick={()=>intake?.beginFiles([new File(['a'],'a.wav'),new File(['b'],'b.wav')],{instrument:'multisample'})}>Start multi import</button>
    <button onClick={()=>dispatch({type:'CLEAR_MULTISAMPLE_FILE',payload:0})}>Clear one</button><button onClick={()=>{const audioBuffer=buffer(.9);dispatch({type:'UPDATE_MULTISAMPLE_FILE',payload:{index:0,updates:{file:new File(['changed'],'changed.wav'),audioBuffer}}})}}>Change multi target</button><span aria-label="multi count">{state.multisampleFiles.length}</span></>}
function setup(occupied=false){return render(<AppContextProvider><AudioImportProvider><Harness occupied={occupied}/></AudioImportProvider></AppContextProvider>)}
function setupMulti(){return render(<AppContextProvider><AudioImportProvider><MultiHarness/></AudioImportProvider></AppContextProvider>)}

const PositionalAudioBuffer=globalThis.AudioBuffer as unknown as new(channels:number,length:number,sampleRate:number)=>AudioBuffer;
beforeEach(()=>{mocked.prepare.mockReset();vi.stubGlobal('Blob',NodeBlob);vi.stubGlobal('File',NodeFile);vi.stubGlobal('AudioBuffer',class extends PositionalAudioBuffer {constructor(options:AudioBufferOptions){super(options.numberOfChannels??1,options.length,options.sampleRate)}})});
afterEach(()=>vi.unstubAllGlobals());

describe('AudioImportProvider',()=>{
  it('adds one file to its selected empty pad without opening destination review',async()=>{
    const audioBuffer=buffer();mocked.prepare.mockImplementation(async(records:Array<{id:string;path:string;file:File}>)=>({instrument:'drum',expectedProjectGeneration:0,assets:[{...records[0],sourceIdentity:'source-new',audioBuffer,metadata:metadata(audioBuffer)}],rejected:[],excess:[]}));
    const user=userEvent.setup();setup();await user.click(screen.getByRole('button',{name:'Start import'}));
    await waitFor(()=>expect(screen.getByLabelText('drum state')).toHaveTextContent('"pad0":"kick.wav"'));
    expect(screen.queryByRole('dialog',{name:'Import audio'})).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox',{name:'Destination for kick.wav'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Undo'}));
    await waitFor(()=>expect(screen.getByLabelText('drum state')).not.toHaveTextContent('"pad0":"kick.wav"'));
  });

  it('aborts and closes a pending preparation when the current project is replaced',async()=>{
    let signal:AbortSignal|undefined;mocked.prepare.mockImplementation((...args:unknown[])=>{signal=args[4] as AbortSignal;return new Promise(()=>{});});
    const user=userEvent.setup();setup();await user.click(screen.getByRole('button',{name:'Start import'}));
    await waitFor(()=>expect(mocked.prepare).toHaveBeenCalled());await user.click(screen.getByRole('button',{name:'Replace project'}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Import audio'})).not.toBeInTheDocument());expect(signal?.aborted).toBe(true);
  });

  it('releases a pending preparation on unmount',async()=>{
    let signal:AbortSignal|undefined;mocked.prepare.mockImplementation((...args:unknown[])=>{signal=args[4] as AbortSignal;return new Promise(()=>{});});const user=userEvent.setup();const view=setup();await user.click(screen.getByRole('button',{name:'Start import'}));await waitFor(()=>expect(mocked.prepare).toHaveBeenCalled());view.unmount();expect(signal?.aborted).toBe(true);
  });

  it('binds replace consent to the reviewed target identity',async()=>{
    const audioBuffer=buffer();const file=new File(['new'],'kick.wav');mocked.prepare.mockResolvedValue({instrument:'drum',expectedProjectGeneration:0,assets:[{id:'new',sourceIdentity:'source-new',path:file.name,file,audioBuffer,metadata:metadata(audioBuffer)}],rejected:[],excess:[]});
    const user=userEvent.setup();setup(true);await user.click(screen.getByRole('button',{name:'Load occupied'}));await user.click(screen.getByRole('button',{name:'Start import'}));
    const destination=await screen.findByRole('combobox',{name:'Destination for kick.wav'});await user.selectOptions(destination,'replace:0');await user.click(screen.getByRole('button',{name:'Change target'}));await user.click(screen.getByRole('button',{name:'Apply import'}));
    expect(await screen.findByRole('alert')).toHaveTextContent(/changed while imports were preparing/i);
  });

  it('reserves explicit pad intent before filename suggestions',async()=>{
    mocked.prepare.mockImplementation(async(records:Array<{id:string;path:string;file:File}>)=>({instrument:'drum',expectedProjectGeneration:0,assets:records.map(record=>{const audioBuffer=buffer();return {...record,sourceIdentity:`source-${record.id}`,audioBuffer,metadata:metadata(audioBuffer)}}),rejected:[],excess:[]}));
    const user=userEvent.setup();setup();await user.click(screen.getByRole('button',{name:'Start explicit batch'}));
    expect(await screen.findByRole('combobox',{name:'Destination for texture.wav'})).toHaveValue('pad:0');
    expect(screen.getByRole('combobox',{name:'Destination for kick.wav'})).toHaveValue('pad:1');
    await user.click(screen.getByRole('button',{name:'Apply import'}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Import audio'})).not.toBeInTheDocument());
  });

  it('keeps an occupied explicit pad request unassigned through Apply and Undo',async()=>{
    mocked.prepare.mockImplementation(async(records:Array<{id:string;path:string;file:File}>)=>{const record=records[0],audioBuffer=buffer();return {instrument:'drum',expectedProjectGeneration:0,assets:[{...record,sourceIdentity:'source-new',audioBuffer,metadata:metadata(audioBuffer)}],rejected:[],excess:[]};});
    const user=userEvent.setup();setup(true);await user.click(screen.getByRole('button',{name:'Load occupied'}));await user.click(screen.getByRole('button',{name:'Start import'}));
    expect(await screen.findByRole('combobox',{name:'Destination for kick.wav'})).toHaveValue('unassigned');
    expect(screen.getByRole('dialog',{name:'Import audio'})).toHaveTextContent(/chosen drop pad is occupied or already reserved; kept unassigned/i);
    await user.click(screen.getByRole('button',{name:'Apply import'}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Import audio'})).not.toBeInTheDocument());
    expect(screen.getByLabelText('drum state')).toHaveTextContent('"pad0":"old.wav"');
    expect(screen.getByLabelText('drum state')).toHaveTextContent('"loaded":["old.wav","kick.wav"]');
    await user.click(screen.getByRole('button',{name:'Undo'}));
    await waitFor(()=>expect(screen.getByLabelText('drum state')).toHaveTextContent('"loaded":["old.wav"]'));
    expect(screen.getByLabelText('drum state')).toHaveTextContent('"pad0":"old.wav"');
  });

  it('keeps explicit file-to-pad intent aligned across rejected batch entries',async()=>{
    mocked.prepare.mockImplementation(async(records:Array<{id:string;path:string;file:File}>)=>{
      const assets=records.map((record,index)=>{const audioBuffer=buffer();return {...record,sourceIdentity:`source-${index}`,audioBuffer,metadata:metadata(audioBuffer)}});
      return {instrument:'drum',expectedProjectGeneration:0,assets,rejected:[{path:'empty.wav',reason:'file is empty'}],excess:[]};
    });
    const user=userEvent.setup();setup();await user.click(screen.getByRole('button',{name:'Start batch with rejection'}));
    expect(await screen.findByRole('combobox',{name:'Destination for texture.wav'})).toHaveValue('pad:0');
    expect(screen.getByRole('combobox',{name:'Destination for kick.wav'})).toHaveValue('pad:2');
    expect(screen.getByRole('dialog',{name:'Import audio'})).toHaveTextContent(/empty\.wav: file is empty/i);
  });

  it('requires an explicit identity-bound multisample replacement decision',async()=>{
    const audioBuffer=buffer(),file=new File(['new'],'a.wav');mocked.prepare.mockResolvedValue({instrument:'multisample',expectedProjectGeneration:0,assets:[{id:'new',sourceIdentity:'source-new',path:file.name,file,audioBuffer,metadata:{...metadata(audioBuffer),midiNote:60}}],rejected:[],excess:[]});
    const user=userEvent.setup();setupMulti();await user.click(screen.getByRole('button',{name:'Load root 60'}));await user.click(screen.getByRole('button',{name:'Start multi import'}));
    const assignment=await screen.findByRole('combobox',{name:'Assignment for a.wav'});expect(assignment).toHaveValue('unassigned');await user.click(screen.getByRole('button',{name:'Apply import'}));expect(screen.getByRole('alert')).toHaveTextContent(/select at least one/i);
    await user.selectOptions(assignment,'replace');await user.click(screen.getByRole('button',{name:'Change multi target'}));await user.click(screen.getByRole('button',{name:'Apply import'}));expect(await screen.findByRole('alert')).toHaveTextContent(/changed while imports were preparing/i);
  });

  it('keeps capacity excess in review and consumes each partial apply receipt once',async()=>{
    const assets=['a','b'].map((id,index)=>{const audioBuffer=buffer(),file=new File([id],`${id}.wav`);return {id,sourceIdentity:`source-${id}`,path:file.name,file,audioBuffer,metadata:{...metadata(audioBuffer),midiNote:100+index}}});mocked.prepare.mockResolvedValue({instrument:'multisample',expectedProjectGeneration:0,assets,rejected:[],excess:[]});
    const user=userEvent.setup();setupMulti();await user.click(screen.getByRole('button',{name:'Load 23'}));await user.click(screen.getByRole('button',{name:'Start multi import'}));await waitFor(()=>expect(screen.getAllByLabelText(/^Include /)).toHaveLength(2));await user.click(screen.getByRole('button',{name:'Apply import'}));
    await waitFor(()=>expect(screen.queryByLabelText('Include a.wav')).not.toBeInTheDocument());expect(screen.getByLabelText('Include b.wav')).toBeInTheDocument();expect(screen.getByLabelText('multi count')).toHaveTextContent('24');
    await user.click(screen.getByRole('button',{name:'Clear one'}));await user.click(screen.getByRole('button',{name:'Apply import'}));await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Import audio'})).not.toBeInTheDocument());expect(screen.getByLabelText('multi count')).toHaveTextContent('24');
  });
});
