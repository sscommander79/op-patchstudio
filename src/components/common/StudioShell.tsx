import { hasNativeInstrumentHost } from '../../utils/nativeInstrument';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useOwnedDialog } from '../../hooks/useOwnedDialog';
import { InstrumentJourney, JourneyDiagram, type InstrumentSource } from './InstrumentJourney';
import { MainTabs, type RecorderRequest } from './MainTabs';
import { ProjectToolbar } from './ProjectToolbar';
import { PercussionIllustration } from './PercussionIllustration';
import { useStudioAppearance } from '../../context/StudioTheme';
import { OpxyCaptureArt, OpxyHeaderDisplay, OpxyNoteRangeArt, OpxyPadMapArt, OpxyTracksArt } from './opxy/OpxyLaunchArt';
import type { SliceSourceRequest } from '../drum/SliceAudioModal';
import type { DevicesWorkspaceProps } from '../devices/DevicesWorkspace';

const StemRecordingModal = lazy(() => import('./StemRecordingModal').then(module => ({ default: module.StemRecordingModal })));
const SliceAudioModal = lazy(() => import('../drum/SliceAudioModal').then(module => ({ default: module.SliceAudioModal })));
const DevicesWorkspace = lazy(() => import('../devices/DevicesWorkspace').then(module => ({ default: module.DevicesWorkspace })));

type View = 'start' | 'create' | 'source' | 'setup' | 'manage' | 'devices' | 'workspace';
type Task = 'multisample' | 'sample' | 'drum';
type Source = 'hardware' | 'software';
type Topic = 'overview' | 'files' | 'loops' | 'hardware' | 'software' | 'capture' | 'library' | 'backup';
type Tab = 'drum' | 'multisample' | 'library';

const readStudioRoute = (): { view: View; tab?: Tab; softwareInstrument?:boolean } => {
  const route = window.location.hash.replace(/^#\/studio\/?/, '');
  if (route === 'multisample/instrument') return {view:'workspace',tab:'multisample',softwareInstrument:hasNativeInstrumentHost()};
  if (route === 'devices') return { view: 'devices' };
  if (route === 'create') return { view: 'create' };
  if (route === 'source') return { view: 'source' };
  if (route === 'setup') return { view: 'setup' };
  if (route === 'transfer') return { view: 'manage' };
  if (route === 'drum' || route === 'multisample' || route === 'library') return { view: 'workspace', tab: route };
  return { view: 'start' };
};

const routeHash = (view: View, tab?: Tab): string => {
  if (view === 'workspace') return `#/studio/${tab ?? 'drum'}`;
  if (view === 'manage') return '#/studio/transfer';
  if (view === 'devices') return '#/studio/devices';
  if (view === 'source') return '#/studio/source';
  if (view === 'setup') return '#/studio/setup';
  if (view === 'create') return '#/studio/create';
  return '#/studio/overview';
};

const topics: { id: Topic; title: string; body: string }[] = [
  { id: 'overview', title: 'Choose a task', body: 'Make a playable instrument from one audio file, a set of recorded notes, a software instrument or hardware. Or build a drum kit with individual sounds. Choose a source to get the right steps; open an editor directly when you are ready to work.' },
  { id: 'files', title: 'Audio files and recorded notes', body: 'One recording can play at different pitches across the keyboard. A set of recordings keeps more of the original instrument’s character. Confirm the original note for each file before adding it. If a note already has a recording, choose whether to keep or replace it. Add supported audio files from sample packs, not presets made for another sampler.' },
  { id: 'loops', title: 'Holding a sound with a loop', body: 'A loop repeats a chosen middle section of a recording while a sound is sustained. Try it for pads, strings or organs; a short drum hit often does not need it. Listen for clicks or a pulsing change at the join. Looping reuses existing audio; it does not record more notes. Check the instrument’s looping setting as well as the markers.' },
  { id: 'hardware', title: 'Hardware synth connections', body: 'Connect synth audio to an input the browser can use. For automatic multisampling, also connect a MIDI output to the synth. Select the matching input, enable MIDI, check one note, then record a range. Manual and sound-triggered recording are also available.' },
  { id: 'software', title: 'Software synth connections', body: 'Open the instrument in your music software and choose the sound you want. Route its audio to a browser input through a virtual audio route or an audio interface. For automatic multisampling, also route browser MIDI to your music software through a virtual MIDI port. The browser does not host the plugin. Check one note before recording a range.' },
  { id: 'capture', title: 'Recording and review', body: 'Enable an audio input before manual recording. Sound-triggered mode starts after the threshold is crossed. Automatic multisampling sends MIDI notes through the selected output. Captured takes stay in review until you add them to the project. Closing with pending work asks before discarding.' },
  { id: 'library', title: 'Library', body: 'Use Project → Save to library in an editor, then browse or search saved instruments in Library. The library is stored in this browser.' },
  { id: 'backup', title: 'Back up or transfer', body: 'Project → Back up project saves one editable project archive. Project → Open project restores it. Download OP-XY preset creates a separate device preset ZIP. Extract that ZIP without changing its contents, copy the intact .preset folder to the OP-XY presets folder in MTP mode, eject, then load and listen on the device. The export dialog has the detailed transfer guide. Full-library backup and restore is not available yet.' },
];

// Note range shows project data; capture and drum diagrams illustrate their workflows.
function NoteRangeDiagram({ loaded }: { loaded: number }) {
  const rows = Array.from({ length: 14 }, (_, index) => index);
  const blackRows = [1, 3, 6, 8, 10, 13];
  return <svg className="studio-launch-diagram" data-launch-diagram="note-range" data-loaded={loaded} viewBox="0 0 280 112" preserveAspectRatio="none" role="img" aria-label={`Note range diagram: 24 zones across the keyboard, ${loaded} loaded`}>
    <rect className="studio-launch-diagram-frame" x={1} y={1} width={278} height={110} />
    <g className="studio-launch-diagram-keys">{rows.map(row => <rect key={row} className={blackRows.includes(row) ? 'studio-launch-key-black' : 'studio-launch-key-white'} x={1} y={1 + row * (110 / 14)} width={blackRows.includes(row) ? 12 : 18} height={110 / 14} />)}</g>
    <g className="studio-launch-diagram-grid">{Array.from({ length: 24 }, (_, index) => <rect key={index} data-zone={index} data-zone-state={index < loaded ? 'loaded' : 'empty'} x={22 + index * (256 / 24)} y={1} width={256 / 24} height={110} />)}</g>
    <g className="studio-launch-diagram-rows">{rows.slice(1).map(row => <line key={row} x1={22} x2={279} y1={1 + row * (110 / 14)} y2={1 + row * (110 / 14)} />)}</g>
  </svg>;
}

function CaptureDiagram() {
  const bars = [8, 16, 30, 52, 74, 88, 70, 46, 60, 38, 24, 14, 8, 5, 3];
  return <svg className="studio-launch-diagram" data-launch-diagram="capture" viewBox="0 0 280 112" preserveAspectRatio="none" role="img" aria-label="Capture diagram: record a take, review the waveform, then add it">
    <line className="studio-launch-diagram-baseline" x1={0} y1={104} x2={280} y2={104} />
    <g className="studio-launch-diagram-wave">{bars.map((height, index) => <rect key={index} x={18 + index * 14} y={56 - height / 2} width={5} height={height} />)}</g>
    <line className="studio-launch-diagram-marker" x1={188} y1={8} x2={188} y2={100} />
    <text x={198} y={20}>REVIEW</text>
  </svg>;
}

const percussionNames = ['Bass drum', 'Snare', 'Hi-hat', 'Cymbal', 'Tom', 'Cowbell', 'Tambourine', 'Shaker', 'Claves', 'Conga', 'Triangle', 'Woodblock'] as const;

function PadMapDiagram() {
  const palette = ['blue', 'orange', 'gray', 'black', 'yellow'] as const;
  return <svg className="studio-launch-diagram" data-launch-diagram="pad-map" viewBox="0 0 280 112" preserveAspectRatio="none" role="img" aria-label="Drum kit illustration: bass drum, snare and percussion on six colorful pads">
    {percussionNames.slice(0, 6).map((name, index) => {
      const x = (index % 3) * 95, y = 6 + Math.floor(index / 3) * 54;
      return <g key={name} data-pad-illustration={index} data-art-color={palette[index % palette.length]}>
        <rect className="studio-launch-pad" x={x} y={y} width={85} height={46} />
        <svg data-percussion={name} x={x + 21} y={y + 4} width={43} height={38} viewBox="0 0 40 30" aria-hidden="true">
          <PercussionIllustration index={index} />
        </svg>
      </g>;
    })}
  </svg>;
}

function TrackRecordingDiagram() {
  return <svg className="studio-launch-diagram" data-launch-diagram="tracks" viewBox="0 0 280 112" preserveAspectRatio="none" role="img" aria-label="Multitrack recording illustration: capture OP-XY tracks into separate audio lanes">
    {Array.from({ length: 8 }, (_, index) => <g key={index}>
      <rect className="studio-launch-track-lane" x={1} y={3 + index * 13} width={278} height={10} />
      <path className="studio-launch-track-wave" d={`M${12 + index % 3 * 10} ${8 + index * 13} h18 l3 -3 3 6 3 -6 3 3 h${30 + index % 4 * 18} l3 -3 3 6 3 -3 h${40 - index % 3 * 9}`} />
    </g>)}
    <line className="studio-launch-diagram-marker" x1={184} y1={0} x2={184} y2={108} />
  </svg>;
}

function Help({ topic, setTopic, close }: { topic: Topic; setTopic: (topic: Topic) => void; close: () => void }) {
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  useOwnedDialog({ active: true, dialogRef, onClose: close });
  useEffect(() => { setQuery(''); }, [topic]);
  const matches = topics.filter(item => query.trim() ? `${item.title} ${item.body}`.toLowerCase().includes(query.trim().toLowerCase()) : item.id === topic);
  return <div className="studio-help-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <aside ref={dialogRef} className="studio-help-panel" role="dialog" aria-modal="true" aria-label="Help" tabIndex={-1}>
      <div className="studio-help-heading"><div><p className="studio-eyebrow">Help</p><h2>Studio guide</h2></div><button type="button" data-initial-focus="true" className="studio-button-secondary" onClick={close}>Close Help</button></div>
      <label className="studio-help-search">Search help<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <nav className="studio-help-topics" aria-label="Help topics">{topics.map(item => <button type="button" key={item.id} aria-current={item.id === topic ? 'page' : undefined} onClick={() => setTopic(item.id)}>{item.title}</button>)}</nav>
      <div className="studio-help-results">{matches.length ? matches.map(item => <article key={item.id}><h3>{item.title}</h3>{(item.id==='hardware'||item.id==='software'||item.id==='files')&&<JourneyDiagram source={item.id==='files'?'set':item.id}/>}<p>{item.body}</p><button type="button" className="studio-button-secondary" onClick={close}>Return to my task</button></article>) : <div><p>No guide matches this search. Try a sound, recording or saving topic.</p><button type="button" className="studio-button-secondary" onClick={() => setQuery('')}>Clear search</button></div>}</div>
    </aside>
  </div>;
}

export function StudioShell({
  onRetrySave,
  devicesWorkspaceProps,
  themePicker,
}: {
  onRetrySave?: () => void | Promise<void>;
  devicesWorkspaceProps?: DevicesWorkspaceProps;
  themePicker?: React.ReactNode;
}) {
  const { state, dispatch } = useAppContext();
  const opxy = useStudioAppearance() === 'opxy';
  const [softwareInstrument,setSoftwareInstrument]=useState(()=>Boolean(readStudioRoute().softwareInstrument));
  const [view, setView] = useState<View>(() => readStudioRoute().view);
  const routeRef = useRef(window.location.hash);
  const [task, setTask] = useState<Task>('multisample');
  const [transferInstrument,setTransferInstrument]=useState<'drum'|'multisample'>(state.currentTab==='multisample'?'multisample':'drum');
  useEffect(()=>{if(state.currentTab==='drum'||state.currentTab==='multisample')setTransferInstrument(state.currentTab);},[state.currentTab]);
  const [source, setSource] = useState<Source>('hardware');
  const [journeySource,setJourneySource]=useState<InstrumentSource>('single');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [notice, setNotice] = useState('');
  const [stemOpen,setStemOpen]=useState(false);
  const [stemSlice,setStemSlice]=useState<SliceSourceRequest|null>(null);
  const [recorderRequest, setRecorderRequest] = useState<RecorderRequest | null>(null);
  const nextRecorderRequestId = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const guard = useCallback((action: () => void) => {
    const recorder = document.querySelector<HTMLElement>('[data-recording-modal="true"], [data-workspace-modal]');
    if (recorder) { setNotice('Finish or close the open dialog before changing workspaces. Your work remains here.'); recorder.focus(); return false; }
    setNotice(''); action(); return true;
  }, []);
  useEffect(() => {
    if (!notice) return;
    const clearWhenClosed = () => {
      if (!document.querySelector('[data-recording-modal="true"], [data-workspace-modal]')) setNotice('');
    };
    const observer = new MutationObserver(clearWhenClosed);
    observer.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['data-workspace-modal']});
    clearWhenClosed();
    return () => observer.disconnect();
  }, [notice]);
  const openHelp = useCallback((next: Topic) => setTopic(next), []);
  const navigate = useCallback((nextView: View, tab?: Tab, instrument = false) => {
    const hash = instrument ? '#/studio/multisample/instrument' : routeHash(nextView, tab);
    setSoftwareInstrument(instrument);
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    routeRef.current = hash;
    if (nextView !== 'workspace') setRecorderRequest(null);
    if (tab) dispatch({ type: 'SET_TAB', payload: tab });
    setView(nextView);
  }, [dispatch]);
  useEffect(() => {
    const initial = readStudioRoute();
    if (initial.tab) dispatch({ type: 'SET_TAB', payload: initial.tab });
    const syncFromHistory = () => {
      const hash = window.location.hash;
      if (hash === routeRef.current) return;
      if (document.querySelector('[data-recording-modal="true"], [data-workspace-modal]')) {
        setNotice('Finish or close the open dialog before changing workspaces. Your work remains here.');
        window.history.pushState(null, '', routeRef.current || routeHash('start'));
        return;
      }
      routeRef.current = hash;
      const next = readStudioRoute();
      if (next.view !== 'workspace') setRecorderRequest(null);
      if (next.tab) dispatch({ type: 'SET_TAB', payload: next.tab });
      setSoftwareInstrument(Boolean(next.softwareInstrument));
      setView(next.view);
    };
    window.addEventListener('popstate', syncFromHistory);
    window.addEventListener('hashchange', syncFromHistory);
    return () => {
      window.removeEventListener('popstate', syncFromHistory);
      window.removeEventListener('hashchange', syncFromHistory);
    };
  }, [dispatch]);
  useEffect(() => {
    const openWorkspace = (event: Event) => {
      const tab = (event as CustomEvent<Tab>).detail;
      if (tab === 'drum' || tab === 'multisample' || tab === 'library') guard(() => navigate('workspace', tab));
    };
    window.addEventListener('opstudio-open-workspace', openWorkspace);
    return () => window.removeEventListener('opstudio-open-workspace', openWorkspace);
  }, [guard, navigate]);
  useEffect(() => {
    const listener = (event: Event) => openHelp((event as CustomEvent<Topic>).detail || 'capture');
    window.addEventListener('opstudio-open-help', listener);
    return () => window.removeEventListener('opstudio-open-help', listener);
  }, [openHelp]);
  // Read by the focus effect below without re-running it when a tool consumes the request.
  const recorderRequestRef = useRef(recorderRequest);
  useEffect(() => { recorderRequestRef.current = recorderRequest; }, [recorderRequest]);
  useEffect(() => {
    if (view === 'workspace' && recorderRequestRef.current) return;
    if (document.querySelector('[data-recording-modal="true"], [data-workspace-modal]')) return;
    // Lazy workspaces (Library) may render their heading a few frames after navigation.
    let attempts = 0;
    let frame = 0;
    const focusHeading = () => {
      const heading = contentRef.current?.querySelector<HTMLElement>('h1');
      if (!heading) {
        if (++attempts < 30) frame = requestAnimationFrame(focusHeading);
        return;
      }
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    frame = requestAnimationFrame(focusHeading);
    return () => cancelAnimationFrame(frame);
  }, [view, state.currentTab]);
  const workspace = (tab: Tab, record = false, guided = task === 'multisample', recordingSource: Source = source) => guard(() => {
    if(tab==='multisample'&&record&&recordingSource==='software'&&hasNativeInstrumentHost()){setRecorderRequest(null);navigate('workspace',tab,true);return;}
    setRecorderRequest(record && tab !== 'library' ? { id: ++nextRecorderRequestId.current, tab, guided: guided && tab === 'multisample', source: recordingSource } : null);
    navigate('workspace', tab);
  });
  const chooseTask = (chosen: Task) => guard(() => { setTask(chosen); navigate(chosen === 'drum' ? 'setup' : 'source'); });
  // Launch modules open their tool directly; the guided setup stays one optional step away.
  const openSetupGuide = (chosen: Task) => guard(() => { setTask(chosen); navigate(chosen === 'drum' ? 'setup' : 'source'); });
  const multisampleCount = state.multisampleFiles.filter(sample => sample.isLoaded).length;
  // Indices 24+ hold the unassigned review tray, which is not a pad.
  const drumCount = state.drumSamples.slice(0, 24).filter(sample => sample?.isLoaded).length;
  // Transfer actions open an editor rather than a dialog, so their labels name that editor.
  const transferTab=transferInstrument;
  const transferEditor = transferTab === 'multisample' ? 'multisample editor' : 'drum kit editor';
  const context: Topic = view === 'manage' ? 'backup' : view === 'devices' ? 'hardware' : view === 'source' ? 'overview' : view === 'setup' ? task === 'drum' ? 'capture' : source : view === 'workspace' ? state.currentTab === 'library' ? 'library' : 'capture' : 'overview';
  const title = view === 'workspace' ? state.currentTab === 'multisample' ? 'Multisample editor' : state.currentTab === 'drum' ? 'Drum kit editor' : state.currentTab === 'library' ? 'Library' : state.currentTab === 'feedback' ? 'Feedback' : 'Support' : view === 'devices' ? 'Devices' : view === 'create' ? 'Create' : view === 'source' ? 'Choose source' : view === 'setup' ? 'Set up' : view === 'manage' ? 'Back up or transfer' : 'Overview';
  return <div className="studio-shell">
    <header className="studio-shell-header" aria-label="Studio navigation">
      <div className="studio-shell-header-main">
        <div className="studio-shell-brand">{opxy && <OpxyHeaderDisplay />}<strong>OP–PatchStudio</strong><small>Unofficial preset studio</small></div>
        <nav className="studio-shell-nav studio-shell-primary-nav" aria-label="Workspace"><span>WORKSPACE</span>
          <button type="button" aria-current={view === 'start' ? 'page' : undefined} onClick={() => guard(() => navigate('start'))}>Overview</button>
          <button type="button" aria-current={view === 'workspace' && state.currentTab === 'library' ? 'page' : undefined} onClick={() => workspace('library')}>Library</button>
          <button type="button" aria-current={view === 'manage' ? 'page' : undefined} onClick={() => guard(() => navigate('manage'))}>Transfer</button>
          <button type="button" aria-current={view === 'devices' ? 'page' : undefined} onClick={() => guard(() => navigate('devices'))}>Devices</button>
        </nav>
        <div className="studio-shell-header-meta"><span>LOCAL WORKSPACE</span>{themePicker}<button type="button" className="studio-button-secondary" onClick={() => openHelp(context)}>Help</button></div>
      </div>
      {view !== 'start' && <p className="studio-shell-location"><span>Studio / <strong>{title}</strong></span></p>}
    </header>
    <div className="studio-shell-main">
      <div className="studio-shell-content" data-view={view} ref={contentRef}>
        {notice && <p role="alert" className="studio-message studio-message-warning">{notice}</p>}
        {view === 'start' && <section className="studio-launch" aria-labelledby="studio-launch-title">
          <div className="studio-launch-heading">
            <div><h1 id="studio-launch-title">What are you working on?</h1><p className="studio-shell-lead">Choose a starting point. Everything stays local.</p></div>
            <p className="studio-launch-local">No cloud · no account<br />Projects stay in this browser</p>
          </div>
          <div className="studio-launch-modules">
            <article className="studio-launch-module" data-launch-module="multisample" aria-labelledby="launch-multisample-title">
              <div className="studio-launch-module-heading"><h2 id="launch-multisample-title">Make a playable instrument</h2><p>Choose a source / play across the keys</p></div>
              {opxy ? <OpxyNoteRangeArt loaded={Math.min(multisampleCount, 24)} /> : <NoteRangeDiagram loaded={Math.min(multisampleCount, 24)} />}
              <div className="studio-launch-module-footer"><span className="studio-launch-meta" data-state={multisampleCount ? 'loaded' : 'empty'}>{multisampleCount ? `${multisampleCount} / 24 zones loaded` : 'Note range'}</span>
                <span className="studio-launch-actions"><button type="button" className="studio-launch-link" aria-label="Guide: make a playable instrument" onClick={() => openSetupGuide('multisample')}>Setup guide</button><button type="button" className="studio-launch-cta" onClick={() => openSetupGuide('multisample')}>Choose a source <span aria-hidden="true">→</span></button></span></div>
            </article>
            <article className="studio-launch-module" data-launch-module="sample" aria-labelledby="launch-sample-title">
              <div className="studio-launch-module-heading"><h2 id="launch-sample-title">Record a drum sound</h2><p>Choose a pad / record / listen</p></div>
              {opxy ? <OpxyCaptureArt /> : <CaptureDiagram />}
              <div className="studio-launch-module-footer"><span className="studio-launch-meta" data-state="capture">Record into a drum pad</span>
                <span className="studio-launch-actions"><button type="button" className="studio-launch-link" aria-label="Setup guide: record a drum sound" onClick={() => openSetupGuide('drum')}>Setup guide</button><button type="button" className="studio-launch-cta" onClick={() => workspace('drum', true, false)}>Record a sound <span aria-hidden="true">→</span></button></span></div>
            </article>
            <article className="studio-launch-module" data-launch-module="drum" aria-labelledby="launch-drum-title">
              <div className="studio-launch-module-heading"><h2 id="launch-drum-title">Build a drum kit</h2><p>Pad map / shape / export</p></div>
              {opxy ? <OpxyPadMapArt /> : <PadMapDiagram />}
              <div className="studio-launch-module-footer"><span className="studio-launch-meta" data-state={drumCount ? 'loaded' : 'empty'}>{drumCount ? `${drumCount} / 24 pads loaded` : '24 sample slots'}</span>
                <span className="studio-launch-actions"><button type="button" className="studio-launch-link" aria-label="Setup guide: build a drum kit" onClick={() => openSetupGuide('drum')}>Setup guide</button><button type="button" className="studio-launch-cta" onClick={() => workspace('drum')}>Open kit <span aria-hidden="true">→</span></button></span></div>
            </article>
            <article className="studio-launch-module" data-launch-module="tracks" aria-labelledby="launch-tracks-title">
              <div className="studio-launch-module-heading"><h2 id="launch-tracks-title">Record OP-XY tracks</h2><p>Record / review / download</p></div>
              {opxy ? <OpxyTracksArt /> : <TrackRecordingDiagram />}
              <div className="studio-launch-module-footer"><span className="studio-launch-meta">Separate audio tracks</span>
                <span className="studio-launch-actions"><button type="button" className="studio-launch-cta" aria-label="Record OP-XY tracks" onClick={() => guard(() => setStemOpen(true))}>Open recorder <span aria-hidden="true">→</span></button></span></div>
            </article>
          </div>
          <button type="button" className="studio-launch-gear" aria-labelledby="launch-gear-title launch-gear-cta" onClick={() => guard(() => navigate('devices'))}>
            <span className="studio-launch-gear-title"><strong id="launch-gear-title">External gear</strong><small>Connect / map / save a setup</small></span>
            <span className="studio-launch-gear-flow" aria-hidden="true"><span>MIDI CC</span><i>→</i><span>Synth</span><i>→</i><span>State</span></span>
            <span className="studio-launch-gear-cta" id="launch-gear-cta">Open devices<span aria-hidden="true"> →</span></span>
          </button>
          <div className="studio-launch-secondary">
            <button type="button" onClick={() => workspace('library')}><strong>Open library</strong><small>Browse saved instruments<span aria-hidden="true"> →</span></small></button>
            <button type="button" onClick={() => guard(() => navigate('manage'))}><strong>Back up or transfer</strong><small>Keep an editable project copy<span aria-hidden="true"> →</span></small></button>
          </div>
          <p className="studio-launch-footer"><span>Projects save locally</span><span>Transfer from the project controls</span></p>
        </section>}
        {view === 'create' && <><p className="studio-eyebrow">Guided setup</p><h1>What would you like to make?</h1><p className="studio-shell-lead">A step-by-step path: choose a task, match your setup, then open the editor. Overview opens each tool directly.</p>
          <div className="studio-start-grid">
            <button type="button" className="studio-start-card" onClick={() => chooseTask('multisample')}><strong>Make a playable instrument</strong><small>Use audio files or record notes</small><span>Choose source →</span></button>
            <button type="button" className="studio-start-card" onClick={() => workspace('drum',true,false)}><strong>Record a drum sound</strong><small>Choose a pad / record / listen</small><span>Record a sound →</span></button>
            <button type="button" className="studio-start-card" onClick={() => chooseTask('drum')}><strong>Build a drum kit</strong><small>Pad map / shape / export</small><span>Setup steps →</span></button>
          </div>
        </>}
        {view === 'source' && <><button type="button" className="studio-back-link" onClick={() => guard(() => navigate('start'))}>← Back to Overview</button><InstrumentJourney initialSource={journeySource} onSourceChange={setJourneySource} onRecord={chosen => { setSource(chosen); workspace('multisample', true, true, chosen); }} onOpenEditor={() => workspace('multisample')} /></>}
        {view === 'setup' && <><button type="button" className="studio-back-link" onClick={() => guard(() => navigate('create'))}>← Back</button><p className="studio-eyebrow">Build a drum kit</p><h1>Build your kit</h1>
          <p className="studio-shell-lead">Add audio or record sounds into pads. Then listen, trim and arrange your kit.</p>
          <div className="studio-setup-panel"><h2>Before recording</h2><ol><li>Choose a pad, then move to the next pad as you build the kit.</li><li>Select a browser audio input in Record takes.</li><li>Review your take before adding it to the kit.</li></ol><div className="studio-action-row"><button type="button" className="studio-button-primary" onClick={() => workspace('drum', true, false)}>Open editor and Record takes</button><button type="button" className="studio-button-secondary" onClick={() => workspace('drum')}>Open editor to import audio</button><button type="button" className="studio-button-secondary" onClick={() => openHelp(context)}>Setup help</button></div></div>
        </>}
        {view === 'manage' && <><p className="studio-eyebrow">Keep your work</p><h1>Back up and transfer</h1><p className="studio-shell-lead">Save editable work for later, or prepare a preset for your OP-XY. These are different files.</p>
          <label className="studio-transfer-choice">Instrument to save or download <select value={transferInstrument} onChange={event=>setTransferInstrument(event.target.value as 'drum'|'multisample')}><option value="drum">Drum kit</option><option value="multisample">Playable instrument</option></select></label>
          <ProjectToolbar onRetrySave={onRetrySave} showFileActions selectedInstrument={transferInstrument}/>
          <div className="studio-manage-grid">
            <article><span className="studio-step-number">01</span><h2>Back up your project</h2><p>Back up project downloads an editable copy with your audio and settings. Use Open project to restore that file later.</p><p>Saved in this browser is a separate local copy. Keep a backup somewhere you can find it.</p></article>
            <article><span className="studio-step-number">02</span><h2>Save to your library</h2><p>Save to library keeps this instrument in this browser's collection. It does not copy it to your OP-XY. Full-library backup and restore is not available yet.</p><button type="button" className="studio-button-secondary" onClick={() => workspace('library')}>Browse saved instruments</button></article>
            <article><span className="studio-step-number">03</span><h2>How to copy to OP-XY</h2><p>Download OP-XY preset checks and packages the instrument. The download dialog explains how to unpack it, copy the intact preset folder to your device, safely disconnect, then listen.</p><p>The app cannot confirm that you copied or played it on your OP-XY.</p></article>
          </div><button type="button" className="studio-back-link" onClick={() => workspace(transferTab)}>Return to {transferEditor}</button></>}
        {view === 'devices' && <Suspense fallback={<p>Loading devices…</p>}><DevicesWorkspace {...devicesWorkspaceProps} /></Suspense>}
        {view === 'workspace' && <>{!softwareInstrument && state.currentTab !== 'library' && <h1 className="studio-visually-hidden">{title}</h1>}{!softwareInstrument && (state.currentTab === 'drum' || state.currentTab === 'multisample') && <ProjectToolbar onRetrySave={onRetrySave} />}<MainTabs softwareInstrument={softwareInstrument} recorderRequest={recorderRequest} onRecorderRequestConsumed={() => setRecorderRequest(null)} /></>}
      </div>
    </div>
    {topic && <Help topic={topic} setTopic={setTopic} close={() => setTopic(null)} />}
    {stemOpen && <Suspense fallback={null}><StemRecordingModal isOpen={stemOpen} onClose={()=>setStemOpen(false)} onSlice={file=>setStemSlice({kind:'file',file})}/></Suspense>}
    {stemSlice && <Suspense fallback={null}><SliceAudioModal isOpen request={stemSlice} existingSamples={state.drumSamples} projectAssets={[...state.drumSamples,...state.multisampleFiles]} midiNoteMapping={state.midiNoteMapping} commitResult={state.sliceCommitResult} onClose={()=>setStemSlice(null)} onApply={(operationId,prepared)=>dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId,prepared}})}/></Suspense>}
  </div>;
}
