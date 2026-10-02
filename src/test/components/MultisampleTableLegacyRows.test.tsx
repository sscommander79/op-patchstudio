import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MultisampleSampleTable} from '../../components/multisample/MultisampleSampleTable';
import {initialState,useAppContext,type MultisampleFile} from '../../context/AppContext';
vi.mock('../../context/AppContext',async()=>{const actual=await vi.importActual<typeof import('../../context/AppContext')>('../../context/AppContext');return{...actual,useAppContext:vi.fn()};});
vi.mock('../../hooks/useAudioPlayer',()=>({useAudioPlayer:()=>({playWithADSR:vi.fn(),releaseNote:vi.fn()})}));
vi.mock('../../components/common/WaveformZoomModal',()=>({WaveformZoomModal:()=>null}));
const missing:MultisampleFile={file:new File(['missing'],'missing.wav'),audioBuffer:null,name:'missing.wav',isLoaded:false,rootNote:60,note:'C3',inPoint:0,outPoint:0,loopStart:0,loopEnd:0,originalBitDepth:16,originalSampleRate:48000,originalChannels:1,fileSize:7,duration:0,isFloat:false};
beforeEach(()=>{vi.mocked(useAppContext).mockReturnValue({state:{...initialState,multisampleFiles:[missing]},dispatch:vi.fn()});});
afterEach(()=>{cleanup();vi.restoreAllMocks();window.innerWidth=1280;});
for(const width of [1440,390])it(`legacy unloaded multisample row ${width}px supports browsing and targeted recording`,()=>{
 window.innerWidth=width;const upload=vi.fn(),record=vi.fn();render(<MultisampleSampleTable onFileUpload={upload} onClearSample={vi.fn()} onRecordSample={record} onFilesSelected={vi.fn()}/>);
 const click=vi.spyOn(HTMLInputElement.prototype,'click').mockImplementation(()=>{});
 fireEvent.click(screen.getByTitle('browse'));expect(click).toHaveBeenCalledOnce();
 const file=new File(['audio'],'replacement.wav',{type:'audio/wav'});fireEvent.change(click.mock.instances[0] as HTMLInputElement,{target:{files:[file]}});expect(upload).toHaveBeenCalledWith(0,file);
 const empty=screen.getByRole('button',{name:width===390?'tap to browse for audio file':'drop sample here or click to browse'});fireEvent.click(empty);expect(click).toHaveBeenCalledTimes(2);
 fireEvent.click(screen.getByRole('button',{name:width===390?'record':'record sample for slot 1'}));expect(record).toHaveBeenCalledWith(0);
});
