import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MultisampleFocusWorkspace } from '../../components/multisample/MultisampleFocusWorkspace';
import { initialState, useAppContext, type AppState, type MultisampleFile } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';

vi.mock('../../context/AppContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../context/AppContext')>();
  return {...actual, useAppContext: vi.fn()};
});
vi.mock('../../hooks/useAudioPlayer');
vi.mock('../../components/common/SmallWaveform', () => ({SmallWaveform: () => <div>waveform</div>}));
vi.mock('../../components/common/WaveformZoomModal', () => ({WaveformZoomModal: () => null}));

const dispatch=vi.fn(),playWithADSR=vi.fn().mockResolvedValue(undefined),releaseNote=vi.fn();
function makeSample(name='zone.wav',frames=8):MultisampleFile {
  const audioBuffer=new AudioContext().createBuffer(1,frames,8_000);
  return {file:new File([name],name),audioBuffer,name,isLoaded:true,rootNote:60,note:'C3',inPoint:0,outPoint:frames/8_000,
    loopStart:Math.min(2,frames-1)/8_000,loopEnd:Math.min(6,frames)/8_000,originalBitDepth:16,originalSampleRate:8_000,originalChannels:1,fileSize:4,duration:frames/8_000,isFloat:false};
}
function renderFocus(files=[makeSample()],selectedIndex=0) {
  const state={...initialState,multisampleFiles:files,multisampleSettings:{...initialState.multisampleSettings,loopEnabled:true,loopOnRelease:true,gain:3,
    playmode:'mono' as const,ampEnvelope:{attack:100,decay:200,sustain:20_000,release:400}}} as AppState;
  vi.mocked(useAppContext).mockReturnValue({state,dispatch} as ReturnType<typeof useAppContext>);
  return render(<MultisampleFocusWorkspace selectedIndex={selectedIndex} onSelect={vi.fn()} onBrowse={vi.fn()} onReplace={vi.fn()} onClear={vi.fn()} onRecord={vi.fn()}/>);
}

describe('MultisampleFocusWorkspace',()=>{
  beforeEach(()=>{dispatch.mockClear();playWithADSR.mockClear();releaseNote.mockClear();vi.mocked(useAudioPlayer).mockReturnValue({playWithADSR,releaseNote} as unknown as ReturnType<typeof useAudioPlayer>);});

  it('restores invalid root and marker values without creating history',()=>{
    renderFocus();
    const root=screen.getByRole('spinbutton',{name:'Root note'});
    fireEvent.change(root,{target:{value:'128'}});fireEvent.blur(root);
    expect(root).toHaveValue(60);
    expect(screen.getByRole('alert')).toHaveTextContent(/whole MIDI value from 0 to 127/i);
    expect(dispatch).not.toHaveBeenCalled();

    const loopEnd=screen.getByRole('spinbutton',{name:/Loop End \(seconds\)/i});
    fireEvent.change(loopEnd,{target:{value:'-1'}});fireEvent.blur(loopEnd);
    expect(loopEnd).toHaveValue(6/8_000);
    expect(screen.getByRole('alert')).toHaveTextContent(/within the selected audio/i);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('normalizes one-frame marker edits before one atomic update',()=>{
    renderFocus([makeSample('one.wav',1)]);
    const loopStart=screen.getByRole('spinbutton',{name:/Loop Start \(seconds\)/i});
    fireEvent.change(loopStart,{target:{value:'0'}});fireEvent.blur(loopStart);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({type:'UPDATE_MULTISAMPLE_FILE',payload:{index:0,updates:{inPoint:0,outPoint:1/8_000,loopStart:0,loopEnd:1/8_000}}});
  });

  it('auditions the selected zone with ADSR and loop settings, then stops explicitly',async()=>{
    const view=renderFocus();
    fireEvent.click(screen.getByRole('button',{name:'Play selected'}));
    await waitFor(()=>expect(playWithADSR).toHaveBeenCalledWith(expect.anything(),expect.stringMatching(/^multisample-focus-/),expect.objectContaining({
      gain:3,pan:0,playMode:'mono',adsr:{attack:100,decay:200,sustain:20_000,release:400},loopEnabled:true,loopOnRelease:true,
      loopStart:2/8_000,loopEnd:6/8_000,inFrame:0,outFrame:8,
    })));
    fireEvent.click(screen.getByRole('button',{name:'Stop preview'}));
    expect(releaseNote).toHaveBeenCalledWith(expect.stringMatching(/^multisample-focus-/),true);
    releaseNote.mockClear();fireEvent.click(screen.getByRole('button',{name:'Play selected'}));
    await waitFor(()=>expect(playWithADSR).toHaveBeenCalledTimes(2));view.unmount();
    expect(releaseNote).toHaveBeenCalledWith(expect.stringMatching(/^multisample-focus-/),true);
  });

  it('keeps trim and loop suggestions private and applies trim without replacing the crafted loop',async()=>{
    const sample=makeSample('sustain.wav',8000),audio=sample.audioBuffer!;
    sample.loopStart=2000/8000;sample.loopEnd=5000/8000;
    const channel=audio.getChannelData(0);
    for(let frame=1000;frame<7000;frame++)channel[frame]=Math.sin(2*Math.PI*frame/40)*.5;
    renderFocus([sample]);
    fireEvent.click(screen.getByRole('button',{name:'Analyze sound'}));
    expect(screen.getByRole('status')).toHaveTextContent(/trim:/i);
    expect(screen.getByRole('status')).toHaveTextContent(/loop:/i);
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Preview trim'}));
    await waitFor(()=>expect(playWithADSR).toHaveBeenCalledWith(audio,expect.any(String),expect.objectContaining({loopEnabled:true,inFrame:expect.any(Number),outFrame:expect.any(Number)})));
    fireEvent.click(screen.getByRole('button',{name:'Apply trim'}));
    expect(releaseNote).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({type:'UPDATE_MULTISAMPLE_FILE',payload:{index:0,updates:{inPoint:expect.any(Number),outPoint:expect.any(Number),loopStart:sample.loopStart,loopEnd:sample.loopEnd}}});
    expect(screen.queryByRole('button',{name:'Apply trim'})).not.toBeInTheDocument();
  });

  it('previews and applies a loop only when explicitly selected',async()=>{
    const sample=makeSample('sustain.wav',8000),audio=sample.audioBuffer!;
    const channel=audio.getChannelData(0);
    for(let frame=1000;frame<7000;frame++)channel[frame]=Math.sin(2*Math.PI*frame/40)*.5;
    renderFocus([sample]);fireEvent.click(screen.getByRole('button',{name:'Analyze sound'}));
    expect(screen.getByRole('button',{name:'Apply loop'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'Preview loop'}));
    await waitFor(()=>expect(playWithADSR).toHaveBeenCalledWith(audio,expect.any(String),expect.objectContaining({loopEnabled:true})));
    fireEvent.click(screen.getByRole('button',{name:'Apply loop'}));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({type:'UPDATE_MULTISAMPLE_FILE',payload:{index:0,updates:{loopStart:expect.any(Number),loopEnd:expect.any(Number)}}});
    expect(dispatch.mock.calls[0][0].payload.updates).not.toHaveProperty('inPoint');
  });
});
