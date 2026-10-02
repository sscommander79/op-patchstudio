import { useEffect, useRef, useState } from 'react';
import { BrowserMidiSession } from '../../midi/browserSession';
import { DeviceSetupStore } from '../../midi/deviceSetup';
import { NINA_PROFILE } from '../../midi/ninaProfile';
import { CUSTOM_CC_PROFILE_ID } from '../../midi/ccProfile';
import {
  useDevicesWorkspace,
  type DevicesMidiSession,
  type DevicesSetupStore,
} from './useDevicesWorkspace';

export type DevicesWorkspaceProps = {
  session?: DevicesMidiSession;
  store?: DevicesSetupStore;
  supported?: boolean;
};

const monitorLine = (event: {
  direction: 'incoming' | 'outgoing';
  portName: string;
  bytes: number[];
  timestamp: number;
  label?: string;
  channel?: number;
  result?: 'received' | 'sent' | 'failed';
  error?: string;
}): string => {
  const direction = event.direction === 'outgoing' ? 'Outgoing' : 'Incoming';
  const bytes = event.bytes.map(byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  const channel = event.channel ? ` · Channel ${event.channel}` : '';
  const label = event.label ? ` · ${event.label}` : '';
  const result = event.direction === 'incoming'
    ? 'received'
    : event.result === 'failed' ? `failed: ${event.error ?? 'Unknown send failure.'}` : 'sent';
  return `${new Date(event.timestamp).toISOString()} · ${direction} · ${event.portName}${channel} · ${bytes}${label} · ${result}`;
};

export function DevicesWorkspace({ session: providedSession, store: providedStore, supported }: DevicesWorkspaceProps) {
  const [session] = useState<DevicesMidiSession>(() => providedSession ?? new BrowserMidiSession());
  const [store] = useState<DevicesSetupStore>(() => providedStore ?? new DeviceSetupStore());
  const fileInput = useRef<HTMLInputElement>(null);
  const { state, actions } = useDevicesWorkspace({ session, store, supported });

  const [deleteCandidate, setDeleteCandidate] = useState<{id:string; name:string} | null>(null);
  const keepSetup = useRef<HTMLButtonElement>(null);
  const deleteSetup = useRef<HTMLButtonElement>(null);
  const savedSetups = useRef<HTMLSelectElement>(null);
  const restoreDeleteFocus = useRef(false);
  useEffect(() => {
    if (deleteCandidate) keepSetup.current?.focus();
    else if (restoreDeleteFocus.current) {
      restoreDeleteFocus.current = false;
      if (deleteSetup.current && !deleteSetup.current.disabled) deleteSetup.current.focus();
      else savedSetups.current?.focus();
    }
  }, [deleteCandidate]);
  const finishDeleteDecision = () => { restoreDeleteFocus.current = true; setDeleteCandidate(null); };

  return <div className="studio-devices-workspace">
    <p className="studio-eyebrow">MIDI tools</p>
    <h1>Devices</h1>
    <p className="studio-shell-lead">
      Map up to eight named MIDI CC controls for any external synth. NINA is an editable starting template.
      Opening this page and managing setups never sends MIDI; moving an enabled value slider sends only after you choose a live output and channel and select Confirm MIDI route.
    </p>

    {!state.browserSupported && <p role="alert" className="studio-message studio-message-warning">
      Web MIDI is unavailable in this browser. Use a supported secure browser to connect a device.
    </p>}
    {state.status && <p role={state.status.kind === 'error' ? 'alert' : 'status'} className={`studio-message studio-message-${state.status.kind}`}>
      {state.status.message}
    </p>}

    <section className="studio-setup-panel" aria-labelledby="devices-connection-heading">
      <h2 id="devices-connection-heading">Connection</h2>
      <p>MIDI permission is requested only when you choose Enable MIDI.</p>
      <button
        type="button"
        className="studio-button-primary"
        disabled={!state.browserSupported || state.midi.enabled}
        onClick={() => void actions.enableMidi()}
      >
        {state.midi.enabled ? 'MIDI enabled' : 'Enable MIDI'}
      </button>
      <div className="studio-connection-grid">
        <label>Device profile
          <select aria-label="Device profile" value={state.profileId} onChange={event => actions.selectProfile(event.target.value)}>
            <option value={NINA_PROFILE.id}>{NINA_PROFILE.label}</option>
            <option value={CUSTOM_CC_PROFILE_ID}>Custom external synth</option>
          </select>
        </label>
        <label>Synth name
          <input aria-label="Synth name" maxLength={100} value={state.deviceName} onChange={event => actions.setDeviceName(event.target.value)} />
        </label>
        <label>MIDI output
          <select
            aria-label="MIDI output"
            value={state.midi.selectedOutputId ?? ''}
            disabled={!state.midi.enabled}
            onChange={event => actions.selectOutput(event.target.value)}
          >
            <option value="">Choose output</option>
            {state.midi.outputs.map(port => <option key={port.id} value={port.id} disabled={port.state !== 'connected'}>
              {port.name}{port.state !== 'connected' ? ' (disconnected)' : ''}
            </option>)}
          </select>
        </label>
        <label>MIDI input (optional)
          <select
            aria-label="MIDI input (optional)"
            value={state.midi.selectedInputId ?? ''}
            disabled={!state.midi.enabled}
            onChange={event => actions.selectInput(event.target.value)}
          >
            <option value="">No input monitor</option>
            {state.midi.inputs.map(port => <option key={port.id} value={port.id} disabled={port.state !== 'connected'}>
              {port.name}{port.state !== 'connected' ? ' (disconnected)' : ''}
            </option>)}
          </select>
        </label>
        <label>MIDI channel
          <select
            aria-label="MIDI channel"
            value={state.channel ?? ''}
            disabled={!state.output}
            onChange={event => actions.setChannel(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Choose channel</option>
            {Array.from({ length: 16 }, (_, index) => index + 1).map(channel =>
              <option key={channel} value={channel}>{channel}</option>)}
          </select>
        </label>
      </div>
      <div className="studio-action-row"><button type="button" className="studio-button-secondary" disabled={!state.output || state.channel === null || Boolean(state.leaseOwner)} onClick={actions.confirmRoute}>Confirm MIDI route</button><span>{state.routeConfirmed && state.output && state.channel !== null ? 'Route ready for deliberate sends' : 'Choose or review output and channel before sending'}</span></div>
      {state.leaseOwner && <p>{state.leaseOwner === 'autosampling' ? 'Autosampling' : 'Stem capture'} owns {state.output?.name ?? 'this MIDI route'}. Devices controls are disabled until capture releases it.</p>}
    </section>

    <section className="studio-setup-panel" aria-labelledby="devices-values-heading">
      <h2 id="devices-values-heading">Eight CC controls</h2>
      <p>Enable only the controls you need. Labels and CC numbers are editable; no mapping is written to the OP-XY. Number fields are planning state. Once the route is confirmed, a slider gesture sends at a bounded cadence; Send and confirmed Apply remain deliberate actions.</p>
      <div className="studio-cc-grid">
        {state.slots.map((slot, index) => {
          const display = slot.label.trim() || `Slot ${index + 1}`;
          return <article key={slot.id} className="studio-cc-slot" data-slot-enabled={slot.enabled ? 'true' : 'false'}>
            <div className="studio-cc-slot-heading"><h3>{String(index + 1).padStart(2, '0')} / {display}</h3><label><input type="checkbox" aria-label={`Enable CC slot ${index + 1}`} checked={slot.enabled} onChange={event => actions.updateSlot(slot.id, { enabled: event.target.checked })} /> Enabled</label></div>
            <div className="studio-cc-slot-fields"><label>Control label
              <input aria-label={`CC slot ${index + 1} label`} maxLength={40} value={slot.label} onChange={event => actions.updateSlot(slot.id, { label: event.target.value })} />
            </label><label>CC number
              <input type="number" aria-label={`CC slot ${index + 1} number`} min={0} max={127} step={1} value={slot.controller ?? ''} onChange={event => actions.updateSlot(slot.id, { controller: event.target.value === '' ? null : Number(event.target.value) })} />
            </label></div>
            <p>CC {slot.controller ?? '—'} · desired value {slot.value}</p>
            <label>{display} desired value slider
              <input
                type="range"
                aria-label={`${display} desired value slider`}
                min={0}
                max={127}
                step={1}
                value={slot.value}
                onChange={event => void actions.setSlotFromGesture(slot.id, Number(event.target.value))}
              />
            </label>
            <label>{display} desired value
              <input
                type="number"
                aria-label={`${display} desired value`}
                min={0}
                max={127}
                step={1}
                value={slot.value}
                onChange={event => actions.updateSlot(slot.id, { value: Number(event.target.value) })}
              />
            </label>
            <button
              type="button"
              className="studio-button-secondary"
              disabled={!state.canSend || !slot.enabled || slot.controller === null}
              onClick={() => void actions.send(slot.id)}
            >Send {display}</button>
          </article>;
        })}
      </div>

      <div className="studio-action-row">
        <button type="button" className="studio-button-primary" onClick={actions.previewApply}>Preview Apply</button>
      </div>
      {state.applyMessages && <div role="group" aria-label="Apply preview">
        <h3>Review the exact {state.applyMessages.length} messages</h3>
        <p>Destination: {state.applyDestination}</p>
        <ol>{state.applyMessages.map(message => <li key={message.controller}>
          {message.label} — Channel {message.channel} · CC {message.controller} · Value {message.value}
        </li>)}</ol>
        <p>Nothing has been sent yet.</p>
        <div className="studio-action-row">
          <button
            type="button"
            className="studio-button-primary"
            disabled={!state.canSend}
            onClick={() => void actions.confirmApply()}
          >Confirm Apply</button>
          <button type="button" className="studio-button-secondary" onClick={actions.previewApply}>Refresh preview</button>
        </div>
      </div>}
    </section>

    <section className="studio-setup-panel" aria-label="Local setup management">
      <h2 id="devices-setups-heading">Saved setups</h2>
      <p>Saving, loading, importing, renaming, deleting, and exporting are local file or browser-storage actions. They do not send MIDI.</p>
      <fieldset disabled={Boolean(deleteCandidate)} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="studio-setup-fields"><label>Setup name
          <input aria-label="Setup name" value={state.setupName} onChange={event => actions.setSetupName(event.target.value)} />
        </label>
        <label>Saved setups
          <select ref={savedSetups} aria-label="Saved setups" value={state.selectedSetupId} onChange={event => actions.setSelectedSetupId(event.target.value)}>
            <option value="">Choose saved setup</option>
            {state.setups.map(setup => <option key={setup.id} value={setup.id}>{setup.name}</option>)}
          </select>
        </label></div>
      <div className="studio-action-row">
        <button type="button" className="studio-button-primary" onClick={actions.saveSetup}>Save setup</button>
        <button type="button" className="studio-button-secondary" disabled={!state.selectedSetupId} onClick={actions.loadSetup}>Load setup</button>
        <button type="button" className="studio-button-secondary" disabled={!state.selectedSetupId} onClick={actions.renameSetup}>Rename setup</button>
        <button type="button" className="studio-button-secondary" disabled={!state.selectedSetupId} ref={deleteSetup} onClick={() => {
          const selected = state.setups.find(setup => setup.id === state.selectedSetupId);
          if (selected) setDeleteCandidate({id:selected.id,name:selected.name});
        }}>Delete setup</button>
        <button type="button" className="studio-button-secondary" disabled={!state.selectedSetupId} onClick={actions.exportSetup}>Export setup</button>
        <button type="button" className="studio-button-secondary" onClick={() => fileInput.current?.click()}>Import setup</button>
      </div>
      <input
        ref={fileInput}
        className="studio-visually-hidden"
        type="file"
        accept="application/json,.json"
        aria-label="Import setup file"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void actions.importSetup(file);
          event.target.value = '';
        }}
      /></fieldset>
      {deleteCandidate && <div role="group" aria-label="Delete saved setup confirmation" className="studio-message studio-message-warning">
        <p>Delete “{deleteCandidate.name}” from saved setups? This cannot be undone. Current controls stay unchanged.</p>
        <div className="studio-action-row">
          <button ref={keepSetup} type="button" className="studio-button-secondary" onClick={finishDeleteDecision}>Keep setup</button>
          <button type="button" className="studio-button-secondary" disabled={state.selectedSetupId !== deleteCandidate.id || !state.setups.some(setup => setup.id === deleteCandidate.id && setup.name === deleteCandidate.name)} onClick={() => { actions.deleteSetup(); finishDeleteDecision(); }}>Delete saved setup</button>
        </div>
      </div>}
    </section>

    <section className="studio-setup-panel" aria-labelledby="devices-test-heading">
      <h2 id="devices-test-heading">Hardware test</h2>
      <p>Test one enabled CC at value 64 after checking the route and synth settings. This does not verify hardware response automatically.</p>
      <div className="studio-setup-fields"><label>Hardware test control
          <select
            aria-label="Hardware test control"
            value={state.hardwareTestParameter}
            onChange={event => actions.setHardwareTestParameter(event.target.value)}
          >
            {state.slots.filter(slot => slot.enabled).map(slot => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
          </select>
        </label>
        <label>Hardware test value
          <input
            type="number"
            aria-label="Hardware test value"
            min={0}
            max={127}
            step={1}
            value={state.hardwareTestValue}
            onChange={event => actions.setHardwareTestValue(Number(event.target.value))}
          />
        </label></div>
      <p>
        Output: {state.output?.name ?? 'Choose output'} · Channel: {state.channel ?? 'Choose channel'}
        {' '}· CC: {state.slots.find(slot => slot.id === state.hardwareTestParameter)?.controller ?? 'Choose control'} · Value: {state.hardwareTestValue}
      </p>
      <label>
        <input
          type="checkbox"
          checked={state.echoFilterAcknowledged}
          onChange={event => actions.setEchoFilterAcknowledged(event.target.checked)}
        />
        I checked this synth’s MIDI input settings, channel, and feedback/echo behavior before sending
      </label>
      <div className="studio-action-row">
        <button
          type="button"
          className="studio-button-primary"
          disabled={
            !state.canSend
            || !state.echoFilterAcknowledged
            || !state.slots.some(slot => slot.id === state.hardwareTestParameter && slot.enabled && slot.controller !== null)
            || !Number.isInteger(state.hardwareTestValue)
            || state.hardwareTestValue < 0
            || state.hardwareTestValue > 127
          }
          onClick={() => void actions.sendHardwareTest()}
        >Send test</button>
      </div>
      {state.hardwareTestSent && <div role="group" aria-label="Hardware test observation">
        <p>The app cannot verify panel movement automatically.</p>
        {state.hardwareTestReceipt && <p>
          Tested: Output {state.hardwareTestReceipt.outputName} · Channel {state.hardwareTestReceipt.channel}
          {' '}· {state.hardwareTestReceipt.label} · CC {state.hardwareTestReceipt.controller} · Value {state.hardwareTestReceipt.value}
        </p>}
        <p>Record what you observed:</p>
        <div className="studio-action-row">
          {(['Confirmed', 'Not observed', 'Skip'] as const).map(observation =>
            <button type="button" key={observation} onClick={() => actions.setHardwareObservation(observation)}>{observation}</button>)}
        </div>
        {state.hardwareObservation && <p>Local observation: {state.hardwareObservation}</p>}
      </div>}
    </section>

    <section className="studio-setup-panel" aria-labelledby="devices-monitor-heading">
      <h2 id="devices-monitor-heading">MIDI monitor</h2>
      <p>Most recent 100 incoming and outgoing events for this session.</p>
      {state.midi.monitor.length === 0
        ? <p>No MIDI events yet.</p>
        : <ol aria-label="MIDI events">{state.midi.monitor.map((event, index) =>
            <li key={`${event.timestamp}-${event.direction}-${index}`}>{monitorLine(event)}</li>)}</ol>}
    </section>
  </div>;
}
