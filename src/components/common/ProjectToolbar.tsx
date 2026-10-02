import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext, useProjectHistory } from '../../context/AppContext';
import { saveDrumSettingsAsDefault, saveMultisampleSettingsAsDefault } from '../../utils/defaultSettings';
import { savePresetToLibrary } from '../../utils/libraryUtils';
import { createProjectSnapshot } from '../../utils/projectSerialization';
import { exportProjectArchive, importProjectArchive, projectArchiveFilename } from '../../utils/projectArchive';
import {captureProjectEditIdentity,projectEditIdentityMatches} from '../../utils/projectEditIdentity';
import { ExportPreflight } from './ExportPreflight';

interface ProjectToolbarProps { onRetrySave?: () => void | Promise<void> }

export function ProjectToolbar({ onRetrySave }: ProjectToolbarProps) {
  const { state, dispatch } = useAppContext();
  const { canUndo, canRedo, historyLimited } = useProjectHistory();
  const backupInput = useRef<HTMLInputElement>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const projectMenu = useRef<HTMLDetailsElement>(null);
  const currentState=useRef(state);
  const openOperation=useRef(0);
  const mounted=useRef(true);
  const [busy, setBusy] = useState<'download' | 'open' | 'library' | null>(null);
  const [message, setMessage] = useState<{ kind: 'status' | 'error'; text: string } | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const instrument = state.currentTab === 'multisample' ? 'multisample' : 'drum';
  const settings = instrument === 'drum' ? state.drumSettings : state.multisampleSettings;
  currentState.current=state;

  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;openOperation.current+=1;};},[]);

  useEffect(() => {
    const open = () => setShowPreflight(true);
    window.addEventListener('opstudio-open-export', open);
    return () => window.removeEventListener('opstudio-open-export', open);
  }, []);

  const downloadProject = async () => {
    const snapshot = createProjectSnapshot(state);
    const filename = projectArchiveFilename(state);
    setBusy('download'); setMessage(null);
    try {
      const archive = await exportProjectArchive(snapshot);
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage({ kind: 'status', text: `Downloaded project backup ${filename}` });
    } catch (error) {
      setMessage({ kind: 'error', text: `Could not download project: ${error instanceof Error ? error.message : 'unknown error'}` });
    } finally { setBusy(null); }
  };

  const openProject = async (file: File | undefined) => {
    if (!file) return;
    const operation=++openOperation.current;
    const expectedProject=captureProjectEditIdentity(currentState.current);
    setBusy('open'); setMessage(null);
    try {
      const project = await importProjectArchive(file);
      if(!mounted.current||operation!==openOperation.current)return;
      if(!projectEditIdentityMatches(expectedProject,currentState.current)) {
        throw new Error('The project changed while this backup was opening. Choose Open project and try again');
      }
      dispatch({ type: 'IMPORT_PROJECT', payload: project });
      setMessage({ kind: 'status', text: `Opened project backup ${file.name}` });
    } catch (error) {
      if(!mounted.current||operation!==openOperation.current)return;
      setMessage({ kind: 'error', text: `Could not open project: ${error instanceof Error ? error.message : 'unknown error'}. Your current project was kept.` });
    } finally {
      if(mounted.current&&operation===openOperation.current) {
        setBusy(null);
        if (backupInput.current) backupInput.current.value = '';
      }
    }
  };

  const saveLibrary = useCallback(async () => {
    setBusy('library'); setMessage(null);
    const result = await savePresetToLibrary(state, settings.presetName, instrument);
    setBusy(null);
    setMessage(result.success
      ? { kind: 'status', text: `Saved ${settings.presetName} to the library.` }
      : { kind: 'error', text: result.error ?? 'Could not save to the library.' });
  },[instrument,settings.presetName,state]);

  useEffect(() => {
    const save = () => { if (state.currentTab === 'multisample') void saveLibrary(); };
    window.addEventListener('opstudio-save-library', save);
    return () => window.removeEventListener('opstudio-save-library', save);
  },[saveLibrary,state.currentTab]);

  const saveDefault = () => {
    const result = instrument === 'drum'
      ? saveDrumSettingsAsDefault(state.drumSettings, state.importedDrumPreset)
      : saveMultisampleSettingsAsDefault(state.multisampleSettings, state.importedMultisamplePreset);
    setMessage(result.success
      ? { kind: 'status', text: `Saved current ${instrument} settings as the default.` }
      : { kind: 'error', text: result.error ?? `Could not save ${instrument} defaults.` });
  };

  const saveStatus = state.sessionSaveStatus === 'checking' ? 'Checking saved work…'
    : state.sessionSaveStatus === 'saving' ? 'Saving…'
      : state.sessionSaveStatus === 'saved' ? 'Saved locally'
        : state.sessionSaveStatus === 'error' ? 'Save failed · Retry'
          : 'Unsaved changes';
  const revisionConflict = state.sessionSaveStatus === 'error' && state.sessionSaveError?.includes('another tab');

  return <section data-project-busy={busy !== null ? 'true' : undefined} aria-label="Instrument project controls" className="studio-toolbar">
    <div className="studio-toolbar-main">
      <label className="studio-name-field" htmlFor="instrument-name">
        <span>Instrument name</span>
        <input id="instrument-name" value={settings.presetName} onChange={event => dispatch(instrument === 'drum'
          ? { type: 'SET_DRUM_PRESET_NAME', payload: event.target.value }
          : { type: 'SET_MULTISAMPLE_PRESET_NAME', payload: event.target.value })} />
      </label>
      <div className="studio-save-state" role="status" title={state.sessionSaveError ?? undefined}>{saveStatus}</div>
      {state.sessionSaveStatus === 'error' && state.sessionSaveError && <div className="studio-save-error" role="alert">{state.sessionSaveError}</div>}
      {state.sessionSaveStatus === 'error' && !revisionConflict && <button type="button" className="studio-button-secondary" onClick={() => void onRetrySave?.()}>Retry save</button>}
      <div className="studio-toolbar-actions">
        <button type="button" className="studio-button-secondary" disabled={!canUndo || busy !== null} onClick={() => dispatch({ type: 'UNDO' })} title="Undo (Ctrl/Cmd+Z)">Undo</button>
        <button type="button" className="studio-button-secondary" disabled={!canRedo || busy !== null} onClick={() => dispatch({ type: 'REDO' })} title="Redo (Shift+Ctrl/Cmd+Z)">Redo</button>
        <details ref={projectMenu} className="studio-project-menu">
          <summary>Project</summary>
          <div className="studio-project-menu-popover" onClick={event => { if (event.target instanceof HTMLButtonElement && projectMenu.current) projectMenu.current.open = false; }}>
            <p className="studio-project-menu-note">Project backup keeps editable audio and settings; device patch export is separate.</p>
            <button type="button" disabled={busy !== null} onClick={() => void saveLibrary()}>Save to library</button>
            <button type="button" disabled={busy !== null} onClick={() => void downloadProject()}>Download project</button>
            <button type="button" disabled={busy !== null} onClick={() => backupInput.current?.click()}>Open project</button>
            <button type="button" onClick={saveDefault}>Save settings as default</button>
            <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('opstudio-open-workspace', { detail: 'library' })); }}>Open library</button>
          </div>
        </details>
        <input ref={backupInput} aria-label="Project backup file" hidden type="file" accept=".opstudio,application/vnd.op-patchstudio.project+zip,application/zip" onChange={event => void openProject(event.target.files?.[0])} />
        <button ref={exportButton} type="button" className="studio-button-primary" onClick={() => setShowPreflight(true)}>Export OP-XY</button>
      </div>
    </div>
    {historyLimited && <div role="status">Earlier undo steps were discarded to keep memory use bounded.</div>}
    {message && <div role={message.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{message.text}</div>}
    {showPreflight && <ExportPreflight instrument={instrument} onClose={() => setShowPreflight(false)} returnFocus={exportButton.current} />}
  </section>;
}
