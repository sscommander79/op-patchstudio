import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { usePatchGeneration } from '../../hooks/usePatchGeneration';
import { buildDeviceExportPreflight } from '../../utils/deviceExportPreflight';
import { AccessibleDialog } from './AccessibleDialog';

interface ExportPreflightProps {
  instrument: 'drum' | 'multisample';
  onClose: () => void;
  returnFocus?: HTMLElement | null;
}

export function ExportPreflight({ instrument, onClose, returnFocus }: ExportPreflightProps) {
  const { state, dispatch } = useAppContext();
  const { generateDrumPatchFile, generateMultisamplePatchFile } = usePatchGeneration();
  const [includeUnassigned, setIncludeUnassigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [auditioned, setAuditioned] = useState(false);
  const [storageChecked, setStorageChecked] = useState(false);
  const plan = useMemo(() => buildDeviceExportPreflight(state, instrument, includeUnassigned), [state, instrument, includeUnassigned]);
  useEffect(() => { setAuditioned(false); setStorageChecked(false); setDownloaded(null); }, [instrument, state.drumSamples, state.multisampleFiles, state.drumSettings, state.multisampleSettings, includeUnassigned]);

  const download = async () => {
    setBusy(true);
    setError(null);
    setDownloaded(null);
    const result = instrument === 'drum'
      ? await generateDrumPatchFile(plan.name, { includeUnassigned })
      : await generateMultisamplePatchFile(plan.name);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDownloaded(result.filename);
    window.dispatchEvent(new CustomEvent('opstudio-export-created', { detail: { instrument, filename: result.filename } }));
  };

  return <AccessibleDialog labelledBy="device-export-title" onClose={onClose} returnFocus={returnFocus}>
    <div className="studio-dialog-heading">
      <div>
        <p className="studio-eyebrow">DEVICE PREFLIGHT</p>
        <h2 id="device-export-title">Export OP-XY preset</h2>
      </div>
      <button type="button" className="studio-icon-button" onClick={onClose} aria-label="Close export preflight">×</button>
    </div>
    <label className="studio-name-field" htmlFor="export-instrument-name">
      <span>Instrument name</span>
      <input id="export-instrument-name" data-initial-focus={!plan.name ? 'true' : undefined} value={instrument === 'drum' ? state.drumSettings.presetName : state.multisampleSettings.presetName} onChange={event => dispatch(instrument === 'drum'
        ? { type: 'SET_DRUM_PRESET_NAME', payload: event.target.value }
        : { type: 'SET_MULTISAMPLE_PRESET_NAME', payload: event.target.value })} />
    </label>
    <dl className="studio-preflight-summary">
      <div><dt>Name</dt><dd>{plan.name || 'Missing'}</dd></div>
      <div><dt>Playable</dt><dd>{plan.mappedCount} mapped {plan.mappedCount === 1 ? 'sample' : 'samples'}</dd></div>
      {instrument === 'drum' && <div><dt>Project only</dt><dd>{plan.unassignedCount} retained unassigned {plan.unassignedCount === 1 ? 'sample' : 'samples'}</dd></div>}
      <div><dt>Conversion</dt><dd>{plan.formatSummary}</dd></div>
      <div><dt>Estimated file audio</dt><dd>{Math.ceil(plan.estimatedBytes / 1024).toLocaleString()} KiB<br/><small>{plan.sizeBasis}</small></dd></div>
    </dl>
    <section aria-label="Final instrument checks" className="studio-export-checks">
      <h3>Final instrument checks</h3>
      <p>{plan.errors.length ? 'Fix the blocking items below before export.' : `${plan.mappedCount} playable ${plan.mappedCount===1?'zone is':'zones are'} mapped for this preset.`} File audio is estimated at {Math.ceil(plan.estimatedBytes/1024).toLocaleString()} KiB before ZIP overhead; compare the downloaded file with available OP-XY storage.</p>
      <label className="studio-check-row"><input type="checkbox" checked={auditioned} onChange={event=>setAuditioned(event.target.checked)}/> I auditioned the mapped notes or pads, including release tails and loop transitions.</label>
      <label className="studio-check-row"><input type="checkbox" checked={storageChecked} onChange={event=>setStorageChecked(event.target.checked)}/> I checked available device storage and the intended preset destination.</label>
      <p role="status" aria-label="Final check status">{auditioned&&storageChecked?'Listening and storage checks marked complete. Device import still needs physical verification.':'Listening and storage checks are still open; export can be saved for later transfer.'}</p>
    </section>
    <details className="studio-export-settings">
      <summary>File naming and format</summary>
      <div className="studio-export-settings-grid">
        <label>Audio format<select value={instrument==='drum'?state.drumSettings.audioFormat:state.multisampleSettings.audioFormat} onChange={event=>dispatch(instrument==='drum'?{type:'SET_DRUM_AUDIO_FORMAT',payload:event.target.value as 'wav'|'aiff'}:{type:'SET_MULTISAMPLE_AUDIO_FORMAT',payload:event.target.value as 'wav'|'aiff'})}><option value="wav">WAV</option><option value="aiff">AIFF</option></select></label>
        <label className="studio-check-row"><input type="checkbox" checked={instrument==='drum'?state.drumSettings.renameFiles:state.multisampleSettings.renameFiles} onChange={event=>dispatch(instrument==='drum'?{type:'SET_DRUM_RENAME_FILES',payload:event.target.checked}:{type:'SET_MULTISAMPLE_RENAME_FILES',payload:event.target.checked})}/>Rename files with instrument name</label>
        <label>Filename separator<select value={instrument==='drum'?state.drumSettings.filenameSeparator:state.multisampleSettings.filenameSeparator} onChange={event=>dispatch(instrument==='drum'?{type:'SET_DRUM_FILENAME_SEPARATOR',payload:event.target.value as ' '|'-'}:{type:'SET_MULTISAMPLE_FILENAME_SEPARATOR',payload:event.target.value as ' '|'-'})}><option value=" ">Space</option><option value="-">Hyphen</option></select></label>
      </div>
    </details>
    {instrument === 'drum' && plan.unassignedCount > 0 && <label className="studio-check-row">
      <input type="checkbox" checked={includeUnassigned} onChange={event => setIncludeUnassigned(event.target.checked)} />
      Include {plan.unassignedCount} unassigned {plan.unassignedCount === 1 ? 'sample' : 'samples'} in this device preset
    </label>}
    {plan.errors.length > 0 && <div role="alert" className="studio-message studio-message-error"><strong>Fix before export</strong><ul>{plan.errors.map(item => <li key={item}>{item}</li>)}</ul></div>}
    {plan.warnings.length > 0 && <div className="studio-message studio-message-warning"><strong>Review</strong><ul>{plan.warnings.map(item => <li key={item}>{item}</li>)}</ul></div>}
    {error && <div role="alert" className="studio-message studio-message-error">Preset creation failed: {error}</div>}
    {downloaded && <div role="status" aria-label="Preset download status" className="studio-message studio-message-success">The browser created {downloaded}. This confirms a local download, not device transfer or OP-XY import.</div>}
    {downloaded && <section aria-label="Transfer to OP-XY" className="studio-export-transfer"><h3>Transfer and verify on OP-XY</h3><ol><li>Extract the downloaded ZIP without changing its contents. Keep patch.json and the audio files together inside the extracted <code>{downloaded.replace(/\.zip$/i,'')}</code> folder.</li><li>Connect OP-XY to the computer and select COM → M4 on the device. On macOS, use Field Kit for MTP access as described by the official guide.</li><li>Copy the extracted <code>.preset</code> folder into the root <code>presets</code> folder on OP-XY. Eject safely, then load the preset on the device.</li><li>Play each mapped note or pad and confirm sound, roots, release tails, and loops on the hardware. Keep the editable project backup separately.</li></ol><p>Browser direct USB upload is not available in this workflow; no device connection or import has been verified here.</p><a href="https://teenage.engineering/guides/op-xy/how-to" target="_blank" rel="noreferrer">Open the current OP-XY transfer guide</a></section>}
    <div className="studio-dialog-actions">
      <button type="button" className="studio-button-secondary" onClick={onClose}>Close</button>
      <button type="button" className="studio-button-primary" disabled={busy || plan.errors.length > 0} onClick={() => void download()}>{busy ? 'Creating…' : 'Download preset'}</button>
    </div>
  </AccessibleDialog>;
}
