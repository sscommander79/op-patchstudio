import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useOwnedDialog } from '../../hooks/useOwnedDialog';
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
type Topic = 'overview' | 'hardware' | 'software' | 'capture' | 'library' | 'backup';
type Tab = 'drum' | 'multisample' | 'library';

const readStudioRoute = (): { view: View; tab?: Tab } => {
  const route = window.location.hash.replace(/^#\/studio\/?/, '');
  if (route === 'devices') return { view: 'devices' };
  if (route === 'create') return { view: 'create' };
  if (route === 'transfer') return { view: 'manage' };
  if (route === 'drum' || route === 'multisample' || route === 'library') return { view: 'workspace', tab: route };
  return { view: 'start' };
};

const routeHash = (view: View, tab?: Tab): string => {
  if (view === 'workspace') return `#/studio/${tab ?? 'drum'}`;
  if (view === 'manage') return '#/studio/transfer';
  if (view === 'devices') return '#/studio/devices';
  if (view === 'create' || view === 'source' || view === 'setup') return '#/studio/create';
  return '#/studio/overview';
};

const topics: { id: Topic; title: string; body: string }[] = [
  { id: 'overview', title: 'Choose a task', body: 'Start with a synth or drum kit. Each setup opens an existing editor where you can import audio, record takes, shape sounds, and export an OP-XY preset.' },
  { id: 'hardware', title: 'Hardware synth connections', body: 'Connect synth audio to an input the browser can use. For automatic multisampling, also connect a MIDI output to the synth. Select the matching input, enable MIDI, check one note, then capture a range. Manual and sound-triggered recording are also available.' },
  { id: 'software', title: 'Software synth connections', body: 'Keep the instrument in your DAW. Route DAW audio to a browser input through a virtual audio route or an audio interface. For automatic multisampling, also route browser MIDI to the DAW through a virtual MIDI port. The browser does not host the plugin. Check one note before recording a range.' },
  { id: 'capture', title: 'Recording and review', body: 'Enable an audio input before manual capture. Sound-triggered mode starts after the threshold is crossed. Automatic multisampling sends MIDI notes through the selected output. Captured takes stay in review until you add them to the project. Closing with pending work asks before discarding.' },
  { id: 'library', title: 'Library', body: 'Use Project → Save to library in an editor, then browse or search saved instruments in Library. The library is stored in this browser.' },
  { id: 'backup', title: 'Back up or transfer', body: 'Project → Download project saves one editable project archive. Project → Open project restores it. Export OP-XY creates a separate device preset ZIP. Extract that ZIP without changing its contents, copy the intact .preset folder to the OP-XY presets folder in MTP mode, eject, then load and listen on the device. The export dialog has the detailed transfer guide. Full-library backup and restore is not available yet.' },
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
      <div className="studio-help-results">{matches.length ? matches.map(item => <article key={item.id}><h3>{item.title}</h3><p>{item.body}</p></article>) : <p>No guide matches this search.</p>}</div>
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
  const [view, setView] = useState<View>(() => readStudioRoute().view);
  const routeRef = useRef(window.location.hash);
  const [task, setTask] = useState<Task>('multisample');
  const [source, setSource] = useState<Source>('hardware');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [notice, setNotice] = useState('');
  const [stemOpen,setStemOpen]=useState(false);
  const [stemSlice,setStemSlice]=useState<SliceSourceRequest|null>(null);
  const [recorderRequest, setRecorderRequest] = useState<RecorderRequest | null>(null);
  const nextRecorderRequestId = useRef(0);
  const contentRef = useRef<HTMLElement>(null);
  const guard = useCallback((action: () => void) => {
    const recorder = document.querySelector<HTMLElement>('[data-recording-modal="true"], [data-workspace-modal]');
    if (recorder) { setNotice('Finish or close the open recording or slicing session before changing workspaces. Your work remains here.'); recorder.focus(); return false; }
    setNotice(''); action(); return true;
  }, []);
  const openHelp = useCallback((next: Topic) => setTopic(next), []);
  const navigate = useCallback((nextView: View, tab?: Tab) => {
    const hash = routeHash(nextView, tab);
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
        setNotice('Finish or close the open recording or slicing session before changing workspaces. Your work remains here.');
        window.history.pushState(null, '', routeRef.current || routeHash('start'));
        return;
      }
      routeRef.current = hash;
      const next = readStudioRoute();
      if (next.view !== 'workspace') setRecorderRequest(null);
      if (next.tab) dispatch({ type: 'SET_TAB', payload: next.tab });
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
  const workspace = (tab: Tab, record = false, guided = task === 'multisample') => guard(() => {
    setRecorderRequest(record && tab !== 'library' ? { id: ++nextRecorderRequestId.current, tab, guided: guided && tab === 'multisample', source } : null);
    navigate('workspace', tab);
  });
  const chooseTask = (chosen: Task) => guard(() => { setTask(chosen); setView(chosen === 'drum' ? 'setup' : 'source'); });
  // Launch modules open their tool directly; the guided setup stays one optional step away.
  const openSetupGuide = (chosen: Task) => guard(() => { setTask(chosen); navigate(chosen === 'drum' ? 'setup' : 'source'); });
  const multisampleCount = state.multisampleFiles.filter(sample => sample.isLoaded).length;
  // Indices 24+ hold the unassigned review tray, which is not a pad.
  const drumCount = state.drumSamples.slice(0, 24).filter(sample => sample?.isLoaded).length;
  // Transfer actions open an editor rather than a dialog, so their labels name that editor.
  const transferTab: Tab = state.currentTab === 'multisample' ? 'multisample' : 'drum';
  const transferEditor = transferTab === 'multisample' ? 'multisample editor' : 'drum kit editor';
  const context: Topic = view === 'manage' ? 'backup' : view === 'devices' ? 'hardware' : view === 'source' || view === 'setup' ? task === 'drum' ? 'capture' : source : view === 'workspace' ? state.currentTab === 'library' ? 'library' : 'capture' : 'overview';
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
      <main className="studio-shell-content" data-view={view} ref={contentRef}>
        {notice && <p role="alert" className="studio-message studio-message-warning">{notice}</p>}
        {view === 'start' && <section className="studio-launch" aria-labelledby="studio-launch-title">
          <div className="studio-launch-heading">
            <div><h1 id="studio-launch-title">What are you working on?</h1><p className="studio-shell-lead">Choose a starting point. Everything stays local.</p></div>
            <p className="studio-launch-local">No cloud · no account<br />Projects stay in this browser</p>
          </div>
          <div className="studio-launch-modules">
            <article className="studio-launch-module" data-launch-module="multisample" aria-labelledby="launch-multisample-title">
              <div className="studio-launch-module-heading"><h2 id="launch-multisample-title">Multisample a synth</h2><p>Capture notes / build an instrument</p></div>
              {opxy ? <OpxyNoteRangeArt loaded={Math.min(multisampleCount, 24)} /> : <NoteRangeDiagram loaded={Math.min(multisampleCount, 24)} />}
              <div className="studio-launch-module-footer"><span className="studio-launch-meta" data-state={multisampleCount ? 'loaded' : 'empty'}>{multisampleCount ? `${multisampleCount} / 24 zones loaded` : 'Note range'}</span>
                <span className="studio-launch-actions"><button type="button" className="studio-launch-link" aria-label="Setup guide: multisample a synth" onClick={() => openSetupGuide('multisample')}>Setup guide</button><button type="button" className="studio-launch-cta" onClick={() => workspace('multisample', true, true)}>Open capture <span aria-hidden="true">→</span></button></span></div>
            </article>
            <article className="studio-launch-module" data-launch-module="sample" aria-labelledby="launch-sample-title">
              <div className="studio-launch-module-heading"><h2 id="launch-sample-title">Sample a sound</h2><p>Record / review / add</p></div>
              {opxy ? <OpxyCaptureArt /> : <CaptureDiagram />}
              <div className="studio-launch-module-footer"><span className="studio-launch-meta" data-state="capture">Record takes</span>
                <span className="studio-launch-actions"><button type="button" className="studio-launch-link" aria-label="Setup guide: sample a sound" onClick={() => openSetupGuide('sample')}>Setup guide</button><button type="button" className="studio-launch-cta" onClick={() => workspace('multisample', true, false)}>Open sampler <span aria-hidden="true">→</span></button></span></div>
            </article>
            <article className="studio-launch-module" data-launch-module="drum" aria-labelledby="launch-drum-title">
              <div className="studio-launch-module-heading"><h2 id="launch-drum-title">Build a drum kit</h2><p>Pad map / shape / export</p></div>
              {opxy ? <OpxyPadMapArt /> : <PadMapDiagram />}
              <div className="studio-launch-module-footer"><span className="studio-launch-meta" data-state={drumCount ? 'loaded' : 'empty'}>{drumCount ? `${drumCount} / 24 pads loaded` : '24 sample slots'}</span>
                <span className="studio-launch-actions"><button type="button" className="studio-launch-link" aria-label="Setup guide: build a drum kit" onClick={() => openSetupGuide('drum')}>Setup guide</button><button type="button" className="studio-launch-cta" onClick={() => workspace('drum')}>Open kit <span aria-hidden="true">→</span></button></span></div>
            </article>
            <article className="studio-launch-module" data-launch-module="tracks" aria-labelledby="launch-tracks-title">
              <div className="studio-launch-module-heading"><h2 id="launch-tracks-title">Record OP-XY tracks</h2><p>Capture / review / export</p></div>
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
            <button type="button" className="studio-start-card" onClick={() => chooseTask('multisample')}><strong>Multisample a synth</strong><small>Capture notes / build an instrument</small><span>Choose source →</span></button>
            <button type="button" className="studio-start-card" onClick={() => chooseTask('sample')}><strong>Sample a sound</strong><small>Record / review / add</small><span>Choose source →</span></button>
            <button type="button" className="studio-start-card" onClick={() => chooseTask('drum')}><strong>Build a drum kit</strong><small>Pad map / shape / export</small><span>Setup steps →</span></button>
          </div>
        </>}
        {view === 'source' && <><button type="button" className="studio-back-link" onClick={() => guard(() => navigate('create'))}>← Back to Create</button><p className="studio-eyebrow">{task === 'sample' ? 'Sample a synth' : 'Multisample a synth'}</p><h1>Where is your synth?</h1><p className="studio-shell-lead">Choose the setup that matches where your sound comes from.</p>
          <div className="studio-source-grid"><button type="button" className="studio-start-card" aria-pressed={source === 'hardware'} onClick={() => setSource('hardware')}><strong>Hardware synth</strong><small>Connect audio to your computer; add MIDI output for automatic note capture.</small></button><button type="button" className="studio-start-card" aria-pressed={source === 'software'} onClick={() => setSource('software')}><strong>Software synth</strong><small>Run it in your DAW. Route audio to a browser input; add virtual MIDI for automatic note capture.</small></button></div>
          <div className="studio-action-row"><button type="button" className="studio-button-primary" onClick={() => guard(() => setView('setup'))}>Continue to setup</button><button type="button" className="studio-button-secondary" onClick={() => openHelp(source)}>Connection help</button></div>
        </>}
        {view === 'setup' && <><button type="button" className="studio-back-link" onClick={() => guard(() => task === 'drum' ? navigate('create') : setView('source'))}>← Back</button><p className="studio-eyebrow">{task === 'drum' ? 'Build a drum kit' : task === 'sample' ? 'Sample a synth' : 'Multisample a synth'}</p><h1>{task === 'drum' ? 'Build your kit' : source === 'software' ? 'Route your software synth' : 'Connect your hardware synth'}</h1>
          <p className="studio-shell-lead">{task === 'drum' ? 'Add audio or record sounds into pads. The drum editor includes slicing, pad mapping, sound shaping, and export.' : task === 'sample' ? source === 'software' ? 'Keep the instrument in your DAW. Bring its audio to a browser input using a virtual audio route or audio interface. MIDI is optional for recording a single sound.' : 'Connect synth audio to a browser input. MIDI is optional for recording a single sound.' : source === 'software' ? 'Keep the instrument in your DAW. Virtual MIDI sends notes to it; a virtual audio route or interface brings its sound into the browser.' : 'Connect synth audio to a browser input and browser MIDI output to the synth.'}</p>
          <div className="studio-setup-panel"><h2>Before recording</h2><ol>{task === 'drum' ? <><li>Choose a pad, then move to the next pad as you build the kit.</li><li>Select a browser audio input in Record takes.</li><li>Review your take before adding it to the kit.</li></> : task === 'sample' ? <><li>Route your synth audio to a browser input.</li><li>Choose that input in Record takes and use Manual or Sound triggered capture.</li><li>Listen to the take, then add it to the instrument. MIDI is optional.</li></> : <><li>Make MIDI and audio routes point to the same instrument.</li><li>Choose the matching input and output in Record takes.</li><li>Check one note, listen, then capture a range.</li></>}</ol><div className="studio-action-row"><button type="button" className="studio-button-primary" onClick={() => workspace(task === 'drum' ? 'drum' : 'multisample', true)}>Open editor and Record takes</button><button type="button" className="studio-button-secondary" onClick={() => workspace(task === 'drum' ? 'drum' : 'multisample')}>Open editor to import audio</button><button type="button" className="studio-button-secondary" onClick={() => openHelp(context)}>Setup help</button></div></div>
        </>}
        {view === 'manage' && <><p className="studio-eyebrow">Keep your work</p><h1>Back up or transfer</h1><p className="studio-shell-lead">An editable project, a saved library entry, and an OP-XY device preset are separate things.</p><div className="studio-manage-grid">
          <article><h2>Editable project archive</h2><p>In an editor, Project → Download project saves the current project with audio and settings. Project → Open project restores one archive.</p><button type="button" className="studio-button-primary" onClick={() => workspace(transferTab)}>Open {transferEditor} (Project menu)</button></article>
          <article><h2>Saved library</h2><p>Project → Save to library stores the current instrument in this browser. Full-library backup and restore is not available yet.</p><button type="button" className="studio-button-secondary" onClick={() => workspace('library')}>Open library</button></article>
          <article><h2>OP-XY preset ZIP</h2><p>Export OP-XY prepares a device preset ZIP. Extract it, copy the intact .preset folder to the OP-XY presets folder in MTP mode, eject, then load and listen on the device. The export dialog provides detailed transfer steps.</p><button type="button" className="studio-button-secondary" onClick={() => workspace(transferTab)}>Open {transferEditor} (Export OP-XY)</button></article>
        </div></>}
        {view === 'devices' && <Suspense fallback={<p>Loading devices…</p>}><DevicesWorkspace {...devicesWorkspaceProps} /></Suspense>}
        {view === 'workspace' && <>{state.currentTab !== 'library' && <h1 className="studio-visually-hidden">{title}</h1>}{(state.currentTab === 'drum' || state.currentTab === 'multisample') && <ProjectToolbar onRetrySave={onRetrySave} />}<MainTabs recorderRequest={recorderRequest} onRecorderRequestConsumed={() => setRecorderRequest(null)} /></>}
      </main>
    </div>
    {topic && <Help topic={topic} setTopic={setTopic} close={() => setTopic(null)} />}
    {stemOpen && <Suspense fallback={null}><StemRecordingModal isOpen={stemOpen} onClose={()=>setStemOpen(false)} onSlice={file=>setStemSlice({kind:'file',file})}/></Suspense>}
    {stemSlice && <Suspense fallback={null}><SliceAudioModal isOpen request={stemSlice} existingSamples={state.drumSamples} projectAssets={[...state.drumSamples,...state.multisampleFiles]} midiNoteMapping={state.midiNoteMapping} commitResult={state.sliceCommitResult} onClose={()=>setStemSlice(null)} onApply={(operationId,prepared)=>dispatch({type:'COMMIT_PREPARED_SLICES',payload:{operationId,prepared}})}/></Suspense>}
  </div>;
}
