import {useCallback, useEffect, useRef, useState} from 'react';
import JSZip from 'jszip';
import captureWorkletUrl from '../../audio/recording/captureProcessor.ts?worker&url';
import {CaptureSession} from '../../audio/recording/captureSession';
import {
  STEM_LIMITS,
  StemCaptureEngine,
  estimatedStemBytes,
  stemDuration,
  validateStemSettings,
  type StemCapture,
  type StemResult,
  type StemSettings,
} from '../../audio/recording/stemCapture';
import {
  listStemAudioInputs,
  requestStemMidiAccess,
  stemBrowserSupport,
  type StemMidiAccess,
  type StemMidiOutput,
} from '../../audio/recording/stemBrowser';
import {audioBufferToWav} from '../../utils/wavExport';
import {useOwnedDialog} from '../../hooks/useOwnedDialog';
import {midiRoutes, type RouteLease} from '../../midi/routeLease';

export interface ReviewedStem extends StemResult {name: string}
interface Props {isOpen: boolean; onClose: () => void; onSlice: (file: File) => void}

const button: React.CSSProperties = {
  minHeight: 44,
  padding: '.55rem .8rem',
  border: '1px solid var(--color-border-medium, #888)',
  borderRadius: 4,
  background: 'var(--color-bg-primary, #fff)',
  color: 'inherit',
};
const box: React.CSSProperties = {
  border: '1px solid var(--color-border-medium, #888)',
  borderRadius: 6,
  padding: '1rem',
};
const DEFAULT_INPUT = '__default-audio-input__';

interface CleanupBarrier {track: <T>(operation: Promise<T>) => Promise<T>; wait: () => Promise<void>}
function createCleanupBarrier(): CleanupBarrier {
  const pending = new Set<Promise<unknown>>();
  return {
    track: <T,>(operation: Promise<T>) => {
      const tracked = operation.finally(() => pending.delete(tracked));
      pending.add(tracked);
      return tracked;
    },
    wait: async () => { while (pending.size) await Promise.allSettled([...pending]); },
  };
}
function joinStemCaptureCleanup(capture: StemCapture, barrier: CleanupBarrier): StemCapture {
  let stopping: Promise<void> | undefined;
  let disposing: Promise<void> | undefined;
  return {
    enableInput: deviceId => capture.enableInput(deviceId),
    start: () => capture.start(),
    stop: () => stopping ??= barrier.track(capture.stop()),
    dispose: () => disposing ??= barrier.track(capture.dispose()),
    clockSnapshot: () => capture.clockSnapshot(),
  };
}

const safeName = (value: string, fallback: string) => {
  const clean = value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return clean || fallback;
};

export function StemRecordingModal({isOpen, onClose, onSlice}: Props) {
  const support = stemBrowserSupport();
  const dialogRef = useRef<HTMLElement>(null);
  const engineRef = useRef<StemCaptureEngine | undefined>(undefined);
  const runLockRef = useRef(false);
  const stopOperationRef = useRef<Promise<void> | undefined>(undefined);
  const cleanupBarrierRef = useRef<CleanupBarrier | undefined>(undefined);
  const runTokenRef = useRef(0);
  const lifecycleRef = useRef(0);
  const midiRequestRef = useRef(0);
  const midiSubscriptionRef = useRef<{access: StemMidiAccess; listener: (event: Event) => void} | undefined>(undefined);
  const outputRef = useRef<StemMidiOutput | undefined>(undefined);
  const previewRef = useRef<{context: AudioContext; source: AudioBufferSourceNode; token: number} | undefined>(undefined);
  const previewTokenRef = useRef(0);
  const busyRef = useRef(false);
  const audioPendingRef = useRef(false);
  const midiPendingRef = useRef(false);
  const operationTokenRef = useRef(0);
  const takesRef = useRef<ReviewedStem[]>([]);

  const [inputs, setInputs] = useState<Array<{deviceId: string; label: string}>>([]);
  const [inputId, setInputId] = useState('');
  const [outputs, setOutputs] = useState<StemMidiOutput[]>([]);
  const [outputId, setOutputId] = useState('');
  const [tracks, setTracks] = useState([1]);
  const [names, setNames] = useState<Record<number, string>>(() =>
    Object.fromEntries(Array.from({length: 8}, (_, index) => [index + 1, `Track ${index + 1}`])),
  );
  const [bpm, setBpm] = useState(120);
  const [bars, setBars] = useState(4);
  const [tail, setTail] = useState(1);
  const [settle, setSettle] = useState(250);
  const [latency, setLatency] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [takes, setTakesState] = useState<ReviewedStem[]>([]);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [audioPending, setAudioPending] = useState(false);
  const [midiPending, setMidiPending] = useState(false);
  const [status, setStatus] = useState('Connect audio and MIDI to begin.');
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const setTakes = useCallback((update: (current: ReviewedStem[]) => ReviewedStem[]) => {
    const next = update(takesRef.current);
    takesRef.current = next;
    setTakesState(next);
  }, []);

  const settings: StemSettings = {tracks, bpm, bars, tailSeconds: tail, settleMs: settle, latencyMs: latency};
  let validation = '';
  try {
    validateStemSettings(settings);
  } catch (reason) {
    validation = reason instanceof Error ? reason.message : String(reason);
  }

  const detachMidi = useCallback(() => {
    const subscription = midiSubscriptionRef.current;
    midiSubscriptionRef.current = undefined;
    subscription?.access.removeEventListener('statechange', subscription.listener);
  }, []);

  const stopPreview = useCallback(async () => {
    previewTokenRef.current += 1;
    const owned = previewRef.current;
    previewRef.current = undefined;
    setPreviewing(false);
    if (!owned) return;
    owned.source.onended = null;
    try { owned.source.stop(); } catch { /* already ended */ }
    owned.source.disconnect();
    await owned.context.close().catch(() => undefined);
  }, []);

  const stop = useCallback(async () => {
    if (stopOperationRef.current) return stopOperationRef.current;
    const token = ++runTokenRef.current;
    const engine = engineRef.current;
    if (!engine) {
      runLockRef.current = false;
      setRunning(false);
      return;
    }
    const barrier = cleanupBarrierRef.current;
    const operation = (async () => {
      setStatus('Stopping recording and resetting owned MIDI state...');
      await engine.cancel();
      await barrier?.wait();
      if (engineRef.current === engine) engineRef.current = undefined;
      outputRef.current = undefined;
      if (token === runTokenRef.current) {
        runLockRef.current = false;
        setRunning(false);
        setStatus('Stopped. Reviewed recordings were kept.');
      }
    })();
    stopOperationRef.current = operation;
    try { await operation; }
    finally { if (stopOperationRef.current === operation) stopOperationRef.current = undefined; }
  }, []);

  const close = useCallback(() => {
    lifecycleRef.current += 1;
    midiRequestRef.current += 1;
    operationTokenRef.current += 1;
    previewTokenRef.current += 1;
    setConfirmDiscard(false);
    detachMidi();
    outputRef.current = undefined;
    setOutputs([]);
    setAudioPending(false);
    setMidiPending(false);
    audioPendingRef.current = false;
    midiPendingRef.current = false;
    busyRef.current = false;
    setBusy(false);
    setTakes(() => []);
    void stop();
    void stopPreview();
    onClose();
  }, [detachMidi, onClose, setTakes, stop, stopPreview]);

  const requestClose = useCallback(() => {
    if (running || runLockRef.current) {
      void stop();
      return;
    }
    if (takesRef.current.length) {
      setConfirmDiscard(true);
      return;
    }
    close();
  }, [close, running, stop]);

  useOwnedDialog({active: isOpen && !confirmDiscard, dialogRef, onClose: requestClose});

  const refreshAudio = useCallback(async () => {
    const lifecycle = lifecycleRef.current;
    try {
      const found = await listStemAudioInputs();
      if (lifecycle === lifecycleRef.current) setInputs(found);
    } catch {
      if (lifecycle === lifecycleRef.current) {
        setError('Audio inputs could not be listed. Check browser permission and reconnect the device.');
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    lifecycleRef.current += 1;
    setError('');
    setStatus('Connect audio and MIDI to begin.');
    void refreshAudio();
    const changed = () => { void refreshAudio(); };
    navigator.mediaDevices?.addEventListener?.('devicechange', changed);
    return () => {
      lifecycleRef.current += 1;
      midiRequestRef.current += 1;
      operationTokenRef.current += 1;
      navigator.mediaDevices?.removeEventListener?.('devicechange', changed);
      detachMidi();
      outputRef.current = undefined;
      busyRef.current = false;
      audioPendingRef.current = false;
      midiPendingRef.current = false;
      void stop();
      void stopPreview();
    };
  }, [detachMidi, isOpen, refreshAudio, stop, stopPreview]);

  useEffect(() => {
    if (!isOpen) return;
    const visibility = () => {
      if (!document.hidden || !runLockRef.current) return;
      void stop();
      setError('Track recording stopped because the page was hidden. Reviewed recordings were kept.');
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [isOpen, stop]);

  if (!isOpen) return null;

  const enableAudio = async () => {
    if (audioPendingRef.current || running) return;
    if (!support.secure || !support.audio || !support.worklet) {
      setError('Track recording needs Chrome or Edge on HTTPS with Web Audio and AudioWorklet support. You can import existing WAV files instead.');
      return;
    }
    const lifecycle = lifecycleRef.current;
    audioPendingRef.current = true;
    setAudioPending(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      stream.getTracks().forEach(track => track.stop());
      if (lifecycle !== lifecycleRef.current) return;
      await refreshAudio();
      if (lifecycle === lifecycleRef.current) setStatus('Audio permission enabled. Choose the OP-XY audio input.');
    } catch {
      if (lifecycle === lifecycleRef.current) {
        setError('Audio permission was refused or no input is available. Allow microphone access, then retry.');
      }
    } finally {
      if (lifecycle === lifecycleRef.current) {
        audioPendingRef.current = false;
        setAudioPending(false);
      }
    }
  };

  const enableMidi = async () => {
    if (midiPendingRef.current || running) return;
    const lifecycle = lifecycleRef.current;
    const request = ++midiRequestRef.current;
    midiPendingRef.current = true;
    setMidiPending(true);
    setError('');
    try {
      const access = await requestStemMidiAccess();
      if (lifecycle !== lifecycleRef.current || request !== midiRequestRef.current) return;
      const changed = () => {
        if (lifecycle !== lifecycleRef.current || midiSubscriptionRef.current?.access !== access) return;
        const found = [...access.outputs.values()].filter(item => item.state === 'connected');
        setOutputs(found);
        if (outputRef.current && !found.some(item => item.id === outputRef.current?.id)) {
          setError('MIDI output disconnected. On the OP-XY, stop transport and unmute tracks 1–8 manually if needed.');
          engineRef.current?.outputDisconnected();
        }
      };
      detachMidi();
      midiSubscriptionRef.current = {access, listener: changed};
      access.addEventListener('statechange', changed);
      changed();
      setStatus('MIDI enabled. Choose the output connected to the OP-XY.');
    } catch {
      if (lifecycle === lifecycleRef.current && request === midiRequestRef.current) {
        setError('MIDI permission was refused or Web MIDI is unavailable. Use Chrome or Edge on HTTPS, allow MIDI, then retry.');
      }
    } finally {
      if (lifecycle === lifecycleRef.current && request === midiRequestRef.current) {
        midiPendingRef.current = false;
        setMidiPending(false);
      }
    }
  };

  const run = async (onlyTrack?: number) => {
    if (runLockRef.current || busyRef.current) return;
    runLockRef.current = true;
    const token = ++runTokenRef.current;
    setRunning(true);
    let failed = false;
    let lease: RouteLease | undefined;
    let barrier: CleanupBarrier | undefined;

    try {
      const output = outputs.find(item => item.id === outputId);
      if (!acknowledged) throw new Error('Acknowledge the transport and mute recovery notice before recording.');
      if (!inputId) throw new Error('Choose the exact audio input connected to the OP-XY.');
      if (!output) throw new Error('Choose a connected MIDI output.');
      const runTracks = onlyTrack === undefined ? tracks : [onlyTrack];
      const runSettings = {...settings, tracks: runTracks};
      validateStemSettings(runSettings);

      await stopPreview();
      if (token !== runTokenRef.current) return;
      if (output.state !== 'connected') throw new Error('Choose a connected MIDI output.');
      lease = midiRoutes.acquire(output.id, 'stem-capture');
      if (!lease) throw new Error('This MIDI output is busy with Devices or automatic sampling.');
      barrier = createCleanupBarrier();
      cleanupBarrierRef.current = barrier;
      setError('');
      outputRef.current = output;
      const engine = new StemCaptureEngine({
        midi: {
          isConnected: () => output.state === 'connected',
          send: (bytes, time) => output.send(bytes, time),
          clear: () => output.clear(),
        },
        retainedUsage: () => ({
          count: takesRef.current.length,
          tracks: takesRef.current.map(take => take.track),
          bytes: takesRef.current.reduce((sum, take) => sum + take.take.frames * take.take.channels * 4, 0),
        }),
        createCapture: callbacks => joinStemCaptureCleanup(new CaptureSession({
          mediaDevices: navigator.mediaDevices,
          workletUrl: captureWorkletUrl,
          createContext: rate => new AudioContext(rate ? {sampleRate: rate} : undefined),
          createWorkletNode: (context, options) => new AudioWorkletNode(context, 'op-patchstudio-capture', options),
          capture: {mode: 'manual', preRollSeconds: 0, maxSeconds: 20},
          getRetainedUsage: () => ({
            count: takesRef.current.length,
            bytes: takesRef.current.reduce((sum, take) => sum + take.take.frames * take.take.channels * 8 + 24, 0),
          }),
          ...callbacks,
        }), barrier!),
        onResult: result => {
          if (token !== runTokenRef.current) return;
          setTakes(current => {
            const reviewed = {...result, name: names[result.track] || `Track ${result.track}`};
            const index = current.findIndex(item => item.track === result.track);
            if (index < 0) return [...current, reviewed].sort((a, b) => a.track - b.track);
            const next = [...current];
            next[index] = reviewed;
            return next;
          });
        },
        onProgress: (done, total, track, seconds) => {
          if (token === runTokenRef.current) {
            setStatus(`Recorded track ${track}. ${done} of ${total} complete, ${seconds.toFixed(1)} seconds each.`);
          }
        },
        onError: message => {
          failed = true;
          if (token === runTokenRef.current) setError(message);
        },
      });
      engineRef.current = engine;
      setStatus(`Recording ${runTracks.length} track${runTracks.length === 1 ? '' : 's'} separately in real time...`);
      await engine.run(runSettings, inputId === DEFAULT_INPUT ? '' : inputId, onlyTrack);
    } catch (reason) {
      failed = true;
      if (token === runTokenRef.current) {
        setError(reason instanceof Error ? reason.message : 'Recording could not start.');
      }
    } finally {
      await barrier?.wait();
      lease?.release();
      if (cleanupBarrierRef.current === barrier) cleanupBarrierRef.current = undefined;
      const engine = engineRef.current;
      if (token === runTokenRef.current) {
        if (engine) engineRef.current = undefined;
        outputRef.current = undefined;
        runLockRef.current = false;
        setRunning(false);
        if (!failed) setStatus('Recording complete. Listen for bleed, level, and timing before download.');
      }
    }
  };

  const play = async (take: ReviewedStem) => {
    await stopPreview();
    const ownedToken = ++previewTokenRef.current;
    const context = new AudioContext({sampleRate: take.take.sampleRate});
    try {
      await context.resume();
      if (ownedToken !== previewTokenRef.current || !isOpen) {
        await context.close();
        return;
      }
      const source = context.createBufferSource();
      source.buffer = take.take.audioBuffer;
      source.connect(context.destination);
      const owned = {context, source, token: ownedToken};
      previewRef.current = owned;
      setPreviewing(true);
      source.onended = () => {
        if (previewRef.current !== owned) return;
        previewRef.current = undefined;
        source.disconnect();
        setPreviewing(false);
        void context.close();
      };
      source.start();
    } catch (reason) {
      await context.close().catch(() => undefined);
      if (ownedToken === previewTokenRef.current) {
        setError(reason instanceof Error ? reason.message : 'Playback could not start.');
      }
    }
  };

  const wav = async (take: ReviewedStem) => audioBufferToWav(take.take.audioBuffer, 24);
  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const withBusy = async (operation: (token: number) => Promise<void>) => {
    if (busyRef.current || runLockRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const token = ++operationTokenRef.current;
    try {
      await operation(token);
    } catch (reason) {
      if (token === operationTokenRef.current) {
        setError(reason instanceof Error ? reason.message : 'The requested file operation failed. Reviewed recordings were kept.');
      }
    } finally {
      if (token === operationTokenRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const download = (take: ReviewedStem) => withBusy(async token => {
    const blob = await wav(take);
    if (token !== operationTokenRef.current) return;
    downloadBlob(blob, `${safeName(take.name, `track-${take.track}`)}.wav`);
  });

  const slice = (take: ReviewedStem) => withBusy(async token => {
    const file = new File([await wav(take)], `${safeName(take.name, `track-${take.track}`)}.wav`, {type: 'audio/wav'});
    if (token === operationTokenRef.current) onSlice(file);
  });

  const downloadAll = () => withBusy(async token => {
    const zip = new JSZip();
    const used = new Set<string>();
    const manifest = {
      format: 'OP-PatchStudio sequential OP-XY track recordings',
      timing: 'unverified; verify timing and isolation on physical hardware',
      midiState: 'Original OP-XY mute state was not read or restored; cleanup requests all tracks 1–8 unmuted.',
      tracks: [] as Array<{
        track: number;
        name: string;
        file: string;
        sampleRate: number;
        channels: number;
        frames: number;
        settings: StemSettings;
        warnings: string[];
      }>,
    };
    for (const take of takesRef.current) {
      const base = safeName(take.name, `track-${take.track}`);
      let name = `${base}.wav`;
      let suffix = 2;
      while (used.has(name.toLowerCase())) name = `${base}-${suffix++}.wav`;
      used.add(name.toLowerCase());
      zip.file(name, await wav(take));
      manifest.tracks.push({
        track: take.track,
        name: take.name,
        file: name,
        sampleRate: take.take.sampleRate,
        channels: take.take.channels,
        frames: take.take.frames,
        settings: take.settings,
        warnings: take.warnings,
      });
    }
    const archiveName = 'op-xy-track-recordings.zip';
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    const archive = await zip.generateAsync({type: 'blob', compression: 'STORE'});
    if (archive.size > STEM_LIMITS.pcmBytes + 1024 * 1024) throw new Error('ZIP exceeds the recording export limit.');
    if (token === operationTokenRef.current) downloadBlob(archive, archiveName);
  });

  return <div style={{position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 12}}>
    <DiscardConfirmation active={confirmDiscard} onKeep={() => setConfirmDiscard(false)} onDiscard={close}/>
    <section ref={dialogRef} data-recording-modal="true" role="dialog" aria-modal="true" aria-hidden={confirmDiscard || undefined} aria-labelledby="stem-title" tabIndex={-1} style={{width: 'min(900px,100%)', maxHeight: '94vh', overflow: 'auto', background: 'var(--color-bg-primary, #fff)', color: 'var(--color-text-primary, #222)', borderRadius: 8}}>
      <header style={{position: 'sticky', top: 0, zIndex: 1, display: 'flex', justifyContent: 'space-between', gap: 12, padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border-medium, #888)', background: 'inherit'}}>
        <div><p className="studio-eyebrow">Local-only recording</p><h2 id="stem-title" style={{margin: 0}}>Record OP-XY tracks</h2></div>
        <button type="button" data-initial-focus="true" onClick={requestClose} style={button}>{running ? 'Stop' : 'Close'}</button>
      </header>
      <main style={{padding: '1rem 1.25rem', display: 'grid', gap: 16}}>
        {(!support.secure || !support.audio || !support.worklet || !support.midi) && <p role="alert">This feature needs Chrome or Edge on HTTPS with Web MIDI, audio input, and AudioWorklet. Existing WAV files can still be imported elsewhere in the studio.</p>}
        <section style={box}>
          <h3>1. Connect</h3>
          <ol><li>Connect the OP-XY stereo output to your computer audio input.</li><li>On OP-XY, use COM settings to enable incoming MIDI clock/transport and the control messages required for CC9. Confirm the current options in the official guides below.</li><li>Connect browser MIDI output to the OP-XY, then use Record test and listen for bleed, level, and timing.</li></ol>
          <p><a href="https://teenage.engineering/guides/op-xy/com" target="_blank" rel="noreferrer">Official OP-XY COM guide</a>{' · '}<a href="https://teenage.engineering/guides/op-xy/midi-references" target="_blank" rel="noreferrer">Official OP-XY MIDI reference</a></p>
          <p>Mutes affect notes, not audio. Tails, live input, and effects can bleed into another track. This tool records existing tracks sequentially; it does not separate sources or promise perfect alignment.</p>
          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end'}}>
            <button type="button" onClick={() => void enableAudio()} disabled={running || audioPending || !support.audio} style={button}>{audioPending ? 'Enabling audio...' : 'Enable audio'}</button>
            <button type="button" onClick={() => void refreshAudio()} disabled={running || audioPending} style={button}>Refresh inputs</button>
            <label>Audio input <select aria-label="Audio input" value={inputId} disabled={running} onChange={event => setInputId(event.target.value)} style={button}><option value="">Choose input</option>{inputs.map(input => <option key={input.deviceId || DEFAULT_INPUT} value={input.deviceId || DEFAULT_INPUT}>{input.label}</option>)}</select></label>
            <button type="button" onClick={() => void enableMidi()} disabled={running || midiPending || !support.midi} style={button}>{midiPending ? 'Enabling MIDI...' : 'Enable MIDI'}</button>
            <label>MIDI output <select aria-label="MIDI output" value={outputId} disabled={running} onChange={event => setOutputId(event.target.value)} style={button}><option value="">Choose output</option>{outputs.map(output => <option key={output.id} value={output.id}>{output.name || output.id}</option>)}</select></label>
          </div>
          <label style={{display: 'flex', gap: 8, marginTop: 12}}><input type="checkbox" checked={acknowledged} disabled={running} onChange={event => setAcknowledged(event.target.checked)}/>I understand recording will stop transport, control track mutes, and finish by requesting tracks 1–8 unmuted. The app cannot read or restore the original hardware mute state.</label>
        </section>
        <section style={box}>
          <h3>2. Choose tracks</h3>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8}}>{Array.from({length: 8}, (_, index) => index + 1).map(track => <div key={track}><label><input type="checkbox" checked={tracks.includes(track)} disabled={running} onChange={event => setTracks(current => event.target.checked ? [...current, track].sort((a, b) => a - b) : current.filter(value => value !== track))}/> Track {track}</label><input aria-label={`Track ${track} name`} value={names[track]} disabled={running} maxLength={80} onChange={event => setNames(current => ({...current, [track]: event.target.value}))} style={{...button, width: '100%', boxSizing: 'border-box'}}/></div>)}</div>
          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12}}><NumberField label="BPM" value={bpm} min={40} max={240} set={setBpm} disabled={running}/><NumberField label="Bars (4/4)" value={bars} min={1} max={16} set={setBars} disabled={running}/><NumberField label="Tail seconds" value={tail} min={0} max={4} step={.1} set={setTail} disabled={running}/></div>
          <p>The file contains the short pattern music plus its tail; the default is four bars. Each output is {(Number.isFinite(stemDuration(settings)) ? stemDuration(settings) : 0).toFixed(1)} seconds. Music plus tail is limited to 16 seconds. The fixed 48 kHz stereo estimate is {(estimatedStemBytes(settings) / 1024 / 1024).toFixed(1)} MiB per track; actual-format limits are enforced before recording.</p>
          <details><summary style={{minHeight: 44, display: 'flex', alignItems: 'center'}}>Advanced timing</summary><div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}><NumberField label="Mute settling ms" value={settle} min={250} max={2000} set={setSettle} disabled={running}/><NumberField label="Input latency adjustment ms" value={latency} min={0} max={250} set={setLatency} disabled={running}/></div><p>Timing remains unverified until you check a physical recording. A positive latency adjustment shifts the crop later, never earlier, without changing its length.</p></details>
        </section>
        <section style={box}>
          <h3>3. Record</h3><p role="status" aria-live="polite">{status}</p>{error && <p role="alert">{error}</p>}{validation && !error && <p role="alert">{validation}</p>}
          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}><button type="button" onClick={() => void run(tracks[0])} disabled={running || busy || !tracks.length || !!validation} style={button}>Record test</button><button type="button" onClick={() => void run()} disabled={running || busy || !tracks.length || !!validation} style={button}>Record selected</button><button type="button" onClick={() => void stop()} disabled={!running} style={button}>Stop recording</button></div>
          <p>Only Record test, Record selected, and Retry send MIDI. Enabling permissions, selecting devices, opening, and closing an untouched modal send nothing.</p>
        </section>
        <section style={box}>
          <h3>4. Review</h3>
          {!takes.length ? <p>No reviewed recordings yet.</p> : takes.map(take => <div key={take.track} role="group" aria-label={`Reviewed track ${take.track}`} style={{borderTop: '1px solid var(--color-border-medium, #888)', padding: '.75rem 0'}}><strong>Track {take.track}</strong> · {(take.take.frames / take.take.sampleRate).toFixed(2)} s · {take.take.sampleRate} Hz · {take.take.channels === 1 ? 'mono' : 'stereo'} · timing and isolation unverified<label style={{display: 'block'}}>Name <input value={take.name} disabled={running || busy} onChange={event => setTakes(current => current.map(item => item.track === take.track ? {...item, name: event.target.value} : item))} style={button}/></label>{take.warnings.map(warning => <p key={warning} role="alert">{warning}</p>)}<div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}><button type="button" onClick={() => void play(take)} disabled={running || busy} style={button}>Play {take.name}</button><button type="button" onClick={() => void stopPreview()} disabled={!previewing} style={button}>Stop playback</button><button type="button" onClick={() => void run(take.track)} disabled={running || busy} style={button}>Retry track {take.track}</button><button type="button" onClick={() => void download(take)} disabled={running || busy} style={button}>Download WAV</button><button type="button" onClick={() => void slice(take)} disabled={running || busy} style={button}>Slice this recording</button></div></div>)}
          {takes.length > 0 && <button type="button" onClick={() => void downloadAll()} disabled={running || busy} style={button}>Download all ZIP</button>}
        </section>
      </main>
      <footer style={{position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border-medium, #888)', background: 'var(--color-bg-secondary, #eee)'}}><button type="button" onClick={requestClose} style={button}>{running ? 'Stop' : 'Close'}</button></footer>
    </section>
  </div>;
}

function DiscardConfirmation({active, onKeep, onDiscard}: {active: boolean; onKeep: () => void; onDiscard: () => void}) {
  const dialogRef = useRef<HTMLElement>(null);
  useOwnedDialog({active, dialogRef, onClose: onKeep});
  if (!active) return null;
  return <div style={{position: 'fixed', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,.65)'}}>
    <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="discard-stems-title" tabIndex={-1} style={{...box, width: 'min(440px,100%)', background: 'var(--color-bg-primary, #fff)', color: 'var(--color-text-primary, #222)', boxShadow: '0 1rem 3rem rgba(0,0,0,.4)'}}>
      <h3 id="discard-stems-title">Discard reviewed recordings?</h3>
      <p>Closing removes the recordings still in this review. Downloads are not removed from your computer.</p>
      <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap'}}><button type="button" data-initial-focus="true" onClick={onKeep} style={button}>Keep reviewing</button><button type="button" onClick={onDiscard} style={button}>Discard and close</button></div>
    </section>
  </div>;
}

function NumberField({label, value, min, max, step = 1, set, disabled}: {label: string; value: number; min: number; max: number; step?: number; set: (value: number) => void; disabled: boolean}) {
  return <label>{label}<input aria-label={label} type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={event => set(Number(event.target.value))} style={{...button, width: 110, display: 'block'}}/></label>;
}
