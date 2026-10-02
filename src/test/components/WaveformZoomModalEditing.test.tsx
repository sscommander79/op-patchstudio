import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WaveformZoomModal } from '../../components/common/WaveformZoomModal';

const audio = vi.hoisted(() => ({
  playWithADSR: vi.fn().mockResolvedValue('preview-note'),
  releaseNote: vi.fn(),
}));
const clock = vi.hoisted(() => ({ now: 0 }));

vi.mock('../../hooks/useAudioPlayer', () => ({ useAudioPlayer: () => audio }));
vi.mock('../../utils/audioContext', () => ({
  audioContextManager: { getCurrentTime: () => clock.now },
}));
vi.mock('react-device-detect', () => ({ isMobile: false, isTablet: false }));
vi.mock('../../App', () => ({ triggerRotateOverlay: vi.fn() }));

const makeBuffer = () => new (AudioBuffer as unknown as new (...args: unknown[]) => AudioBuffer)(1, 100, 100);

describe('WaveformZoomModal frame editor', () => {
  const dispatchPointer = (target: Document | Element, type: string, pointerId: number, clientX: number, clientY: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      pointerId: { value: pointerId }, clientX: { value: clientX }, clientY: { value: clientY },
    });
    fireEvent(target, event);
  };

  beforeEach(() => {
    audio.playWithADSR.mockClear().mockResolvedValue('preview-note');
    audio.releaseNote.mockClear();
    clock.now = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      beginPath: vi.fn(), clearRect: vi.fn(), closePath: vi.fn(), fill: vi.fn(), fillRect: vi.fn(),
      lineTo: vi.fn(), moveTo: vi.fn(), setLineDash: vi.fn(), stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 200, width: 100, height: 200,
      toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('edits half-open frame and second values, retaining exact zero and final-frame boundaries', () => {
    const onSave = vi.fn();
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0} initialOutPoint={1} initialLoopStart={0} initialLoopEnd={1}
      initialCrossfade={{ fraction: 0 }} onSave={onSave} onSaveForAll={() => {}} />);

    expect(screen.getByLabelText('Sample start frames')).toHaveValue(0);
    expect(screen.getByLabelText('Sample end frames')).toHaveValue(100);
    fireEvent.change(screen.getByLabelText('Loop start seconds'), { target: { value: '0.2' } });
    fireEvent.change(screen.getByLabelText('Loop end frames'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Loop crossfade percent'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'save markers' }));

    expect(onSave).toHaveBeenCalledWith(0, 1, 0.2, 1, { fraction: 0.25 });
  });

  it('does not reset a local draft when its parent rerenders, and cancel dispatches no save', () => {
    const onSave = vi.fn();
    const onSaveForAll = vi.fn();
    const buffer = makeBuffer();
    const { rerender } = render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={buffer}
      initialInPoint={0} initialOutPoint={1} onSave={onSave} onSaveForAll={onSaveForAll} />);
    fireEvent.change(screen.getByLabelText('Sample start frames'), { target: { value: '12' } });
    rerender(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={buffer}
      initialInPoint={0} initialOutPoint={1} onSave={() => onSave()} onSaveForAll={() => onSaveForAll()} />);
    expect(screen.getByLabelText('Sample start frames')).toHaveValue(12);
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onSaveForAll).not.toHaveBeenCalled();
  });

  it('captures pointer movement outside the canvas and reverts a cancelled gesture', () => {
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0.2} initialOutPoint={0.8} onSave={() => {}} onSaveForAll={() => {}} />);
    const canvas = screen.getByLabelText(/waveform editor/i);
    Object.defineProperty(canvas, 'width', { configurable: true, value: 100, writable: true });
    Object.defineProperty(canvas, 'height', { configurable: true, value: 200, writable: true });

    dispatchPointer(canvas, 'pointerdown', 7, 20, 190);
    dispatchPointer(document, 'pointermove', 7, -50, 190);
    expect(screen.getByLabelText('Sample start frames')).toHaveValue(0);
    dispatchPointer(document, 'pointerup', 7, -50, 190);

    dispatchPointer(canvas, 'pointerdown', 8, 0, 190);
    dispatchPointer(document, 'pointermove', 8, 40, 190);
    expect(screen.getByLabelText('Sample start frames')).toHaveValue(40);
    dispatchPointer(document, 'pointercancel', 8, 40, 190);
    expect(screen.getByLabelText('Sample start frames')).toHaveValue(0);
  });

  it('uses the audio clock for playhead, pause/resume, speed, reverse, and force stop', async () => {
    let animationFrame: FrameRequestCallback | undefined;
    const completions: Array<() => void> = [];
    audio.playWithADSR.mockImplementation((_buffer, _noteId, options) => {
      completions.push(options.onEnded);
      return Promise.resolve('preview-note');
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      animationFrame = callback;
      return 1;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0} initialOutPoint={1} onSave={() => {}} onSaveForAll={() => {}}
      playbackRate={2} reverse />);

    fireEvent.click(screen.getByRole('button', { name: 'play' }));
    await waitFor(() => expect(audio.playWithADSR).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'pause' })).toBeEnabled());
    clock.now = 0.25;
    act(() => animationFrame?.(250));
    expect(screen.getByText('Playhead: 50 frames')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pause' }));
    expect(audio.releaseNote).toHaveBeenCalledWith('preview-note', true);
    act(() => completions[0]());
    expect(screen.getByText('Playhead: 50 frames')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'play' }));
    await waitFor(() => expect(audio.playWithADSR).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'pause' })).toBeEnabled());
    act(() => completions[0]());
    expect(screen.getByRole('button', { name: 'pause' })).toBeEnabled();
    expect(audio.playWithADSR.mock.calls[1][2]).toMatchObject({ inFrame: 0, outFrame: 100, startTime: 0.5, reverse: true, playbackRate: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'stop' }));
    expect(screen.getByText('Playhead: 100 frames')).toBeInTheDocument();
  });

  it('preserves imported raw crossfade provenance until the value is edited', () => {
    const onSave = vi.fn();
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0} initialOutPoint={1} initialLoopStart={0} initialLoopEnd={1}
      initialCrossfade={{ fraction: 0.9, importedRaw: 90, importedFramecount: 100, sourceIdentity: 'sample.wav' }}
      onSave={onSave} onSaveForAll={() => {}} />);
    expect(screen.getByText(/90%.*preview editor supports up to 75%/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'save markers' }));
    expect(onSave.mock.calls[0][4]).toEqual({
      fraction: 0.9, importedRaw: 90, importedFramecount: 100, sourceIdentity: 'sample.wav',
    });
  });

  it('removes source-specific provenance when applying a crossfade to all samples', () => {
    const onSaveForAll = vi.fn();
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0} initialOutPoint={1} initialLoopStart={0} initialLoopEnd={1}
      initialCrossfade={{ fraction: 0.9, importedRaw: 90, importedFramecount: 100, sourceIdentity: 'sample.wav' }}
      onSave={() => {}} onSaveForAll={onSaveForAll} />);
    fireEvent.click(screen.getByRole('button', { name: 'save for all' }));
    expect(onSaveForAll.mock.calls[0][0].loopCrossfade).toEqual({ fraction: 0.75 });
  });

  it.each([
    { loopOnRelease: false, expected: 50 },
    { loopOnRelease: true, expected: 30 },
  ])('keeps the clock live after release with continuation=$loopOnRelease', async ({ loopOnRelease, expected }) => {
    let animationFrame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { animationFrame = callback; return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0} initialOutPoint={1} initialLoopStart={0.2} initialLoopEnd={0.4}
      loopEnabled loopOnRelease={loopOnRelease} onSave={() => {}} onSaveForAll={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'play' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'release' })).toBeEnabled());
    await waitFor(() => expect(animationFrame).toBeTypeOf('function'));
    clock.now = 0.3;
    act(() => animationFrame?.(300));
    expect(screen.getByText('Playhead: 30 frames')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'release' }));
    expect(audio.releaseNote).toHaveBeenLastCalledWith('preview-note', false);
    clock.now = 0.5;
    act(() => animationFrame?.(500));
    expect(screen.getByText(`Playhead: ${expected} frames`)).toBeInTheDocument();
  });

  it('ends an active preview and abandons an active pointer when unmounted', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const onSave = vi.fn();
    const { unmount } = render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0} initialOutPoint={1} onSave={onSave} onSaveForAll={() => {}} />);
    const canvas = screen.getByLabelText(/waveform editor/i);
    dispatchPointer(canvas, 'pointerdown', 9, 0, 190);
    fireEvent.click(screen.getByRole('button', { name: 'play' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'pause' })).toBeEnabled());
    unmount();
    expect(audio.releaseNote).toHaveBeenLastCalledWith('preview-note', true);
    dispatchPointer(document, 'pointermove', 9, 50, 190);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('force-stops a preview that finishes starting after Stop was pressed', async () => {
    let finishStart: ((noteId: string) => void) | undefined;
    audio.playWithADSR.mockImplementationOnce(() => new Promise<string>((resolve) => { finishStart = resolve; }));
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0} initialOutPoint={1} onSave={() => {}} onSaveForAll={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'play' }));
    await waitFor(() => expect(audio.playWithADSR).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'stop' }));
    await act(async () => finishStart?.('late-note'));
    expect(audio.releaseNote).toHaveBeenLastCalledWith('late-note', true);
    expect(screen.getByRole('button', { name: 'pause' })).toBeDisabled();
  });

  it('keeps P-key ownership across the playback rerender until keyup', async () => {
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0} initialOutPoint={1} initialLoopStart={0.2} initialLoopEnd={0.4}
      loopEnabled onSave={() => {}} onSaveForAll={() => {}} />);
    fireEvent.keyDown(document, { key: 'p' });
    await waitFor(() => expect(audio.playWithADSR).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'pause' })).toBeEnabled());
    fireEvent.keyUp(document, { key: 'p' });
    expect(audio.releaseNote).toHaveBeenLastCalledWith('preview-note', true);
  });

  it('keeps the modal open when an outside pointerup generates a backdrop click', () => {
    const onClose = vi.fn();
    render(<WaveformZoomModal isOpen onClose={onClose} audioBuffer={makeBuffer()}
      initialInPoint={0.2} initialOutPoint={0.8} onSave={() => {}} onSaveForAll={() => {}} />);
    const canvas = screen.getByLabelText(/waveform editor/i);
    dispatchPointer(canvas, 'pointerdown', 17, 20, 190);
    dispatchPointer(document, 'pointermove', 17, -100, 190);
    dispatchPointer(document, 'pointerup', 17, -100, 190);
    fireEvent.click(screen.getByRole('dialog', { name: 'zoom and edit' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'zoom and edit' })).toBeVisible();
  });

  it('uses an immutable voice clock when markers change during playback', async () => {
    let animationFrame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { animationFrame = callback; return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0} initialOutPoint={1} initialLoopStart={0.2} initialLoopEnd={0.4}
      loopEnabled onSave={() => {}} onSaveForAll={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'play' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'pause' })).toBeEnabled());
    expect(audio.playWithADSR.mock.calls[0][2]).toMatchObject({ loopStart: 0.2, loopEnd: 0.4 });
    fireEvent.change(screen.getByLabelText('Loop end frames'), { target: { value: '80' } });
    clock.now = 0.5;
    act(() => animationFrame?.(500));
    expect(screen.getByText('Playhead: 30 frames')).toBeInTheDocument();
  });

  it('does not crossfade the playback copy while looping is disabled', async () => {
    const buffer = makeBuffer();
    const source = buffer.getChannelData(0);
    source.set([-0.8, 0.6, -0.2, 0.9, -0.4, 0.2, 0.7, 1]);
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={buffer}
      initialInPoint={0} initialOutPoint={1} initialLoopStart={0} initialLoopEnd={0.08}
      initialCrossfade={{ fraction: 0.04 }} loopEnabled={false}
      onSave={() => {}} onSaveForAll={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'play' }));
    await waitFor(() => expect(audio.playWithADSR).toHaveBeenCalledTimes(1));
    expect(Array.from(audio.playWithADSR.mock.calls[0][0].getChannelData(0))).toEqual(Array.from(source));
  });

  it.each([
    { reverse: false, marker: 'Sample start frames', value: '80', expectedStart: 80, nextFrame: 90 },
    { reverse: false, marker: 'Sample end frames', value: '40', expectedStart: 0, nextFrame: 10 },
    { reverse: true, marker: 'Sample end frames', value: '40', expectedStart: 40, nextFrame: 30 },
  ])('restarts a paused voice and clock at a valid boundary after editing $marker with reverse=$reverse', async ({ reverse, marker, value, expectedStart, nextFrame }) => {
    let frameId=0;const frames=new Map<number,FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame',vi.fn((callback:FrameRequestCallback)=>{const id=++frameId;frames.set(id,callback);return id;}));
    vi.stubGlobal('cancelAnimationFrame',vi.fn((id:number)=>frames.delete(id)));
    const tick=(time:number)=>{const pending=[...frames.values()];frames.clear();act(()=>pending.forEach(callback=>callback(time)));};
    render(<WaveformZoomModal isOpen onClose={() => {}} audioBuffer={makeBuffer()}
      initialInPoint={0} initialOutPoint={1} reverse={reverse}
      onSave={() => {}} onSaveForAll={() => {}} />);
    await act(async()=>{fireEvent.click(screen.getByRole('button', { name: 'play' }));});
    await waitFor(() => expect(screen.getByRole('button', { name: 'pause' })).toBeEnabled());
    clock.now = 0.5;
    tick(500);
    expect(screen.getByText('Playhead: 50 frames')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pause' }));
    fireEvent.change(screen.getByLabelText(marker), { target: { value } });
    await act(async()=>{fireEvent.click(screen.getByRole('button', { name: 'play' }));});
    await waitFor(() => expect(audio.playWithADSR).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'pause' })).toBeEnabled());
    const options = audio.playWithADSR.mock.calls[1][2];
    expect(options).toMatchObject({ inFrame: reverse ? 0 : Number(value === '80' ? 80 : 0), outFrame: reverse ? 40 : Number(value === '40' ? 40 : 100), startTime: 0 });
    expect(screen.getByText(`Playhead: ${expectedStart} frames`)).toBeInTheDocument();
    clock.now = 0.6;
    tick(600);
    expect(screen.getByText(`Playhead: ${nextFrame} frames`)).toBeInTheDocument();
  });
});
