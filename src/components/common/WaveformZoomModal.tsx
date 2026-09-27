import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { audioContextManager } from '../../utils/audioContext';
import {
  crossfadeLoopChannels,
  framesToSeconds,
  normalizeSampleAndLoop,
  previewFrameAtTime,
  secondsToFrames,
  type FrameRange,
} from '../../utils/loopEditing';
import { shouldIgnoreKeyboardKeyDown } from '../../utils/keyboardOwnership';
import type { DrumSample, LoopCrossfadeProvenance, MultisampleFile } from '../../context/AppContext';
import { useStudioCanvasColors } from '../../hooks/useStudioCanvasTheme';
import { useOwnedDialog } from '../../hooks/useOwnedDialog';

type Marker = 'in' | 'out' | 'loopStart' | 'loopEnd';
interface DraftBounds { sample: FrameRange; loop: FrameRange }
interface PreviewClock {
  startedAt: number;
  startFrame: number;
  sample: FrameRange;
  loop: FrameRange;
  loopEnabled: boolean;
  loopOnRelease: boolean;
  sampleRate: number;
  playbackRate: number;
  reverse: boolean;
}

interface WaveformZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBuffer: AudioBuffer | null;
  initialInPoint: number;
  initialOutPoint: number;
  initialLoopStart?: number;
  initialLoopEnd?: number;
  initialCrossfade?: LoopCrossfadeProvenance;
  crossfadeNotice?: string;
  onSave: (inPoint: number, outPoint: number, loopStart?: number, loopEnd?: number, loopCrossfade?: LoopCrossfadeProvenance) => void;
  loopEnabled?: boolean;
  loopOnRelease?: boolean;
  playbackRate?: number;
  gain?: number;
  reverse?: boolean;
  ampEnvelope?: { attack: number; decay: number; sustain: number; release: number };
  onSaveForAll: (payload: Partial<DrumSample | MultisampleFile>) => void;
}

const c = {
  bg: 'var(--color-bg-primary)', bgAlt: 'var(--color-bg-secondary)',
  border: 'var(--color-border-light)', text: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)', action: 'var(--color-interactive-focus)',
};
const inputStyle = {
  width: '7.5rem', padding: '0.35rem 0.45rem', border: `1px solid ${c.border}`,
  borderRadius: '3px', background: c.bg, color: c.text,
} as const;

function makePreviewCopy(source: AudioBuffer, loop: FrameRange, fadeFrames: number): AudioBuffer {
  if (fadeFrames <= 0) return source;
  const channels = Array.from({ length: source.numberOfChannels }, (_, channel) => source.getChannelData(channel));
  const mixed = crossfadeLoopChannels(channels, loop, fadeFrames);
  let copy: AudioBuffer;
  try {
    copy = new AudioBuffer({ length: source.length, numberOfChannels: source.numberOfChannels, sampleRate: source.sampleRate });
    if (copy.length !== source.length || copy.numberOfChannels !== source.numberOfChannels) throw new Error('Unsupported AudioBuffer constructor');
  } catch {
    copy = new (AudioBuffer as unknown as new (channels: number, length: number, sampleRate: number) => AudioBuffer)(source.numberOfChannels, source.length, source.sampleRate);
  }
  mixed.forEach((data, channel) => {
    if (typeof copy.copyToChannel === 'function') copy.copyToChannel(data, channel);
    else copy.getChannelData(channel).set(data);
  });
  return copy;
}

export function WaveformZoomModal({
  isOpen, onClose, audioBuffer, initialInPoint, initialOutPoint, initialLoopStart, initialLoopEnd,
  initialCrossfade, crossfadeNotice, onSave, loopEnabled = false, loopOnRelease = false,
  playbackRate = 1, gain = 0, reverse = false, ampEnvelope, onSaveForAll,
}: WaveformZoomModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasColors=useStudioCanvasColors();
  const modalRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const initializedBufferRef = useRef<AudioBuffer | null>(null);
  const dragRef = useRef<{ marker: Marker; pointerId: number; baseline: DraftBounds } | null>(null);
  const draftRef = useRef<DraftBounds | null>(null);
  const currentNoteIdRef = useRef<string | null>(null);
  const previewHeldRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const playRequestRef = useRef(0);
  const playPendingRef = useRef(false);
  const previewClockRef = useRef<PreviewClock | null>(null);
  const playRef = useRef<() => Promise<void>>(async () => {});
  const stopRef = useRef<() => void>(() => {});

  const [draft, setDraftState] = useState<DraftBounds>({ sample: { start: 0, end: 1 }, loop: { start: 0, end: 1 } });
  const [selectedMarker, setSelectedMarker] = useState<Marker>('in');
  const [snapToZero, setSnapToZero] = useState(true);
  const [crossfade, setCrossfade] = useState<LoopCrossfadeProvenance>({ fraction: 0 });
  const [crossfadeEdited, setCrossfadeEdited] = useState(false);
  const [transport, setTransport] = useState<'stopped' | 'playing' | 'paused' | 'released'>('stopped');
  const [playheadFrame, setPlayheadFrame] = useState(0);
  const { playWithADSR, releaseNote } = useAudioPlayer();
  useOwnedDialog({active:isOpen,dialogRef:modalRef,onClose});

  const hasLoopPoints = initialLoopStart !== undefined && initialLoopEnd !== undefined;
  const frameCount = audioBuffer?.length ?? 1;
  const sampleRate = audioBuffer?.sampleRate ?? 1;
  const setDraft = useCallback((next: DraftBounds | ((current: DraftBounds) => DraftBounds)) => {
    setDraftState((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      draftRef.current = value;
      return value;
    });
  }, []);

  useEffect(() => {
    const opening = isOpen && !wasOpenRef.current;
    const changedBuffer = isOpen && audioBuffer !== initializedBufferRef.current;
    if ((opening || changedBuffer) && audioBuffer) {
      const normalized = normalizeSampleAndLoop(
        audioBuffer.length,
        { start: secondsToFrames(initialInPoint, audioBuffer.sampleRate, audioBuffer.length), end: secondsToFrames(initialOutPoint, audioBuffer.sampleRate, audioBuffer.length) },
        hasLoopPoints ? { start: secondsToFrames(initialLoopStart, audioBuffer.sampleRate, audioBuffer.length), end: secondsToFrames(initialLoopEnd, audioBuffer.sampleRate, audioBuffer.length) } : undefined,
      );
      draftRef.current = normalized;
      setDraftState(normalized);
      setPlayheadFrame(reverse ? normalized.sample.end : normalized.sample.start);
      setSelectedMarker('in');
      setCrossfade(initialCrossfade ? { ...initialCrossfade } : { fraction: 0 });
      setCrossfadeEdited(false);
      setTransport('stopped');
      initializedBufferRef.current = audioBuffer;
    }
    if (!isOpen) initializedBufferRef.current = null;
    wasOpenRef.current = isOpen;
  }, [audioBuffer, hasLoopPoints, initialCrossfade, initialInPoint, initialLoopEnd, initialLoopStart, initialOutPoint, isOpen, reverse]);

  const cancelAnimation = useCallback(() => {
    if (animationFrameRef.current !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);
  const stopCurrentNote = useCallback((force: boolean) => {
    playRequestRef.current += 1;
    playPendingRef.current = false;
    const noteId = currentNoteIdRef.current;
    currentNoteIdRef.current = null;
    if (noteId) releaseNote(noteId, force);
    cancelAnimation();
  }, [cancelAnimation, releaseNote]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const context = canvas.getContext('2d');
    if (!context || canvas.width <= 0 || canvas.height <= 0) return;
    const { width, height } = canvas;
    const samples = audioBuffer.getChannelData(0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = canvasColors.outside; context.fillRect(0, 0, width, height);
    context.fillStyle = canvasColors.inside; context.fillRect((draft.sample.start / frameCount) * width, 0, ((draft.sample.end - draft.sample.start) / frameCount) * width, height);
    context.fillStyle = canvasColors.waveform;
    const step = Math.max(1, Math.ceil(samples.length / width));
    for (let pixel = 0; pixel < width; pixel += 1) {
      let minimum = 1; let maximum = -1;
      for (let offset = 0; offset < step; offset += 1) {
        const value = samples[pixel * step + offset];
        if (value === undefined) break;
        minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
      }
      context.fillRect(pixel, (1 + minimum) * height / 2, 1, Math.max(1, (maximum - minimum) * height / 2));
    }
    const markers: Array<[Marker, number, string]> = [['in', draft.sample.start, canvasColors.waveform], ['out', draft.sample.end, canvasColors.waveform]];
    if (hasLoopPoints) markers.push(['loopStart', draft.loop.start, canvasColors.secondary], ['loopEnd', draft.loop.end, canvasColors.secondary]);
    markers.forEach(([marker, frame, color]) => {
      const x = (frame / frameCount) * width;
      context.strokeStyle = color; context.lineWidth = marker === selectedMarker ? 3 : 1;
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    });
    context.strokeStyle = canvasColors.accent; context.lineWidth = 2;
    const playheadX = (playheadFrame / frameCount) * width;
    context.beginPath(); context.moveTo(playheadX, 0); context.lineTo(playheadX, height); context.stroke();
  }, [audioBuffer, canvasColors, draft, frameCount, hasLoopPoints, playheadFrame, selectedMarker]);

  useEffect(() => {
    if (!isOpen || !audioBuffer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width || canvas.parentElement?.clientWidth || 640));
      canvas.height = Math.max(120, Math.round(rect.height || 200));
      draw();
    };
    resize(); window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [audioBuffer, draw, isOpen]);
  useEffect(draw, [draw]);

  const snapFrame = useCallback((frame: number): number => {
    if (!audioBuffer || !snapToZero) return frame;
    const samples = audioBuffer.getChannelData(0);
    const rounded = Math.round(frame);
    if (rounded <= 0) return 0;
    if (rounded >= samples.length) return samples.length;
    const origin = rounded;
    if (Math.abs(samples[origin]) < 0.01) return origin;
    let best = origin; let bestMagnitude = Math.abs(samples[origin]);
    for (let distance = 1; distance <= Math.min(500, samples.length - 1); distance += 1) {
      for (const candidate of [origin - distance, origin + distance]) {
        if (candidate < 0 || candidate >= samples.length) continue;
        const magnitude = Math.abs(samples[candidate]);
        if (magnitude < bestMagnitude) { best = candidate; bestMagnitude = magnitude; }
        if (magnitude < 0.01) return candidate;
      }
    }
    return best;
  }, [audioBuffer, snapToZero]);

  const updateMarker = useCallback((marker: Marker, requestedFrame: number) => {
    if (!audioBuffer) return;
    const frame = Math.max(0, Math.min(audioBuffer.length, Math.round(requestedFrame)));
    setDraft((current) => {
      if (marker === 'in') return normalizeSampleAndLoop(audioBuffer.length, { ...current.sample, start: Math.min(frame, current.sample.end - 1) }, current.loop);
      if (marker === 'out') return normalizeSampleAndLoop(audioBuffer.length, { ...current.sample, end: Math.max(frame, current.sample.start + 1) }, current.loop);
      if (marker === 'loopStart') return normalizeSampleAndLoop(audioBuffer.length, current.sample, { ...current.loop, start: Math.min(frame, current.loop.end - 1) });
      return normalizeSampleAndLoop(audioBuffer.length, current.sample, { ...current.loop, end: Math.max(frame, current.loop.start + 1) });
    });
  }, [audioBuffer, setDraft]);
  const frameFromPointer = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return 0;
    const rect = canvas.getBoundingClientRect();
    return snapFrame(((clientX - rect.left) / (rect.width || canvas.width || 1)) * audioBuffer.length);
  }, [audioBuffer, snapFrame]);
  const markerAtPointer = useCallback((clientX: number, clientY: number): Marker => {
    const canvas = canvasRef.current; const current = draftRef.current ?? draft;
    if (!canvas || !audioBuffer) return 'in';
    const rect = canvas.getBoundingClientRect(); const width = rect.width || canvas.width || 1; const height = rect.height || canvas.height || 1; const x = clientX - rect.left;
    const markers: Marker[] = hasLoopPoints ? (clientY - rect.top <= height * 0.3 ? ['loopStart', 'loopEnd'] : clientY - rect.top >= height * 0.7 ? ['in', 'out'] : ['in', 'loopStart', 'loopEnd', 'out']) : ['in', 'out'];
    const value = (marker: Marker) => marker === 'in' ? current.sample.start : marker === 'out' ? current.sample.end : marker === 'loopStart' ? current.loop.start : current.loop.end;
    return markers.reduce((nearest, marker) => Math.abs(x - (value(marker) / audioBuffer.length) * width) < Math.abs(x - (value(nearest) / audioBuffer.length) * width) ? marker : nearest, markers[0]);
  }, [audioBuffer, draft, hasLoopPoints]);
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!audioBuffer) return;
    const marker = markerAtPointer(event.clientX, event.clientY);
    setSelectedMarker(marker);
    dragRef.current = { marker, pointerId: event.pointerId, baseline: draftRef.current ?? draft };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateMarker(marker, frameFromPointer(event.clientX)); event.preventDefault();
  }, [audioBuffer, draft, frameFromPointer, markerAtPointer, updateMarker]);

  useEffect(() => {
    if (!isOpen) return;
    const move = (event: PointerEvent) => { const active = dragRef.current; if (!active || event.pointerId !== active.pointerId) return; updateMarker(active.marker, frameFromPointer(event.clientX)); event.preventDefault(); };
    const end = (event: PointerEvent) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; };
    const cancel = (event: PointerEvent) => { const active = dragRef.current; if (!active || event.pointerId !== active.pointerId) return; setDraft(active.baseline); dragRef.current = null; };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', cancel);
    return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', cancel); dragRef.current = null; };
  }, [frameFromPointer, isOpen, setDraft, updateMarker]);

  const tickPlayhead = useCallback(() => {
    if (!audioBuffer || (transport !== 'playing' && transport !== 'released')) return;
    const currentTime = audioContextManager.getCurrentTime();
    if (currentTime === null) return;
    const voiceClock = previewClockRef.current;
    if (!voiceClock) return;
    setPlayheadFrame(previewFrameAtTime(voiceClock, currentTime));
    animationFrameRef.current = requestAnimationFrame(tickPlayhead);
  }, [audioBuffer, transport]);
  const play = useCallback(async () => {
    if (!audioBuffer || currentNoteIdRef.current || playPendingRef.current) return;
    const request = ++playRequestRef.current;
    playPendingRef.current = true;
    const current = draftRef.current ?? draft;
    const pausedFrameIsValid = reverse
      ? playheadFrame > current.sample.start && playheadFrame <= current.sample.end
      : playheadFrame >= current.sample.start && playheadFrame < current.sample.end;
    const startFrame = transport === 'paused' && pausedFrameIsValid
      ? playheadFrame
      : reverse ? current.sample.end : current.sample.start;
    try {
      const requestedFrames = loopEnabled && hasLoopPoints ? Math.round(crossfade.fraction * audioBuffer.length) : 0;
      const previewBuffer = makePreviewCopy(audioBuffer, current.loop, requestedFrames);
      const requestedId = `waveform-preview-${Date.now()}`;
      let ownedNoteId = requestedId;
      const result = await playWithADSR(previewBuffer, requestedId, {
        inFrame: current.sample.start,
        outFrame: current.sample.end,
        startTime: (reverse ? current.sample.end - startFrame : startFrame - current.sample.start) / audioBuffer.sampleRate,
        loopEnabled, loopOnRelease, loopStart: framesToSeconds(current.loop.start, audioBuffer.sampleRate), loopEnd: framesToSeconds(current.loop.end, audioBuffer.sampleRate),
        playbackRate, gain, reverse, adsr: ampEnvelope ?? { attack: 100, decay: 1000, sustain: 30000, release: 2000 }, velocity: 127,
        onEnded: () => {
          if (request !== playRequestRef.current || currentNoteIdRef.current !== ownedNoteId) return;
          currentNoteIdRef.current = null;
          previewClockRef.current = null;
          cancelAnimation();
          setTransport('stopped');
          setPlayheadFrame(reverse ? current.sample.end : current.sample.start);
        },
      });
      const actualId = typeof result === 'string' ? result : requestedId;
      ownedNoteId = actualId;
      if (request !== playRequestRef.current) {
        releaseNote(actualId, true);
        return;
      }
      currentNoteIdRef.current = actualId;
      setPlayheadFrame(startFrame);
      previewClockRef.current = {
        startedAt: audioContextManager.getCurrentTime() ?? 0,
        startFrame,
        sample: { ...current.sample },
        loop: { ...current.loop },
        loopEnabled,
        loopOnRelease,
        sampleRate: audioBuffer.sampleRate,
        playbackRate,
        reverse,
      };
      setTransport('playing');
    } catch (error) {
      console.error('Error playing waveform preview:', error);
      if (request === playRequestRef.current) setTransport('stopped');
    } finally {
      if (request === playRequestRef.current) playPendingRef.current = false;
    }
  }, [ampEnvelope, audioBuffer, cancelAnimation, crossfade.fraction, draft, gain, hasLoopPoints, loopEnabled, loopOnRelease, playbackRate, playWithADSR, playheadFrame, releaseNote, reverse, transport]);
  useEffect(() => { if ((transport === 'playing' || transport === 'released') && typeof requestAnimationFrame === 'function') animationFrameRef.current = requestAnimationFrame(tickPlayhead); return cancelAnimation; }, [cancelAnimation, tickPlayhead, transport]);
  const pause = useCallback(() => { stopCurrentNote(true); setTransport('paused'); }, [stopCurrentNote]);
  const stop = useCallback(() => { stopCurrentNote(true); previewClockRef.current = null; const current = draftRef.current ?? draft; setPlayheadFrame(reverse ? current.sample.end : current.sample.start); setTransport('stopped'); }, [draft, reverse, stopCurrentNote]);
  const release = useCallback(() => {
    const noteId = currentNoteIdRef.current;
    if (!noteId) return;
    releaseNote(noteId, false);
    const voiceClock = previewClockRef.current;
    if (voiceClock) {
      previewClockRef.current = {
        ...voiceClock,
        startFrame: playheadFrame,
        startedAt: audioContextManager.getCurrentTime() ?? voiceClock.startedAt,
        loopEnabled: voiceClock.loopEnabled && voiceClock.loopOnRelease,
      };
    }
    setTransport('released');
  }, [playheadFrame, releaseNote]);

  useEffect(() => { playRef.current = play; }, [play]);
  useEffect(() => { stopRef.current = stop; }, [stop]);

  useEffect(() => {
    if (!isOpen) return;
    const keyDown = (event: KeyboardEvent) => { if ((event.key === 'p' || event.key === 'P') && !previewHeldRef.current && !shouldIgnoreKeyboardKeyDown(event, { modalOwner: modalRef.current })) { event.preventDefault(); previewHeldRef.current = true; void playRef.current(); } };
    const keyUp = (event: KeyboardEvent) => { if ((event.key === 'p' || event.key === 'P') && previewHeldRef.current) { event.preventDefault(); previewHeldRef.current = false; stopRef.current(); } };
    document.addEventListener('keydown', keyDown); document.addEventListener('keyup', keyUp);
    return () => { document.removeEventListener('keydown', keyDown); document.removeEventListener('keyup', keyUp); previewHeldRef.current = false; };
  }, [isOpen]);
  useEffect(() => () => stopCurrentNote(true), [stopCurrentNote]);
  useEffect(() => {
    if (!isOpen) {
      dragRef.current = null;
      stopCurrentNote(true);
    }
  }, [isOpen, stopCurrentNote]);

  const setFrameValue = (marker: Marker, value: string, unit: 'frames' | 'seconds') => { const numeric = Number(value); if (!Number.isFinite(numeric)) return; setSelectedMarker(marker); updateMarker(marker, unit === 'frames' ? numeric : secondsToFrames(numeric, sampleRate, frameCount)); };
  const adjustSelected = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    let next: number | null = null; const current = draftRef.current ?? draft;
    const present = selectedMarker === 'in' ? current.sample.start : selectedMarker === 'out' ? current.sample.end : selectedMarker === 'loopStart' ? current.loop.start : current.loop.end;
    if (event.key === 'ArrowLeft') next = present - (event.shiftKey ? 10 : 1); if (event.key === 'ArrowRight') next = present + (event.shiftKey ? 10 : 1); if (event.key === 'Home') next = 0; if (event.key === 'End') next = frameCount;
    if (next !== null) { event.preventDefault(); updateMarker(selectedMarker, next); }
  };
  const payload = (forAll = false): Partial<MultisampleFile> => ({ inPoint: framesToSeconds(draft.sample.start, sampleRate), outPoint: framesToSeconds(draft.sample.end, sampleRate), ...(hasLoopPoints ? { loopStart: framesToSeconds(draft.loop.start, sampleRate), loopEnd: framesToSeconds(draft.loop.end, sampleRate), loopCrossfade: forAll ? { fraction: Math.min(0.75, crossfade.fraction) } : { ...crossfade } } : {}) });
  const save = () => { const values = payload(); onSave(values.inPoint!, values.outPoint!, values.loopStart, values.loopEnd, values.loopCrossfade); onClose(); };
  const saveForAll = () => { onSaveForAll(payload(true)); onClose(); };
  const cancel = () => { stop(); onClose(); };
  if (!isOpen) return null;

  const fields: Array<{ marker: Marker; label: string; frame: number }> = [{ marker: 'in', label: 'Sample start', frame: draft.sample.start }, { marker: 'out', label: 'Sample end', frame: draft.sample.end }];
  if (hasLoopPoints) fields.push({ marker: 'loopStart', label: 'Loop start', frame: draft.loop.start }, { marker: 'loopEnd', label: 'Loop end', frame: draft.loop.end });
  const importedAbovePreviewLimit = !crossfadeEdited && crossfade.fraction > 0.75;

  return <div role="dialog" aria-modal="true" aria-labelledby="waveform-zoom-modal-title" ref={modalRef} tabIndex={-1}
    style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    onPointerDown={(event) => { if (event.target === event.currentTarget) cancel(); }}>
    <div style={{ width: 'min(900px, 100%)', maxHeight: '100%', overflow: 'auto', background: c.bg, color: c.text, borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
      <header style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${c.border}` }}><h3 id="waveform-zoom-modal-title" style={{ margin: 0, fontWeight: 400 }}>zoom and edit</h3></header>
      <main style={{ padding: '1rem 1.5rem' }}>
        <canvas ref={canvasRef} aria-label="waveform editor: drag markers to set sample and loop points" tabIndex={0} onPointerDown={onPointerDown} onKeyDown={adjustSelected}
          style={{ width: '100%', height: '200px', display: 'block', border: `1px solid ${c.border}`, touchAction: 'none', cursor: dragRef.current ? 'grabbing' : 'pointer' }} />
        <p aria-live="polite" style={{ margin: '.5rem 0' }}>Selected marker: {selectedMarker}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(285px, 1fr))', gap: '.75rem' }}>
          {fields.map(({ marker, label, frame }) => <fieldset key={marker} style={{ border: `1px solid ${c.border}`, borderRadius: '3px', padding: '.6rem' }}><legend>{label}</legend>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', marginBottom: '.4rem' }}>frames
              <input aria-label={`${label} frames`} type="number" step="1" min="0" max={frameCount} value={frame} onFocus={() => setSelectedMarker(marker)} onChange={(event) => setFrameValue(marker, event.target.value, 'frames')} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>seconds
              <input aria-label={`${label} seconds`} type="number" step={1 / sampleRate} min="0" max={frameCount / sampleRate} value={framesToSeconds(frame, sampleRate)} onFocus={() => setSelectedMarker(marker)} onChange={(event) => setFrameValue(marker, event.target.value, 'seconds')} style={inputStyle} />
            </label>
          </fieldset>)}
        </div>
        {hasLoopPoints && <section style={{ marginTop: '1rem', padding: '.75rem', background: c.bgAlt }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>Loop crossfade percent
            <input aria-label="Loop crossfade percent" type="number" min="0" max="75" step="0.1" value={Math.min(75, crossfade.fraction * 100)}
              onChange={(event) => { const percent = Math.max(0, Math.min(75, Number(event.target.value) || 0)); setCrossfade({ fraction: percent / 100 }); setCrossfadeEdited(true); }} style={inputStyle} />
          </label>
          <p style={{ margin: '.5rem 0 0' }}>Preview smoothing is an approximation applied to a copy. Exported audio stays unchanged; metadata uses the final frame count.</p>
          {importedAbovePreviewLimit && <p role="status" style={{ margin: '.5rem 0 0' }}>Imported crossfade is {Math.round(crossfade.fraction * 100)}%; the preview editor supports up to 75%. Saving without editing preserves the imported raw value.</p>}
          {crossfadeNotice && <p role="status" style={{ margin: '.5rem 0 0' }}>{crossfadeNotice}</p>}
        </section>}
        <section style={{ marginTop: '1rem', borderTop: `1px solid ${c.border}`, paddingTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button ref={firstButtonRef} data-initial-focus="true" type="button" aria-label="play" onClick={() => void play()} disabled={transport === 'playing'}>play</button>
            <button type="button" aria-label="pause" onClick={pause} disabled={transport !== 'playing'}>pause</button>
            <button type="button" aria-label="release" onClick={release} disabled={transport !== 'playing'}>release</button>
            <button type="button" aria-label="stop" onClick={stop}>stop</button>
            <span aria-live="polite">Playhead: {playheadFrame} frames</span>
            <label><input type="checkbox" checked={snapToZero} onChange={(event) => setSnapToZero(event.target.checked)} /> snap to zero crossings</label>
          </div>
          {hasLoopPoints && <p style={{ margin: '.6rem 0 0' }}>Loop until release stops looping when the note is released. Loop forever keeps the looped section running through the release.</p>}
          <p style={{ margin: '.6rem 0 0' }}>ADSR numbers remain the raw export values. Preview timing uses an approximate quadratic mapping up to 30 seconds; it is not calibrated hardware timing.</p>
        </section>
      </main>
      <footer style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '.75rem', background: c.bgAlt, borderTop: `1px solid ${c.border}` }}>
        <button type="button" onClick={saveForAll}>save for all</button><button type="button" onClick={cancel}>cancel</button><button type="button" onClick={save} style={{ background: c.action, color: 'var(--studio-accent-text)' }}>save markers</button>
      </footer>
    </div>
  </div>;
}
