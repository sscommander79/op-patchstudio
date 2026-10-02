import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {DrumSampleSettingsModal} from '../../components/drum/DrumSampleSettingsModal';
import {initialState,useAppContext} from '../../context/AppContext';
vi.mock('../../context/AppContext',async()=>{const actual=await vi.importActual<typeof import('../../context/AppContext')>('../../context/AppContext');return {...actual,useAppContext:vi.fn()};});
vi.mock('../../hooks/useAudioPlayer',()=>({useAudioPlayer:()=>({play:vi.fn(),stopCurrentPlayback:vi.fn()})}));
vi.mock('../../components/common/EnhancedWaveformEditor',()=>({EnhancedWaveformEditor:({inPoint,outPoint}:{inPoint:number;outPoint:number})=><output data-testid="markers">{JSON.stringify([inPoint,outPoint])}</output>}));
vi.mock('../../components/common/WaveformZoomModal',()=>({WaveformZoomModal:()=>null}));
const dispatch=vi.fn();
beforeEach(()=>{dispatch.mockClear();const audioBuffer=new AudioBuffer({numberOfChannels:1,length:4800,sampleRate:48000});for(let i=0;i<4800;i++)audioBuffer.getChannelData(0)[i]=Math.sin(i/20);const sample={...initialState.drumSamples[0],file:new File(['audio'],'legacy.wav'),audioBuffer,name:'legacy.wav',isLoaded:true,inPoint:.002,outPoint:.09};vi.mocked(useAppContext).mockReturnValue({state:{...initialState,drumSettings:{...initialState.drumSettings,autoZeroCrossing:true},drumSamples:[sample,...initialState.drumSamples.slice(1)]},dispatch});});
afterEach(cleanup);
it('legacy zero-crossing action stays in the draft and Cancel discards it',()=>{
 const close=vi.fn();render(<DrumSampleSettingsModal isOpen onClose={close} sampleIndex={0}/>);const before=screen.getByTestId('markers').textContent;
 fireEvent.click(screen.getByRole('button',{name:'apply zero crossing'}));expect(screen.getByTestId('markers').textContent).not.toBe(before);expect(dispatch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'cancel'}));expect(close).toHaveBeenCalledOnce();expect(dispatch).not.toHaveBeenCalled();
});
it('Save commits snapped current bounds once and marks a marker-only edit',()=>{
 render(<DrumSampleSettingsModal isOpen onClose={vi.fn()} sampleIndex={0}/>);fireEvent.click(screen.getByRole('button',{name:'apply zero crossing'}));expect(dispatch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'save'}));expect(dispatch).toHaveBeenCalledOnce();const action=dispatch.mock.calls[0][0];expect(action).toMatchObject({type:'UPDATE_DRUM_SAMPLE',payload:{index:0,updates:{hasBeenEdited:true}}});expect(action.payload.updates.inPoint).toBeGreaterThanOrEqual(.002);expect(action.payload.updates.outPoint).toBeLessThanOrEqual(.09);expect(action.payload.updates.outPoint).toBeGreaterThan(action.payload.updates.inPoint);
});

it('opening a legacy sample without markers and cancelling does not mutate it',()=>{
 const context=useAppContext();context.state.drumSamples[0]={...context.state.drumSamples[0],inPoint:undefined,outPoint:undefined} as unknown as typeof context.state.drumSamples[number];render(<DrumSampleSettingsModal isOpen onClose={vi.fn()} sampleIndex={0}/>);expect(screen.getByTestId('markers')).toHaveTextContent('[0,4800]');expect(dispatch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'cancel'}));expect(dispatch).not.toHaveBeenCalled();
});
it('saving unchanged settings closes without an undo-producing dispatch',()=>{
 const close=vi.fn();render(<DrumSampleSettingsModal isOpen onClose={close} sampleIndex={0}/>);fireEvent.click(screen.getByRole('button',{name:'save'}));expect(close).toHaveBeenCalledOnce();expect(dispatch).not.toHaveBeenCalled();
});
