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
  // Display only: the exact KiB figure stays beside it and no budget is derived from the rounded value.
  const exactKib = Math.ceil(plan.estimatedBytes / 1024);
  const friendlySize = plan.estimatedBytes >= 1024 * 1024
    ? `${(plan.estimatedBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${exactKib.toLocaleString()} KB`;

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
        <p className="studio-eyebrow">Check before download</p>
        <h2 id="device-export-title">Export OP-XY preset</h2>
      </div>
      <button type="button" className="studio-icon-button" onClick={onClose} aria-label="Close export preflight" title="Close">×</button>
    </div>
    <p>Review the preset below, then download it as a ZIP file to this computer. Downloading does not copy anything to the OP-XY; you copy the preset over yourself afterwards.</p>
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
      <div><dt>Estimated audio size</dt><dd>About {friendlySize}<br/><small>{exactKib.toLocaleString()} KiB. {plan.sizeBasis}</small></dd></div>
    </dl>
    <section aria-label="Final instrument checks" className="studio-export-checks">
      <h3>Final instrument checks</h3>
      <p>{plan.errors.length ? 'Fix the items listed below before you download.' : `${plan.mappedCount} playable ${plan.mappedCount===1?'zone is':'zones are'} mapped for this preset.`} File audio is estimated at about {friendlySize} ({exactKib.toLocaleString()} KiB) before ZIP overhead; compare the downloaded file with available OP-XY storage.</p>
      <label className="studio-check-row"><input type="checkbox" checked={auditioned} onChange={event=>setAuditioned(event.target.checked)}/> I auditioned the mapped notes or pads, including release tails and loop transitions.</label>
      <label className="studio-check-row"><input type="checkbox" checked={storageChecked} onChange={event=>setStorageChecked(event.target.checked)}/> I checked available device storage and the intended preset destination.</label>
      <p role="status" aria-label="Final check status">{auditioned&&storageChecked?'Listening and storage checks marked complete. Device import still needs physical verification.':'Listening and storage checks are still open. You can still download now and copy the preset to the OP-XY later.'}</p>
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
    {plan.errors.length > 0 && <div role="alert" className="studio-message studio-message-error"><strong>Fix before download</strong><ul>{plan.errors.map(item => <li key={item}>{item}</li>)}</ul></div>}
    {plan.warnings.length > 0 && <div className="studio-message studio-message-warning"><strong>Review</strong><ul>{plan.warnings.map(item => <li key={item}>{item}</li>)}</ul></div>}
    {error && <div role="alert" className="studio-message studio-message-error">Preset creation failed: {error}</div>}
    {downloaded && <div role="status" aria-label="Preset download status" className="studio-message studio-message-success">Download requested. The browser created {downloaded} and was asked to save it, so check your downloads folder. A download is not a device transfer: nothing has been copied to the OP-XY or imported by it yet.</div>}
    {downloaded && <section aria-labelledby="device-export-copy-title" className="studio-export-transfer"><h3 id="device-export-copy-title">How to copy to OP-XY</h3><ol><li>Extract the downloaded ZIP without changing its contents. Keep patch.json and the audio files together inside the extracted <code>{downloaded.replace(/\.zip$/i,'')}</code> folder.</li><li>Connect OP-XY to the computer and select COM → M4 on the device. On macOS, use Field Kit for MTP access as described by the official guide.</li><li>Copy the extracted <code>.preset</code> folder into the root <code>presets</code> folder on OP-XY. Eject safely, then load the preset on the device.</li><li>Play each mapped note or pad and confirm sound, roots, release tails, and loops on the hardware. Keep the editable project backup separately.</li></ol><p>This app cannot copy files to the OP-XY for you, and it has not checked any device connection or import.</p><a href="https://teenage.engineering/guides/op-xy/how-to" target="_blank" rel="noreferrer">Open the current OP-XY transfer guide</a> (opens teenage.engineering in a new tab)</section>}
    <div className="studio-dialog-actions">
      <button type="button" className="studio-button-secondary" onClick={onClose}>Close</button>
      {downloaded && instrument==='drum' && <><button type="button" className="studio-button-secondary" onClick={()=>{onClose();window.dispatchEvent(new CustomEvent('opstudio-return-to-drum-kit'));}}>Return to kit</button><button type="button" className="studio-button-secondary" onClick={()=>{onClose();window.location.hash='#/studio/overview';}}>Overview</button></>}
      <button type="button" className="studio-button-primary" disabled={busy || plan.errors.length > 0} onClick={() => void download()}>{busy ? 'Creating…' : 'Download OP-XY preset'}</button>
    </div>
  </AccessibleDialog>;
}
