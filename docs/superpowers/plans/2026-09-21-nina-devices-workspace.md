# NINA Devices Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a NINA-first Devices workspace that sends a deliberately chosen, validated CC message to exactly one selected MIDI output and stores only computer-side setups.

**Architecture:** Keep Web MIDI transport in a small framework-neutral native browser service, with a separate route-lease registry shared by Devices, autosampling, and OP-XY stem capture. Keep NINA’s CC map and setup parsing pure and typed; the React workspace consumes those interfaces and persists only its own versioned local-storage record. No device state is inferred from input monitoring or a saved port ID.

**Tech Stack:** React 19, TypeScript 5.8, Vite, native Web MIDI API, existing WebMidi.js capture paths, Vitest + Testing Library, Playwright.

**Spec:** `/Users/stevencommander/Documents/ChatGPT/OPXY/outputs/patchstudio-devices-design-2026-09-21.md`

## Global Constraints

- Work only in an explicitly authorized isolated feature worktree; preserve the completed hardening worktree and do not commit, merge, push, deploy, install dependencies, or alter a physical device without separate authorization.
- Chromium in a secure context is the supported browser target. Request MIDI only after the user clicks **Enable MIDI**, always with `{ sysex: false }`.
- Devices sends only validated channel-voice CC messages to one explicit, connected selected output. Never broadcast, infer a destination, send while loading/saving/importing, or silently retarget after a reconnect.
- Scope is NINA CC 7, 28, 29, and 30 on a user-selected layer channel 1–16. Do not add SysEx, OP-XY writable settings, Moonwind, profiles from third parties, a desktop wrapper, or a backend.
- NINA inbound MIDI is observational only: never relay it to an output. The physical check requires the user to set NINA MIDI Echo Filter to **Echo Filter**, not **Filter All**, before sending.
- Devices preferences, drafts, setup documents, monitor history, and hardware-check notes are separate from AppContext recovery, project, library, preset, and audio serialization.
- Capture owns a selected route while it is running; Devices cannot steal that lease. A capture start wins after a currently queued bounded Devices message finishes.
- Treat the current hardening acceptance report as a baseline only after its 51-file manifest has been rechecked. Do not use stale historical test counts as current proof.

## Review Focus

- A stale saved output ID must be shown as unresolved and produce no send; cover in Task 2 and Task 5.
- Channel one must encode as status `0xB0`, channel sixteen as `0xBF`, and every NINA controller must use its documented byte; cover in Tasks 2 and 3.
- A rapid slider gesture must coalesce to its final desired value without creating a broadcast or a stuck queued send; cover in Tasks 2 and 5.
- A malformed or forward-version setup import must leave the active draft and persisted setup untouched; cover in Task 4 and Task 5.
- Devices must stay locked for the whole autosampling/stem lifecycle, including error, cancel, unmount, and disconnected output; cover in Tasks 1 and 6.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/midi/routeLease.ts` | In-memory, output-ID keyed cooperative ownership with idempotent release. |
| `src/midi/browserSession.ts` | Explicit native Web MIDI enablement, port snapshots, selected-port validation, bounded monitor events, and selected-output-only send queue. |
| `src/midi/ninaProfile.ts` | Static, versioned NINA CC metadata and pure CC byte validation. |
| `src/midi/deviceSetup.ts` | Versioned computer-side setup schema, strict parse/serialize, and separate storage adapter. |
| `src/components/devices/DevicesWorkspace.tsx` | Profile selection, connection UI, NINA controls, setup actions, monitor, and human check card. |
| `src/components/devices/useDevicesWorkspace.ts` | React lifecycle adapter around session, setup storage, slider coalescing, and display state. |
| `src/components/common/StudioShell.tsx` | Adds Devices as a top-level tool without changing editor/recovery behavior. |
| `src/components/common/AutoSamplingPanel.tsx` | Acquires/releases a route lease around the already-selected capture output. |
| `src/components/common/StemRecordingModal.tsx` | Acquires/releases the same lease around the already-selected stem output. |
| `src/test/midi/*.test.ts` | Unit tests for lease, session, profile, and setup boundaries. |
| `src/test/components/DevicesWorkspace.test.tsx` | User-facing safety and no-send behavior. |
| `tests/e2e/devices-workspace.spec.ts` | Chromium navigation and simulated MIDI workflow. |

### Task 1: Output Route Lease

**Files:**
- Create: `src/midi/routeLease.ts`
- Test: `src/test/midi/routeLease.test.ts`

**Interfaces:**
- Produces: `RouteLeaseRegistry`, `RouteLease`, `RouteOwner`, `acquire(outputId, owner): RouteLease | undefined`, `current(outputId): RouteOwner | undefined`.
- Consumes: no browser or React APIs.

- [ ] **Step 1: Write the failing lease tests**

```ts
import { RouteLeaseRegistry } from '../../midi/routeLease';

it('allows one owner and makes release idempotent', () => {
  const routes = new RouteLeaseRegistry();
  const lease = routes.acquire('nina-usb', 'devices');
  expect(lease?.owner).toBe('devices');
  expect(routes.acquire('nina-usb', 'autosampling')).toBeUndefined();
  lease?.release(); lease?.release();
  expect(routes.acquire('nina-usb', 'autosampling')?.owner).toBe('autosampling');
});

it('does not release a newer owner through a stale lease', () => {
  const routes = new RouteLeaseRegistry();
  const first = routes.acquire('nina-usb', 'devices')!;
  first.release();
  const second = routes.acquire('nina-usb', 'stem-capture')!;
  first.release();
  expect(routes.current('nina-usb')).toBe('stem-capture');
  second.release();
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/test/midi/routeLease.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the smallest ownership registry**

```ts
export type RouteOwner = 'devices' | 'autosampling' | 'stem-capture';
export interface RouteLease { readonly outputId: string; readonly owner: RouteOwner; release(): void; }

export class RouteLeaseRegistry {
  private readonly owners = new Map<string, { owner: RouteOwner; token: symbol }>();
  current(outputId: string) { return this.owners.get(outputId)?.owner; }
  acquire(outputId: string, owner: RouteOwner): RouteLease | undefined {
    if (!outputId || this.owners.has(outputId)) return undefined;
    const token = Symbol(owner); this.owners.set(outputId, { owner, token });
    return { outputId, owner, release: () => { if (this.owners.get(outputId)?.token === token) this.owners.delete(outputId); } };
  }
}
export const midiRoutes = new RouteLeaseRegistry();
```

- [ ] **Step 4: Verify focused tests pass**

Run: `npm test -- src/test/midi/routeLease.test.ts`

Expected: PASS; specifically includes stale-release and idempotent-release cases.

- [ ] **Step 5: Leave an integration checkpoint**

Record the exact test command/output and changed paths in the feature handoff; do not commit unless the integration owner separately authorizes it.

### Task 2: Explicit Browser MIDI Session

**Files:**
- Create: `src/midi/browserSession.ts`
- Test: `src/test/midi/browserSession.test.ts`

**Interfaces:**
- Consumes: `RouteLeaseRegistry` from Task 1.
- Produces: `BrowserMidiSession`, `MidiPortSummary`, `MidiMonitorEvent`, `enable()`, `selectOutput(id)`, `selectInput(id)`, `sendCc({ channel, controller, value, label })`, `subscribe(listener)`, and `dispose()`.

- [ ] **Step 1: Write failing session tests using a native MIDIAccess double**

```ts
it('requests non-SysEx access only after enable and targets one selected port', async () => {
  const outputA = fakeOutput('nina'); const outputB = fakeOutput('other');
  const request = vi.fn().mockResolvedValue(fakeAccess([], [outputA, outputB]));
  const session = new BrowserMidiSession({ requestAccess: request, routes: new RouteLeaseRegistry() });
  expect(request).not.toHaveBeenCalled();
  await session.enable(); session.selectOutput('nina');
  await session.sendCc({ channel: 1, controller: 29, value: 64, label: 'Cutoff' });
  expect(request).toHaveBeenCalledWith({ sysex: false });
  expect(outputA.send).toHaveBeenCalledWith([0xB0, 29, 64]);
  expect(outputB.send).not.toHaveBeenCalled();
});

it('rejects missing, disconnected, leased, and invalid CC sends without output bytes', async () => {
  // Assert each failure returns a visible result/error and send has not been called.
});

it('cleans selected-input listeners and never relays received bytes', async () => {
  // Select input A then B, emit a message on both, and assert only B is monitored and no output send occurs.
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/test/midi/browserSession.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement native session lifecycle and selected-port send boundary**

```ts
export type MidiPortSummary = { id: string; name: string; manufacturer: string; state: 'connected' | 'disconnected' };
export type SendCc = { channel: number; controller: number; value: number; label: string };

async sendCc(message: SendCc): Promise<{ ok: true; bytes: [number, number, number] } | { ok: false; error: string }> {
  if (!Number.isInteger(message.channel) || message.channel < 1 || message.channel > 16) return { ok: false, error: 'Choose a MIDI channel from 1 to 16.' };
  if (![message.controller, message.value].every(value => Number.isInteger(value) && value >= 0 && value <= 127)) return { ok: false, error: 'MIDI CC values must be whole numbers from 0 to 127.' };
  const output = this.selectedConnectedOutput();
  if (!output) return { ok: false, error: 'Choose a connected MIDI output.' };
  if (this.routes.current(output.id)) return { ok: false, error: 'This MIDI output is busy with capture.' };
  const bytes: [number, number, number] = [0xB0 | (message.channel - 1), message.controller, message.value];
  output.send(bytes); this.recordOutgoing(output, bytes, message); return { ok: true, bytes };
}
```

The implementation must: request `{ sysex:false }`; use `MIDIAccess.onstatechange` or an add/remove listener; clear a stale selection when its exact ID disappears; open/close selected ports where supported; bound monitor history to 100 events; attach at most one input `midimessage` listener; serialize slider sends so a later queued value replaces an earlier unsent value; and release all listeners/ports on `dispose()`.

- [ ] **Step 4: Verify all session behavior**

Run: `npm test -- src/test/midi/browserSession.test.ts src/test/midi/routeLease.test.ts`

Expected: PASS, including no pre-enable request, one-output only, channel edges, input cleanup, stale port, disconnect, lease denial, and final-value coalescing.

- [ ] **Step 5: Leave an integration checkpoint**

Record the test output and ensure no test imports `useWebMidi` for Devices sends.

### Task 3: Static NINA Profile and CC Encoding

**Files:**
- Create: `src/midi/ninaProfile.ts`
- Test: `src/test/midi/ninaProfile.test.ts`

**Interfaces:**
- Consumes: no UI/browser APIs.
- Produces: `NINA_PROFILE`, `NinaParameterId`, `NinaDesiredValues`, `validateNinaValues(values)`, `buildNinaCc(parameter, channel, value)`.

- [ ] **Step 1: Write the failing profile tests**

```ts
import { buildNinaCc, NINA_PROFILE } from '../../midi/ninaProfile';

it.each([
  ['patch-volume', 7], ['resonance', 28], ['cutoff', 29], ['drive', 30],
] as const)('encodes documented NINA %s CC', (id, controller) => {
  expect(buildNinaCc(id, 16, 127)).toEqual({ channel: 16, controller, value: 127, label: NINA_PROFILE.parameters[id].label });
});

it('rejects an unknown parameter, non-integer value, and channel outside 1 to 16', () => {
  expect(() => buildNinaCc('cutoff', 0, 64)).toThrow(/1 to 16/);
  expect(() => buildNinaCc('cutoff', 1, 128)).toThrow(/0 to 127/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/test/midi/ninaProfile.test.ts`

Expected: FAIL because the profile module does not exist.

- [ ] **Step 3: Implement immutable v1 profile metadata**

```ts
export const NINA_PROFILE = {
  id: 'melbourne-instruments-nina', version: 1, label: 'Melbourne Instruments NINA',
  parameters: {
    'patch-volume': { label: 'Patch Volume', controller: 7, min: 0, max: 127 },
    resonance: { label: 'Resonance', controller: 28, min: 0, max: 127 },
    cutoff: { label: 'Cutoff', controller: 29, min: 0, max: 127, safeTestValue: 64 },
    drive: { label: 'Drive', controller: 30, min: 0, max: 127 },
  },
} as const;
```

Keep profile source references and verification state as display metadata. Do not represent NRPN, RPN, SysEx, or arbitrary controller entry.

- [ ] **Step 4: Verify the profile test passes**

Run: `npm test -- src/test/midi/ninaProfile.test.ts`

Expected: PASS for all four controllers, all byte-range errors, and default Cutoff test value 64.

- [ ] **Step 5: Leave an integration checkpoint**

Record a direct mapping table (label, CC, allowed range) in the feature handoff for reviewer comparison with the NINA manual.

### Task 4: Separate, Strict Computer-Side Setups

**Files:**
- Create: `src/midi/deviceSetup.ts`
- Test: `src/test/midi/deviceSetup.test.ts`

**Interfaces:**
- Consumes: `NINA_PROFILE` and `NinaDesiredValues` from Task 3.
- Produces: `DeviceSetup`, `parseDeviceSetup(json)`, `serializeDeviceSetup(setup)`, `DeviceSetupStore.load()`, `DeviceSetupStore.save(setups)`.

- [ ] **Step 1: Write failing parser and storage-isolation tests**

```ts
it('accepts only the exact v1 NINA computer-side setup shape', () => {
  const setup = parseDeviceSetup(JSON.stringify(validNinaSetup));
  expect(setup.outputHint).toEqual({ id: 'old-id', name: 'NINA MIDI' });
  expect(setup.desired.cutoff).toBe(64);
});

it.each([
  { ...validNinaSetup, schemaVersion: 2 },
  { ...validNinaSetup, desired: { ...validNinaSetup.desired, cutoff: 128 } },
  { ...validNinaSetup, extra: 'not allowed' },
])('rejects invalid setup without replacing existing stored setups', (input) => {
  const storage = memoryStorageWith([validNinaSetup]);
  expect(() => parseDeviceSetup(JSON.stringify(input))).toThrow();
  expect(new DeviceSetupStore(storage).load()).toEqual([validNinaSetup]);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/test/midi/deviceSetup.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement closed-world schema and storage adapter**

```ts
export const DEVICE_SETUP_STORAGE_KEY = 'op-patchstudio.devices.setups.v1';
export type DeviceSetup = {
  schemaVersion: 1; profileId: typeof NINA_PROFILE.id; profileVersion: 1;
  id: string; name: string; outputHint?: { id?: string; name?: string; manufacturer?: string };
  channel: number; desired: NinaDesiredValues; createdAt: string; updatedAt: string;
};
```

Reject missing, unknown, or extra fields; validate ISO timestamps, nonblank bounded names, channel 1–16, exact desired keys, and every 0–127 desired value. `import` parses before mutating React state or calling storage. The adapter may use only the key above and must not import AppContext, project serializers, library helpers, or audio types.

- [ ] **Step 4: Verify setup safety**

Run: `npm test -- src/test/midi/deviceSetup.test.ts src/test/midi/ninaProfile.test.ts`

Expected: PASS for round trip, export stability, malformed JSON, forward schema, unknown field, range error, storage exception, and unchanged active setup after failed import.

- [ ] **Step 5: Leave an integration checkpoint**

Inspect the storage key in the implementation and record that it is distinct from recovery/library/project keys.

### Task 5: Devices Workspace UI

**Files:**
- Create: `src/components/devices/useDevicesWorkspace.ts`
- Create: `src/components/devices/DevicesWorkspace.tsx`
- Create: `src/test/components/DevicesWorkspace.test.tsx`
- Modify: `src/components/common/StudioShell.tsx`

**Interfaces:**
- Consumes: session from Task 2, NINA profile from Task 3, and setup store from Task 4.
- Produces: a standalone `<DevicesWorkspace />` and a `Devices` StudioShell destination; it does not modify `AppContext`.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it('does not request MIDI or send while entering, saving, importing, or loading a setup', async () => {
  render(<DevicesWorkspace session={fakeSession()} store={memoryStore()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Save setup' }));
  await userEvent.click(screen.getByRole('button', { name: 'Import setup' }));
  expect(fakeSession().enable).not.toHaveBeenCalled();
  expect(fakeSession().sendCc).not.toHaveBeenCalled();
});

it('requires enable, output, channel, and deliberate send before emitting Cutoff', async () => {
  // Enable; select only NINA; choose channel 2; set 64; click Send Cutoff.
  expect(session.sendCc).toHaveBeenCalledWith(expect.objectContaining({ channel: 2, controller: 29, value: 64 }));
});

it('shows a capture lease explanation and emits no byte while the route is owned', async () => {
  // Route registry is seeded with autosampling ownership for selected output.
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/test/components/DevicesWorkspace.test.tsx`

Expected: FAIL because the workspace does not exist.

- [ ] **Step 3: Implement conservative UI state and explicit actions**

```tsx
<button type="button" onClick={() => void actions.enableMidi()}>Enable MIDI</button>
<select aria-label="MIDI output" value={state.outputId ?? ''} onChange={event => actions.selectOutput(event.target.value)}>
  <option value="">Choose output</option>
  {state.outputs.map(port => <option key={port.id} value={port.id}>{port.name}</option>)}
</select>
<button type="button" disabled={!state.canSend} onClick={() => void actions.send('cutoff')}>Send Cutoff</button>
```

Render: an unsupported-browser state; NINA as the only enabled profile; output and optional input selectors; channel 1–16; desired-value sliders/number inputs; a 100-event outgoing/incoming monitor; named save/export/import/apply actions; and a hardware-test card. Label values as **computer-side desired values**. `Apply` must first show the exact four messages and require a second explicit confirmation before sequential sends. Loading, selecting, importing, saving, renaming, deleting, changing profile, or changing a port must never invoke `sendCc`.

For the hardware card, default to Cutoff/64, show output/channel/CC/value before `Send test`, then only record **Confirmed**, **Not observed**, or **Skip** after the send result. Put the Echo Filter confirmation before the first enabled `Send test`. No action may say it verified panel movement automatically.

Add Devices to the StudioShell tools navigation. It must mount independently of editor `MainTabs` and never dispatch a recovery/project action.

- [ ] **Step 4: Verify UI behavior**

Run: `npm test -- src/test/components/DevicesWorkspace.test.tsx src/test/midi/browserSession.test.ts src/test/midi/deviceSetup.test.ts`

Expected: PASS for no-send paths, deliberate send, unavailable browser, stale selection, exact monitor content, import failure preservation, lease lock, and unmount disposal.

- [ ] **Step 5: Leave an integration checkpoint**

Open the workspace in a development browser with no hardware attached. Confirm the initial page is a no-permission, no-send state and the Devices route can be exited without affecting the existing editor.

### Task 6: Capture and Stem Route Ownership Adapters

**Files:**
- Modify: `src/components/common/AutoSamplingPanel.tsx`
- Modify: `src/components/common/StemRecordingModal.tsx`
- Modify: `src/test/components/AutoSamplingPanel.test.tsx`
- Modify: `src/test/components/StemRecordingModal.test.tsx`

**Interfaces:**
- Consumes: singleton `midiRoutes` from Task 1.
- Produces: capture/stem runs that own their already-selected output from just before MIDI activity through every completion path.

- [ ] **Step 1: Write failing lifecycle tests**

```tsx
it('holds autosampling output ownership until cancel cleanup completes', async () => {
  // Start with output 'virtual'; assert midiRoutes.current('virtual') is autosampling.
  // Trigger cancel with deferred dispose; assert Devices cannot acquire until dispose resolves.
});

it('releases the stem route after run rejection and after disconnect', async () => {
  // Force StemCaptureEngine.run rejection and port disconnect; assert current(outputId) becomes undefined.
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `npm test -- src/test/components/AutoSamplingPanel.test.tsx src/test/components/StemRecordingModal.test.tsx`

Expected: FAIL because neither capture path owns a shared lease.

- [ ] **Step 3: Acquire before activity and release in every terminal branch**

```ts
const lease = midiRoutes.acquire(outputId, 'autosampling');
if (!lease) throw new Error('This MIDI output is busy with Devices or track capture.');
try {
  await sampler.run(settings, audioDeviceId, onlyNote);
} finally {
  lease.release();
}
```

Use the same pattern for `stem-capture`. Keep the existing `WebMidi` and native stem send implementations otherwise unchanged. Acquire only after output validation and before `AutoSampler`/`StemCaptureEngine` can emit a byte. Retain the lease through cancel, error, disconnect, visibility shutdown, and component unmount until the existing asynchronous cleanup finishes. Do not make Devices take a long-lived lease merely because its page is open.

- [ ] **Step 4: Verify existing capture behavior plus ownership**

Run: `npm test -- src/test/components/AutoSamplingPanel.test.tsx src/test/components/StemRecordingModal.test.tsx src/test/audio/recording/stemCapture.test.ts`

Expected: PASS with existing MIDI send expectations unchanged and new lease release checks passing.

- [ ] **Step 5: Leave an integration checkpoint**

Manually exercise a synthetic capture and synthetic stem run in the test harness; record that a Devices send is denied only while the same output route is owned.

### Task 7: Chromium Workflow Coverage and Hardware Acceptance Packet

**Files:**
- Create: `tests/e2e/devices-workspace.spec.ts`
- Create: `docs/verification/nina-devices-hardware-acceptance.md`
- Modify: `README.md` only if the existing supported-browser section needs a one-sentence Devices note.

**Interfaces:**
- Consumes: the completed UI and test doubles from Tasks 1–6.
- Produces: reproducible Chromium behavior coverage and a human-only NINA evidence packet.

- [ ] **Step 1: Write the failing browser workflow**

```ts
test('Devices is no-send until explicit enable/select/action and rejects stale output', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Devices' }).click();
  await expect(page.getByText('Enable MIDI')).toBeVisible();
  await expect(page.getByTestId('midi-send-count')).toHaveText('0');
  // Inject deterministic fake MIDI before Enable, select NINA, use channel 16, send Cutoff 64.
  await expect(page.getByTestId('midi-last-bytes')).toHaveText('191,29,64');
  // Remove selected port, refresh, then assert send count is unchanged and UI requires a new selection.
});
```

- [ ] **Step 2: Run the focused browser test and confirm it fails**

Run: `npx playwright test tests/e2e/devices-workspace.spec.ts --project=chromium`

Expected: FAIL because the route and workflow do not yet exist.

- [ ] **Step 3: Implement deterministic test-only MIDI injection and the acceptance packet**

Keep the browser fake behind the existing Playwright test setup, never in production code. Cover navigation, no permission on mount, no output on setup import/load/save, exact single-output CC bytes, locked output, stale disconnect, and monitor observability. Write the hardware packet with these checkboxes: selected NINA output; actual layer channel; Echo Filter is **Echo Filter**; test Cutoff 64 then Resonance/Drive/Patch Volume; verify no second connected device changes; verify capture locks/unlocks same route; verify disconnect/reconnect cannot retarget. Include fields for firmware, browser/version, timestamp, output name, result, and user-observed outcome.

- [ ] **Step 4: Verify workflow coverage**

Run: `npx playwright test tests/e2e/devices-workspace.spec.ts --project=chromium`

Expected: PASS with all fake-output bytes and no-send states asserted.

- [ ] **Step 5: Leave an acceptance checkpoint**

Do not mark NINA hardware-accepted until the user runs and records every hardware checkbox. A passing fake browser test is not physical-device proof.

### Task 8: Evidence-Graph Review and Release Gate

**Files:**
- Create: `docs/verification/nina-devices-release-evidence.md`

**Interfaces:**
- Consumes: test outputs, manifest comparison, review findings, and the human hardware packet.
- Produces: a traceable PASS/FAIL/NOT-RUN release record; it makes no runtime changes.

- [ ] **Step 1: Recheck baseline integrity before full verification**

Run: the existing Node SHA-256 check against `/Users/stevencommander/Documents/ChatGPT/OPXY/outputs/hardening-review-2026-09-21/evidence/implementation-changes.json`, followed by `git diff --check` in the active integration checkout.

Expected: all 51 manifest files match. Record any pre-existing whitespace finding separately; do not silently modify another workstream’s file.

- [ ] **Step 2: Run the full automated gate from the authorized feature checkout**

Run: `npm run check && npm run test:e2e && npm run test:e2e:storage-integration && npm run test:e2e:recording`

Expected: every non-intentional test passes. If a command cannot run because of cloud-file materialization or an environment fault, record it as **NOT-RUN** with command, exit/symptom, and an independently repeatable checkout; do not translate it into PASS or a code failure.

- [ ] **Step 3: Request bounded independent reviews**

Give Astra a read-only prompt: “Audit the NINA Devices diff against the design spec. Focus on Web MIDI permissions/SysEx, port identity, selected-output-only sends, channel bytes, setup parser, listener disposal, lease release, and recovery-state isolation. Return severity, evidence path/line, reproduction, and minimal fix; do not edit.”

Give Genspark Claw a read-only prompt only after the user explicitly authorizes source sharing: “Independently inspect the bounded Devices diff and tests. Compare NINA CC 7/28/29/30 and Echo Filter guidance with manufacturer/browser sources; identify protocol, UX-safety, and acceptance-test gaps; cite sources; do not modify, install, or access credentials.” If source sharing is not authorized, give it the public design plus a redacted interface/test summary and label the result protocol-only.

- [ ] **Step 4: Dispose every review finding**

For each Astra/Genspark finding, add one row: `finding ID | source | severity | fix | test command/result | explicitly deferred reason`. Fix all blocking/high findings within scope; do not call the feature complete while one is unresolved.

- [ ] **Step 5: Complete the human gate and write the final verdict**

Attach the completed NINA hardware packet or mark the final verdict **SOFTWARE READY — HARDWARE ACCEPTANCE PENDING**. Only use **NINA PROFILE ACCEPTED** when all automated gates, review disposition, and every physical checkbox pass.

## Self-Review

**Spec coverage:** Tasks 1–2 cover selected-port transport, monitor, lifecycle, and ownership; Task 3 maps the four documented controls; Task 4 isolates strict portable setup data; Task 5 implements explicit UI/apply/human confirmation; Task 6 integrates capture ownership without refactoring its transport; Task 7 covers Chromium and physical acceptance; Task 8 enforces the cross-model evidence graph and completion boundary. No design requirement is intentionally omitted.

**Placeholder scan:** No `TODO`, `TBD`, vague validation directive, or unspecified test appears in this plan.

**Type consistency:** `RouteLeaseRegistry` is introduced in Task 1 and consumed by Task 2/6; `BrowserMidiSession.sendCc` consumes the `buildNinaCc`-compatible `{channel, controller, value, label}` shape; `DeviceSetup` owns `NinaDesiredValues`; the React workspace is the only consumer of setup/session display state.

**Review-focus coverage:** stale port (Tasks 2/5/7), channel and CC bytes (Tasks 2/3/7), slider coalescing (Tasks 2/5), import atomicity (Tasks 4/5/7), and asynchronous capture ownership (Tasks 1/6) each have a named test.

