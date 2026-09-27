import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type BrowserMidiSession,
  type BrowserMidiSessionState,
  type SendCc,
  type SendCcResult,
} from '../../midi/browserSession';
import {
  type CustomDeviceSetup,
  type StoredDeviceSetup,
  type DeviceSetupStore,
  parseDeviceSetup,
  serializeDeviceSetup,
} from '../../midi/deviceSetup';
import { NINA_PROFILE } from '../../midi/ninaProfile';
import {
  buildCcMessage, createCcSlots, CUSTOM_CC_PROFILE_ID, slotsFromLegacyNina,
  validateCcSlots, type CcProfileId, type CcSlot,
} from '../../midi/ccProfile';

export type DevicesMidiSession = Pick<
  BrowserMidiSession,
  'enable' | 'selectOutput' | 'selectInput' | 'sendCc' | 'subscribe' | 'dispose'
>;

export type DevicesSetupStore = Pick<DeviceSetupStore, 'load' | 'save'>;

export type DevicesWorkspaceStatus = {
  kind: 'error' | 'success' | 'info';
  message: string;
};

export type HardwareObservation = 'Confirmed' | 'Not observed' | 'Skip';

type PreparedApply = {
  messages: SendCc[];
  outputId: string;
  outputName: string;
  routeRevision: number;
};

type HardwareTestReceipt = {
  outputId: string;
  outputName: string;
  channel: number;
  controller: number;
  value: number;
  parameter: string;
  label: string;
};

const EMPTY_SESSION_STATE: BrowserMidiSessionState = {
  enabled: false,
  inputs: [],
  outputs: [],
  selectedInputId: undefined,
  selectedOutputId: undefined,
  selectedOutputOwner: undefined,
  monitor: [],
};

const isSupportedByBrowser = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';

const createSetupId = (): string => {
  const generated = globalThis.crypto?.randomUUID?.();
  return generated ? `cc-${generated}` : `cc-${Date.now().toString(36)}`;
};

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : 'An unexpected error occurred.';

const selectedConnectedOutput = (state: BrowserMidiSessionState) =>
  state.outputs.find(port => port.id === state.selectedOutputId && port.state === 'connected');

const optionalHintText = (value: string, maximumLength: number): string | undefined => {
  const normalized = value.trim();
  return normalized && normalized.length <= maximumLength ? normalized : undefined;
};

const outputHintFor = (
  output: NonNullable<ReturnType<typeof selectedConnectedOutput>>,
): StoredDeviceSetup['outputHint'] => {
  const hint = {
    id: optionalHintText(output.id, 256),
    name: optionalHintText(output.name, 100),
    manufacturer: optionalHintText(output.manufacturer, 100),
  };
  const usable = Object.fromEntries(Object.entries(hint).filter((entry): entry is [string, string] => entry[1] !== undefined));
  return Object.keys(usable).length > 0 ? usable : undefined;
};

export type UseDevicesWorkspaceOptions = {
  session: DevicesMidiSession;
  store: DevicesSetupStore;
  supported?: boolean;
};

export function useDevicesWorkspace({ session, store, supported }: UseDevicesWorkspaceOptions) {
  const [midi, setMidi] = useState<BrowserMidiSessionState>(EMPTY_SESSION_STATE);
  const [setups, setSetups] = useState<StoredDeviceSetup[]>([]);
  const [selectedSetupId, setSelectedSetupId] = useState('');
  const [setupName, setSetupName] = useState('');
  const [profileId, setProfileId] = useState<CcProfileId>(NINA_PROFILE.id);
  const [deviceName, setDeviceName] = useState<string>(NINA_PROFILE.label);
  const [channel, setChannelState] = useState<number | null>(null);
  const [routeConfirmed, setRouteConfirmed] = useState(false);
  const [slots, setSlots] = useState<CcSlot[]>(() => createCcSlots(NINA_PROFILE.id));
  const [status, setStatus] = useState<DevicesWorkspaceStatus | null>(null);
  const [preparedApply, setPreparedApply] = useState<PreparedApply | null>(null);
  const [sending, setSending] = useState(false);
  const [echoFilterAcknowledged, setEchoFilterAcknowledged] = useState(false);
  const [hardwareTestReceipt, setHardwareTestReceipt] = useState<HardwareTestReceipt | null>(null);
  const [hardwareObservation, setHardwareObservation] = useState<HardwareObservation | null>(null);
  const [hardwareTestParameter, setHardwareTestParameterState] = useState('cc-3');
  const [hardwareTestValue, setHardwareTestValueState] = useState<number>(NINA_PROFILE.parameters.cutoff.safeTestValue);
  const setupsRef = useRef<StoredDeviceSetup[]>([]);
  const lastMidi = useRef<BrowserMidiSessionState>(EMPTY_SESSION_STATE);
  const expectedOutputChange = useRef<string | null | undefined>(undefined);
  const routeRevision = useRef(0);
  const routeAbort = useRef(new AbortController());
  const hardwareOperation = useRef(0);
  const lifecycle = useRef(0);
  const browserSupported = supported ?? isSupportedByBrowser();

  const invalidatePreparedActions = useCallback(() => {
    hardwareOperation.current += 1;
    setPreparedApply(null);
    setHardwareTestReceipt(null);
    setHardwareObservation(null);
  }, []);

  // Advancing the revision stops any in-flight Apply before its next message and cancels
  // any CC not yet handed to MIDIOutput.send(); an already dispatched CC cannot be recalled.
  const advanceRouteRevision = useCallback(() => {
    routeRevision.current += 1;
    routeAbort.current.abort();
    routeAbort.current = new AbortController();
  }, []);

  const revokeRoute = useCallback(() => {
    advanceRouteRevision();
    setRouteConfirmed(false);
    invalidatePreparedActions();
  }, [advanceRouteRevision, invalidatePreparedActions]);

  useEffect(() => {
    try {
      const loaded = store.load();
      setupsRef.current = loaded;
      setSetups(loaded);
    } catch (reason) {
      setStatus({ kind: 'error', message: `Could not load saved setups: ${errorMessage(reason)}` });
    }
  }, [store]);

  useEffect(() => {
    const token = ++lifecycle.current;
    const lifecycleAtSetup = lifecycle;
    const unsubscribe = session.subscribe(next => {
      const previous = lastMidi.current;
      const previousPort = previous.outputs.find(port => port.id === previous.selectedOutputId);
      const nextPort = next.outputs.find(port => port.id === next.selectedOutputId);
      const routeChanged = previous.selectedOutputId !== next.selectedOutputId
        || previousPort?.state !== nextPort?.state
        || Boolean(previousPort) !== Boolean(nextPort);
      const leaseChanged = previous.selectedOutputOwner !== next.selectedOutputOwner;
      const expected = expectedOutputChange.current;
      const intendedChange = expected !== undefined && (next.selectedOutputId ?? null) === expected;

      if (routeChanged) {
        advanceRouteRevision();
        setRouteConfirmed(false);
        invalidatePreparedActions();
        if (!intendedChange && previous.selectedOutputId && previous.selectedOutputId !== next.selectedOutputId) {
          setStatus({
            kind: 'error',
            message: next.selectedOutputId
              ? 'The selected MIDI output changed. Review the destination and preview again.'
              : 'The selected MIDI output is no longer available. Choose a connected output.',
          });
        } else if (next.selectedOutputId && nextPort?.state !== 'connected') {
          setStatus({ kind: 'error', message: 'The selected MIDI output is disconnected. Reconnect it or choose another output.' });
        }
      }
      if (leaseChanged) {
        advanceRouteRevision();
        invalidatePreparedActions();
      }
      if (intendedChange) expectedOutputChange.current = undefined;
      lastMidi.current = next;
      setMidi(next);
    });

    return () => {
      unsubscribe();
      queueMicrotask(() => {
        if (lifecycleAtSetup.current === token) void session.dispose();
      });
    };
  }, [advanceRouteRevision, invalidatePreparedActions, session]);

  const output = useMemo(() => selectedConnectedOutput(midi), [midi]);
  const validChannel = channel !== null && Number.isInteger(channel) && channel >= 1 && channel <= 16;
  const resolvedChannel = validChannel ? channel : undefined;
  const canSend = browserSupported && midi.enabled && Boolean(output) && resolvedChannel !== undefined
    && routeConfirmed && !midi.selectedOutputOwner && !sending;

  const persist = useCallback((
    update: StoredDeviceSetup[] | ((current: readonly StoredDeviceSetup[]) => StoredDeviceSetup[]),
    success: string,
  ): boolean => {
    try {
      const next = typeof update === 'function' ? update(setupsRef.current) : update;
      store.save(next);
      setupsRef.current = next;
      setSetups(next);
      setStatus({ kind: 'success', message: success });
      return true;
    } catch (reason) {
      setStatus({ kind: 'error', message: `Could not save setups: ${errorMessage(reason)}` });
      return false;
    }
  }, [store]);

  const enableMidi = useCallback(async () => {
    if (!browserSupported) {
      setStatus({ kind: 'error', message: 'Web MIDI is unavailable in this browser.' });
      return;
    }
    setStatus(null);
    try {
      await session.enable();
      setStatus({ kind: 'success', message: 'MIDI access enabled. Choose the intended synth output before sending.' });
    } catch (reason) {
      setStatus({ kind: 'error', message: `Could not enable MIDI: ${errorMessage(reason)}` });
    }
  }, [browserSupported, session]);

  const selectOutput = useCallback((id: string) => {
    if ((lastMidi.current.selectedOutputId ?? '') !== id) setChannelState(null);
    expectedOutputChange.current = id || null;
    setStatus(null);
    revokeRoute();
    session.selectOutput(id || undefined);
  }, [revokeRoute, session]);

  const selectInput = useCallback((id: string) => {
    setStatus(null);
    session.selectInput(id || undefined);
  }, [session]);

  const selectProfile = useCallback((id: string) => {
    if (id !== NINA_PROFILE.id && id !== CUSTOM_CC_PROFILE_ID) return;
    setProfileId(id);
    setDeviceName(id === NINA_PROFILE.id ? NINA_PROFILE.label : 'External synth');
    setSlots(createCcSlots(id));
    setHardwareTestParameterState(id === NINA_PROFILE.id ? 'cc-3' : 'cc-1');
    setHardwareTestValueState(64);
    setSelectedSetupId('');
    revokeRoute();
  }, [revokeRoute]);

  const setChannel = useCallback((next: number | null) => {
    setChannelState(next);
    revokeRoute();
  }, [revokeRoute]);

  const confirmRoute = useCallback(() => {
    if (!selectedConnectedOutput(lastMidi.current) || resolvedChannel === undefined || lastMidi.current.selectedOutputOwner) {
      setStatus({ kind: 'error', message: 'Choose a connected output and MIDI channel before confirming the route.' });
      return;
    }
    setRouteConfirmed(true);
    setStatus({ kind: 'info', message: 'MIDI route confirmed. No CC was sent.' });
  }, [resolvedChannel]);

  const updateSlot = useCallback((id: string, patch: Partial<CcSlot>) => {
    setSlots(current => current.map(slot => slot.id === id ? { ...slot, ...patch } : slot));
    invalidatePreparedActions();
  }, [invalidatePreparedActions]);

  const setSlotFromGesture = useCallback(async (id: string, value: number) => {
    const slot = slots.find(candidate => candidate.id === id);
    if (!slot) return;
    updateSlot(id, { value });
    if (
      !browserSupported
      || !lastMidi.current.enabled
      || !selectedConnectedOutput(lastMidi.current)
      || resolvedChannel === undefined
      || !routeConfirmed
      || lastMidi.current.selectedOutputOwner
      || !slot.enabled
    ) return;
    try {
      validateCcSlots(slots.map(candidate => candidate.id === id ? { ...candidate, value } : candidate));
      const result = await session.sendCc(
        buildCcMessage({ ...slot, value }, resolvedChannel),
        { signal: routeAbort.current.signal },
      );
      if (!result.ok && !result.error.includes('replaced this unsent value')) {
        setStatus({ kind: 'error', message: result.error });
      }
    } catch (reason) {
      setStatus({ kind: 'error', message: errorMessage(reason) });
    }
  }, [browserSupported, resolvedChannel, routeConfirmed, session, slots, updateSlot]);

  const performSend = useCallback(async (message: SendCc): Promise<SendCcResult> => {
    setSending(true);
    try {
      const result = await session.sendCc(message, { signal: routeAbort.current.signal });
      if (!result.ok) setStatus({ kind: 'error', message: result.error });
      return result;
    } finally {
      setSending(false);
    }
  }, [session]);

  const send = useCallback(async (id: string) => {
    if (!canSend || resolvedChannel === undefined) return;
    try {
      validateCcSlots(slots);
      const slot = slots.find(candidate => candidate.id === id);
      if (!slot) return;
      const message = buildCcMessage(slot, resolvedChannel);
      const result = await performSend(message);
      if (result.ok) setStatus({ kind: 'success', message: `${message.label} sent as a deliberate MIDI CC action.` });
    } catch (reason) {
      setStatus({ kind: 'error', message: errorMessage(reason) });
    }
  }, [canSend, performSend, resolvedChannel, slots]);

  const previewApply = useCallback(() => {
    try {
      const validSlots = validateCcSlots(slots);
      const active = validSlots.filter(slot => slot.enabled);
      if (resolvedChannel === undefined || !output || !routeConfirmed || midi.selectedOutputOwner || active.length === 0) {
        throw new Error('Choose a connected output, channel 1–16, and at least one valid enabled CC control.');
      }
      setPreparedApply({
        messages: active.map(slot => buildCcMessage(slot, resolvedChannel)),
        outputId: output.id,
        outputName: output.name || 'Unnamed MIDI port',
        routeRevision: routeRevision.current,
      });
      setStatus({ kind: 'info', message: `Review all ${active.length} MIDI messages. Nothing has been sent.` });
    } catch (reason) {
      setPreparedApply(null);
      setStatus({ kind: 'error', message: errorMessage(reason) });
    }
  }, [midi.selectedOutputOwner, output, resolvedChannel, routeConfirmed, slots]);

  const confirmApply = useCallback(async () => {
    if (!canSend || !preparedApply) return;
    const destinationMatches = () =>
      routeRevision.current === preparedApply.routeRevision
      && selectedConnectedOutput(lastMidi.current)?.id === preparedApply.outputId;
    if (!destinationMatches()) {
      setPreparedApply(null);
      setStatus({ kind: 'error', message: 'Apply destination changed. Preview the messages again.' });
      return;
    }
    setSending(true);
    try {
      for (const message of preparedApply.messages) {
        if (!destinationMatches()) {
          setPreparedApply(null);
          setStatus({ kind: 'error', message: 'Apply stopped because the MIDI route changed.' });
          return;
        }
        const result = await session.sendCc(message, { signal: routeAbort.current.signal });
        if (!result.ok) {
          setStatus({ kind: 'error', message: `Apply stopped: ${result.error}` });
          return;
        }
      }
      setPreparedApply(null);
      setStatus({ kind: 'success', message: `Applied the ${preparedApply.messages.length} reviewed desired values.` });
    } finally {
      setSending(false);
    }
  }, [canSend, preparedApply, session]);

  const saveSetup = useCallback(() => {
    const name = setupName.trim();
    if (!name) {
      setStatus({ kind: 'error', message: 'Enter a setup name before saving.' });
      return;
    }
    if (resolvedChannel === undefined) {
      setStatus({ kind: 'error', message: 'Choose channel 1–16 before saving.' });
      return;
    }
    let validSlots: CcSlot[];
    try {
      validSlots = validateCcSlots(slots);
      if (!validSlots.some(slot => slot.enabled)) throw new Error('Enable at least one CC control before saving.');
    } catch (reason) {
      setStatus({ kind: 'error', message: errorMessage(reason) });
      return;
    }
    const normalizedDeviceName = deviceName.trim();
    if (!normalizedDeviceName || normalizedDeviceName.length > 100) {
      setStatus({ kind: 'error', message: 'Enter a synth name of at most 100 characters.' });
      return;
    }
    const now = new Date().toISOString();
    const currentSetups = setupsRef.current;
    const existing = currentSetups.find(setup => setup.id === selectedSetupId);
    const outputHint = output ? outputHintFor(output) : undefined;
    const nextSetup: CustomDeviceSetup = {
      schemaVersion: 2,
      profileId,
      id: existing?.id ?? createSetupId(),
      name,
      deviceName: normalizedDeviceName,
      channel: resolvedChannel,
      slots: validSlots,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(outputHint ? { outputHint } : {}),
    };
    const next = existing
      ? currentSetups.map(setup => setup.id === existing.id ? nextSetup : setup)
      : [...currentSetups, nextSetup];
    if (persist(next, existing ? 'Setup updated locally.' : 'Setup saved locally.')) {
      setSelectedSetupId(nextSetup.id);
    }
  }, [deviceName, output, persist, profileId, resolvedChannel, selectedSetupId, setupName, slots]);

  const loadSetup = useCallback(() => {
    const setup = setups.find(candidate => candidate.id === selectedSetupId);
    if (!setup) {
      setStatus({ kind: 'error', message: 'Choose a saved setup to load.' });
      return;
    }
    setSetupName(setup.name);
    setChannelState(setup.channel);
    setProfileId(setup.profileId);
    setDeviceName(setup.schemaVersion === 1 ? NINA_PROFILE.label : setup.deviceName);
    setSlots(setup.schemaVersion === 1 ? slotsFromLegacyNina(setup.desired) : setup.slots.map(slot => ({ ...slot })));
    setHardwareTestParameterState(setup.profileId === NINA_PROFILE.id ? 'cc-3' : 'cc-1');
    setHardwareTestValueState(64);
    revokeRoute();
    setStatus({
      kind: 'info',
      message: setup.outputHint?.name
        ? `Loaded desired values. Confirm the MIDI output; saved hint: ${setup.outputHint.name}. Nothing was sent.`
        : 'Loaded desired values. Nothing was sent.',
    });
  }, [revokeRoute, selectedSetupId, setups]);

  const renameSetup = useCallback(() => {
    const name = setupName.trim();
    const currentSetups = setupsRef.current;
    const selected = currentSetups.find(setup => setup.id === selectedSetupId);
    if (!selected || !name) {
      setStatus({ kind: 'error', message: 'Choose a saved setup and enter a nonblank name.' });
      return;
    }
    const next = currentSetups.map(setup => setup.id === selected.id
      ? { ...setup, name, updatedAt: new Date().toISOString() }
      : setup);
    persist(next, 'Setup renamed locally.');
  }, [persist, selectedSetupId, setupName]);

  const deleteSetup = useCallback(() => {
    const currentSetups = setupsRef.current;
    const selected = currentSetups.find(setup => setup.id === selectedSetupId);
    if (!selected) {
      setStatus({ kind: 'error', message: 'Choose a saved setup to delete.' });
      return;
    }
    const next = currentSetups.filter(setup => setup.id !== selected.id);
    if (persist(next, 'Setup deleted locally.')) {
      setSelectedSetupId('');
      setSetupName('');
    }
  }, [persist, selectedSetupId]);

  const importSetup = useCallback(async (file: File) => {
    try {
      const imported = parseDeviceSetup(await file.text());
      if (persist(current => current.some(setup => setup.id === imported.id)
        ? current.map(setup => setup.id === imported.id ? imported : setup)
        : [...current, imported], 'Setup imported locally.')) {
        setSelectedSetupId(imported.id);
      }
    } catch (reason) {
      setStatus({ kind: 'error', message: `Could not import setup: ${errorMessage(reason)}` });
    }
  }, [persist]);

  const exportSetup = useCallback(() => {
    const setup = setups.find(candidate => candidate.id === selectedSetupId);
    if (!setup) {
      setStatus({ kind: 'error', message: 'Choose a saved setup to export.' });
      return;
    }
    try {
      const blob = new Blob([serializeDeviceSetup(setup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${setup.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'cc-setup'}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: 'success', message: 'Setup export downloaded.' });
    } catch (reason) {
      setStatus({ kind: 'error', message: `Could not export setup: ${errorMessage(reason)}` });
    }
  }, [selectedSetupId, setups]);

  const sendHardwareTest = useCallback(async () => {
    if (!canSend || !echoFilterAcknowledged || !output || resolvedChannel === undefined) return;
    try {
      validateCcSlots(slots);
    } catch (reason) {
      setStatus({ kind: 'error', message: errorMessage(reason) });
      return;
    }
    const slot = slots.find(candidate => candidate.id === hardwareTestParameter);
    if (!slot || !slot.enabled || slot.controller === null) {
      setStatus({ kind: 'error', message: 'Choose an enabled CC control for the hardware test.' });
      return;
    }
    if (!Number.isInteger(hardwareTestValue) || hardwareTestValue < 0 || hardwareTestValue > 127) {
      setStatus({ kind: 'error', message: `${slot.label} test value must be a whole number from 0 to 127.` });
      return;
    }
    const operation = ++hardwareOperation.current;
    const identity: HardwareTestReceipt = {
      outputId: output.id,
      outputName: output.name || 'Unnamed MIDI port',
      channel: resolvedChannel,
      controller: slot.controller,
      value: hardwareTestValue,
      parameter: hardwareTestParameter,
      label: slot.label,
    };
    setHardwareTestReceipt(null);
    setHardwareObservation(null);
    const result = await performSend({
      channel: identity.channel,
      controller: identity.controller,
      value: identity.value,
      label: `${identity.label} hardware test`,
    });
    if (
      result.ok
      && hardwareOperation.current === operation
      && selectedConnectedOutput(lastMidi.current)?.id === identity.outputId
    ) {
      setHardwareTestReceipt(identity);
      setStatus({ kind: 'info', message: 'Test message sent. Record only what you observe locally.' });
    }
  }, [canSend, echoFilterAcknowledged, hardwareTestParameter, hardwareTestValue, output, performSend, resolvedChannel, slots]);

  const setHardwareTestParameter = useCallback((parameter: string) => {
    if (!slots.some(slot => slot.id === parameter && slot.enabled)) return;
    setHardwareTestParameterState(parameter);
    invalidatePreparedActions();
  }, [invalidatePreparedActions, slots]);

  const setHardwareTestValue = useCallback((value: number) => {
    setHardwareTestValueState(value);
    invalidatePreparedActions();
  }, [invalidatePreparedActions]);

  return {
    state: {
      browserSupported,
      midi,
      setups,
      selectedSetupId,
      setupName,
      profileId,
      deviceName,
      channel,
      routeConfirmed,
      slots,
      status,
      applyMessages: preparedApply?.messages ?? null,
      applyDestination: preparedApply?.outputName ?? null,
      sending,
      echoFilterAcknowledged,
      hardwareTestSent: Boolean(hardwareTestReceipt),
      hardwareTestReceipt,
      hardwareObservation,
      hardwareTestParameter,
      hardwareTestValue,
      output,
      canSend,
      leaseOwner: midi.selectedOutputOwner,
    },
    actions: {
      enableMidi,
      selectOutput,
      selectInput,
      selectProfile,
      setDeviceName,
      setChannel,
      confirmRoute,
      updateSlot,
      setSlotFromGesture,
      send,
      previewApply,
      confirmApply,
      setSelectedSetupId,
      setSetupName,
      saveSetup,
      loadSetup,
      renameSetup,
      deleteSetup,
      importSetup,
      exportSetup,
      setEchoFilterAcknowledged,
      setHardwareTestParameter,
      setHardwareTestValue,
      sendHardwareTest,
      setHardwareObservation,
    },
  };
}
