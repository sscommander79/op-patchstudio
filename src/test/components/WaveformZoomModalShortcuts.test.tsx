import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WaveformZoomModal } from '../../components/common/WaveformZoomModal';

const audio = vi.hoisted(() => ({ playWithADSR:vi.fn().mockResolvedValue(undefined), releaseNote:vi.fn() }));
vi.mock('../../hooks/useAudioPlayer',()=>({useAudioPlayer:()=>audio}));
vi.mock('react-device-detect',()=>({isMobile:false,isTablet:false}));
vi.mock('../../App',()=>({triggerRotateOverlay:vi.fn()}));

describe('WaveformZoomModal preview shortcut ownership', () => {
  it('guards P key-down and releases only the preview captured by an accepted press', async () => {
    audio.playWithADSR.mockClear(); audio.releaseNote.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({
      beginPath:vi.fn(), clearRect:vi.fn(), closePath:vi.fn(), fill:vi.fn(), fillRect:vi.fn(),
      lineTo:vi.fn(), moveTo:vi.fn(), setLineDash:vi.fn(), stroke:vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const audioBuffer=new (AudioBuffer as unknown as new (...args:unknown[])=>AudioBuffer)(1,100,44100);
    render(<WaveformZoomModal isOpen onClose={()=>{}} audioBuffer={audioBuffer}
      initialInPoint={0} initialOutPoint={audioBuffer.duration} onSave={()=>{}} onSaveForAll={()=>{}} />);
    const input=document.createElement('input'); document.body.append(input); input.focus();
    fireEvent.keyDown(input,{key:'p'});
    input.blur();
    fireEvent.keyDown(document,{key:'p',ctrlKey:true});
    fireEvent.keyDown(document,{key:'p',isComposing:true});
    fireEvent.keyDown(document,{key:'p',repeat:true});
    expect(audio.playWithADSR).not.toHaveBeenCalled();

    fireEvent.keyDown(document,{key:'p'});
    fireEvent.keyDown(document,{key:'p',repeat:true});
    await waitFor(()=>expect(audio.playWithADSR).toHaveBeenCalledTimes(1));
    input.focus();
    fireEvent.keyUp(input,{key:'p'});
    expect(audio.releaseNote).toHaveBeenCalledTimes(1);
    expect(audio.releaseNote.mock.calls[0][1]).toBe(true);
    input.remove();
  });
});
