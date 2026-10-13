import {Blob as NodeBlob,File as NodeFile} from 'node:buffer';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
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
    const destination=await screen.findByRole('combobox',{name:'Destination for kick.wav'});await user.selectOptions(destination,'replace:0');await user.click(screen.getByRole('button',{name:'Change target'}));await user.click(screen.getByRole('button',{name:'Add selected sounds'}));
    expect(await screen.findByRole('alert')).toHaveTextContent(/changed while imports were preparing/i);
  });

  it('reserves explicit pad intent before filename suggestions',async()=>{
    mocked.prepare.mockImplementation(async(records:Array<{id:string;path:string;file:File}>)=>({instrument:'drum',expectedProjectGeneration:0,assets:records.map(record=>{const audioBuffer=buffer();return {...record,sourceIdentity:`source-${record.id}`,audioBuffer,metadata:metadata(audioBuffer)}}),rejected:[],excess:[]}));
    const user=userEvent.setup();setup();await user.click(screen.getByRole('button',{name:'Start explicit batch'}));
    expect(await screen.findByRole('combobox',{name:'Destination for texture.wav'})).toHaveValue('pad:0');
    expect(screen.getByRole('combobox',{name:'Destination for kick.wav'})).toHaveValue('pad:1');
    await user.click(screen.getByRole('button',{name:'Add selected sounds'}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Import audio'})).not.toBeInTheDocument());
  });

  it('commits a same-turn double Add only once and ignores Escape until its receipt arrives',async()=>{
    mocked.prepare.mockImplementation(async(records:Array<{id:string;path:string;file:File}>)=>({instrument:'drum',expectedProjectGeneration:0,assets:records.map(record=>{const audioBuffer=buffer();return {...record,sourceIdentity:`source-${record.id}`,audioBuffer,metadata:metadata(audioBuffer)}}),rejected:[],excess:[]}));
    const user=userEvent.setup();setup();await user.click(screen.getByRole('button',{name:'Start explicit batch'}));
    const add=await screen.findByRole('button',{name:'Add selected sounds'});
    act(()=>{fireEvent.click(add);fireEvent.click(add);fireEvent.keyDown(document,{key:'Escape'});});
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Import audio'})).not.toBeInTheDocument());
    expect(screen.getByLabelText('drum state')).toHaveTextContent('"loaded":["texture.wav","kick.wav"]');
    await user.click(screen.getByRole('button',{name:'Undo'}));
    expect(screen.getByLabelText('drum state')).toHaveTextContent('"loaded":[]');
    expect(screen.getByLabelText('drum state')).toHaveTextContent('"canUndo":false');
  });

  it('keeps an occupied explicit pad request unassigned through Apply and Undo',async()=>{
    mocked.prepare.mockImplementation(async(records:Array<{id:string;path:string;file:File}>)=>{const record=records[0],audioBuffer=buffer();return {instrument:'drum',expectedProjectGeneration:0,assets:[{...record,sourceIdentity:'source-new',audioBuffer,metadata:metadata(audioBuffer)}],rejected:[],excess:[]};});
    const user=userEvent.setup();setup(true);await user.click(screen.getByRole('button',{name:'Load occupied'}));await user.click(screen.getByRole('button',{name:'Start import'}));
    expect(await screen.findByRole('combobox',{name:'Destination for kick.wav'})).toHaveValue('unassigned');
    expect(screen.getByRole('dialog',{name:'Import audio'})).toHaveTextContent(/chosen drop pad is occupied or already reserved; kept unassigned/i);
    await user.click(screen.getByRole('button',{name:'Add selected sounds'}));
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
    await user.click(await screen.findByRole('button',{name:/Yes, assign/}));const assignment=await screen.findByRole('combobox',{name:'Assignment for a.wav'});expect(assignment).toHaveValue('unassigned');expect(assignment).toBeEnabled();expect(screen.getByRole('button',{name:'Add selected sounds'})).toBeDisabled();expect(screen.getByLabelText('multi count')).toHaveTextContent('1');
    await user.selectOptions(assignment,'replace');await user.click(screen.getByRole('button',{name:'Change multi target'}));await user.click(screen.getByRole('button',{name:'Add selected sounds'}));expect(await screen.findByRole('alert')).toHaveTextContent(/changed while imports were preparing/i);
  });

  it('tells a note taken by the project apart from a note taken by another file in the same import',async()=>{
    const assets=[['a',60],['b',64],['c',64]].map(([id,midiNote])=>{const audioBuffer=buffer(),file=new File([String(id)],`${id}.wav`);return {id:String(id),sourceIdentity:`source-${id}`,path:file.name,file,audioBuffer,metadata:{...metadata(audioBuffer),midiNote:Number(midiNote)}}});mocked.prepare.mockResolvedValue({instrument:'multisample',expectedProjectGeneration:0,assets,rejected:[],excess:[]});
    const user=userEvent.setup();setupMulti();await user.click(screen.getByRole('button',{name:'Load root 60'}));await user.click(screen.getByRole('button',{name:'Start multi import'}));await waitFor(()=>expect(screen.getAllByLabelText(/^Include /)).toHaveLength(3));
    const row=(name:string)=>screen.getByLabelText(`Include ${name}`).closest('li') as HTMLElement;
    for(const name of ['a.wav','b.wav','c.wav'])await user.click(await within(row(name)).findByRole('button',{name:/Yes, assign/}));
    // Replacement is offered only for an existing project sound.
    expect(row('a.wav')).toHaveTextContent(/already has a sound assigned.*replace it/i);expect(within(row('a.wav')).getByRole('option',{name:'Replace recording at this note'})).toBeInTheDocument();
    // b.wav took note 64 first; c.wav lost it to b.wav, so nothing exists to replace and the copy must not say so.
    expect(row('b.wav')).toHaveTextContent(/Assigned to/);expect(screen.getByLabelText('Include b.wav')).toBeChecked();
    expect(row('c.wav')).toHaveTextContent(/another file in this import is assigned to this key.*assign a different key/i);expect(row('c.wav')).not.toHaveTextContent(/already has a recording|replace/i);
    expect(within(row('c.wav')).queryByRole('option',{name:/replace/i})).not.toBeInTheDocument();expect(screen.getByLabelText('Include c.wav')).not.toBeChecked();
    // The stated recovery works: a different note makes the file addable, and both land.
    await user.click(within(row('c.wav')).getByRole('button',{name:'Change'}));await user.selectOptions(screen.getByRole('combobox',{name:'Assign key for c.wav'}),'65');expect(screen.getByLabelText('Include c.wav')).toBeChecked();
    await user.click(screen.getByRole('button',{name:'Add selected sounds'}));await waitFor(()=>expect(screen.getByLabelText('multi count')).toHaveTextContent('3'));
  });

  it('keeps capacity excess in review and consumes each partial apply receipt once',async()=>{
    const assets=['a','b'].map((id,index)=>{const audioBuffer=buffer(),file=new File([id],`${id}.wav`);return {id,sourceIdentity:`source-${id}`,path:file.name,file,audioBuffer,metadata:{...metadata(audioBuffer),midiNote:100+index}}});mocked.prepare.mockResolvedValue({instrument:'multisample',expectedProjectGeneration:0,assets,rejected:[],excess:[]});
    const user=userEvent.setup();setupMulti();await user.click(screen.getByRole('button',{name:'Load 23'}));await user.click(screen.getByRole('button',{name:'Start multi import'}));await waitFor(()=>expect(screen.getAllByLabelText(/^Include /)).toHaveLength(2));for(const button of await screen.findAllByRole('button',{name:/Yes, assign/}))await user.click(button);await user.click(screen.getByRole('button',{name:'Add selected sounds'}));
    await waitFor(()=>expect(screen.queryByLabelText('Include a.wav')).not.toBeInTheDocument());expect(screen.getByLabelText('Include b.wav')).toBeInTheDocument();expect(screen.getByLabelText('multi count')).toHaveTextContent('24');
    await user.click(screen.getByRole('button',{name:'Clear one'}));await user.click(screen.getByRole('button',{name:'Add selected sounds'}));await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Import audio'})).not.toBeInTheDocument());expect(screen.getByLabelText('multi count')).toHaveTextContent('24');
  });
});

it('suggests an unlabelled sample note without assigning it until confirmed',async()=>{
 const audioBuffer=new AudioContext().createBuffer(1,44100,44100);
 const data=audioBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=.3*Math.sin(2*Math.PI*440*i/44100);
 mocked.prepare.mockImplementation(async(records:Array<{id:string;path:string;file:File}>)=>({assets:[{...records[0],sourceIdentity:'tone',audioBuffer,metadata:metadata(audioBuffer)}],rejected:[],excess:[]}));
 const user=userEvent.setup();setupMulti();await user.click(screen.getByRole('button',{name:'Start multi import'}));
 const confirm=await screen.findByRole('button',{name:/Yes, assign to A/});
 expect(screen.getByRole('button',{name:'Add selected sounds'})).toBeDisabled();
 await user.click(confirm);
 expect(screen.getByText(/Assigned to A/)).toBeInTheDocument();expect(screen.queryByRole('combobox',{name:'Assign key for a.wav'})).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Add selected sounds'}));
 await waitFor(()=>expect(screen.getByLabelText('multi count')).toHaveTextContent('1'));
});

it('requires a fresh note confirmation after selecting part of an import',async()=>{
 const audioBuffer=buffer();mocked.prepare.mockImplementation(async(records:Array<{id:string;path:string;file:File}>)=>({instrument:'multisample',expectedProjectGeneration:0,assets:[{...records[0],sourceIdentity:'section',audioBuffer,metadata:{...metadata(audioBuffer),midiNote:60}}],rejected:[],excess:[]}));
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({beginPath:vi.fn(),clearRect:vi.fn(),closePath:vi.fn(),fill:vi.fn(),fillRect:vi.fn(),lineTo:vi.fn(),moveTo:vi.fn(),setLineDash:vi.fn(),stroke:vi.fn()} as unknown as CanvasRenderingContext2D);
 const user=userEvent.setup();setupMulti();await user.click(screen.getByRole('button',{name:'Start multi import'}));
 await user.click(await screen.findByRole('button',{name:'Choose a section of a.wav'}));
 fireEvent.change(screen.getByLabelText('Playback start seconds'),{target:{value:String(2/8000)}});
 fireEvent.change(screen.getByLabelText('Playback end seconds'),{target:{value:String(6/8000)}});
 await user.click(screen.getByRole('button',{name:'Use this section'}));
 expect(await screen.findByRole('combobox',{name:'Assign key for a.wav'})).toHaveValue('');
 expect(screen.getByRole('checkbox',{name:'Include a.wav'})).toBeDisabled();
 await user.selectOptions(screen.getByRole('combobox',{name:'Assign key for a.wav'}),'60');
 expect(screen.getByRole('checkbox',{name:'Include a.wav'})).toBeChecked();
});
