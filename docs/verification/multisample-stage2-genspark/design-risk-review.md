# Stage 2 Design & Adversarial Risk Review — Guided Automatic Multisampling (OP-PatchStudio)

**Scope of evidence:** only the four attached files (`AutoSamplingPanel.tsx`, `RecordingModal.tsx`, `StudioShell.tsx`, `autoSampler.ts`, plus `useOwnedDialog.ts`). Findings cite file + symbol. Claims I cannot anchor to a symbol are labeled **[hypothesis]**. No tests were run; no code changed.

---

## 1. Scope and exclusions

**In scope (Stage 2 now):** a thin guided sequence — Connect/check → Capture range → Review → Finish — layered over the existing `AutoSamplingPanel`, `CaptureSession`/`AutoSampler`, review tray, commit pipeline (`COMMIT_PREPARED_RECORDINGS`), editor, save-to-library, and OP-XY export guide. Sound-check evidence retention/audition, invalidation rules, phase gates, per-note recovery, race/a11y invariants.

**Out of scope:** replacing DSP, storage, library, or export engine; full-library backup (help text already states "not available yet" — `StudioShell` `backup` topic); native USB transfer (export dialog MTP guide already exists in the `backup` topic and `ExportPreflight` wired in `ProjectToolbar`); drum and manual workflows (must stay compatible — they are untouched by this design); dependency changes; VST hosting (browser is not a host; `ableton` profile help already says so). Equipment profiles ("NINA through Digitakt II", "Ableton") remain **optional examples**, not required paths.

---

## 2. Phase state machine (exact transitions)

Phase is **derived state** inside `AutoSamplingPanel`, not a new stored enum. Existing booleans (`running`, `checkedRoute`, tray contents in `RecordingModal`) already encode it.

| Phase | Entry condition | Allowed exits |
|---|---|---|
| `route` (Connect/check) | Default, or any invalidation fires (`checkedRoute !== routeKey`) | → `checked` (check passes); → `capturing` (gated, see below) |
| `checked` | `checkedRoute === routeKey` after a passing one-note check | → `route` (invalidation); → `capturing` |
| `capturing` | `samplerRef.current` set, `running === true` | → previous phase on stop/error/complete; takes flow to Review continuously |
| `review` (parallel, not exclusive) | Any take in tray (`takesRef.current.length > 0`) | → Finish (`apply()` → commit receipt); → `capturing` (more notes / retries) when not running |

**Guards:**

- **Check gate (all profiles).** Today range capture throws only when `profile!=='custom' && checkedRoute!==routeKey` (`begin()` in `AutoSamplingPanel`). Change: require `checkedRoute === routeKey` for **every** profile, including `custom`. The status paragraph `{profile!=='custom'&&<p role="status">…}` must render unconditionally.
- **Capture guard (unchanged):** settings validated by `validateAutoSampleSettings`; root-conflict check against `existingRoots`; tray count/byte budget against `RECORDING_LIMITS.takes` / `ownedBytes`; audio input resolved (`inputResolutionRequired`/`desiredAudioRef`); MIDI enabled and output connected.
- **Backwards navigation:** Review → Capture (retry/add notes) allowed only when `!automaticActive` (RecordingModal already disables tray edits via `applying||automaticActive`). Capture → Connect allowed any time capture is not running; `stop()` keeps finished takes ("Finished takes remain in review" — existing `stop()` message). Finish is reached only through the existing `apply()` → receipt path; there is no skip that fabricates success.

**Settings that invalidate check evidence (decision + justification).** The check proves *routing*: same instrument, audible, not silent/clipped. Therefore:

- **Invalidate:** `audioDeviceId`, `outputId`, `channel`, `velocity`, `startNote` — all already in `routeKey`; each changes the signal path or the note actually tested. Also MIDI `portschanged`, audio-input change (`audioSelectionVersion` effect already resets `checkedRoute`), and `stop()` (current behavior, keep).
- **Do NOT invalidate:** `endNote`, `step` — they select which notes are captured later, not the path the check tested. `settleSeconds` and `readinessTimeoutSeconds` — timing hygiene, not signal path. **`holdSeconds`/`tailSeconds` — do not invalidate, but annotate:** the check's peak verdict (`peak>=.02 && peak<.99` in the checkSound branch of `onTake`) is duration-dependent; a longer tail can drop peak level. Fix: keep evidence valid, but when hold/tail changed since the check, show a non-blocking hint "Route checked with different hold/tail; re-run Check sound if levels matter" instead of silently trusting or silently invalidating.

---

## 3. Minimal component/state contracts (no dependency changes)

```ts
// AutoSamplingPanel — Props unchanged in shape; one internal addition:
interface CheckEvidence {
  routeKeyAtCheck: string;        // routeKey captured at pass time
  audioBuffer: AudioBuffer;       // the one-note take, retained for audition
  rootNote: number;
  peakDbfs: number;               // from existing peakLevel()/levelLabel()
  holdSeconds: number; tailSeconds: number; // for the hold/tail-changed hint
}
// Panel state: replace checkedRoute:string with checkEvidence:CheckEvidence|undefined
// Derived: phase = running ? 'capturing' : checkEvidence?.routeKeyAtCheck === routeKey ? 'checked' : 'route'

// AutoSamplingPanel — begin() signature unchanged:
begin(onlyNote?: number, replace = false, checkSound = false): Promise<void>
// checkSound=true → onTake result is stored into checkEvidence (currently discarded),
// then released by releaseCheckEvidence().

// RecordingModal — no new props. Reuse its preview discipline (previewRef,
// pendingPreviewContextsRef, AudioContext per audition, close().catch) as the pattern
// for a second bounded preview slot owned by the panel:
interface CheckAudition { context: AudioContext; source: AudioBufferSourceNode }
// AutoSampler, CaptureSession, commit pipeline: zero changes.
// localStorage 'op-patchstudio:auto-sampling:v1': loadPreferences() already merges
// saved routes per profile with defaults — this migration path is preserved as-is.
```

---

## 4. Per-concern design

### 4.1 Retain and audition the one-note check, with bounded cleanup
Today the checkSound branch of `onTake` computes `peakLevel`, sets `checkedRoute` or an error, and **returns** — the take's `AudioBuffer` is dropped, while the panel copy says "Listen to confirm the intended instrument" and the `<details>` copy says "Listen to the return" with no affordance. Fix: store the check take into `checkEvidence` (one buffer, ≤ 20 s stereo — bounded by `AUTO_SAMPLE_LIMITS.captureSeconds`), add an **"Audition check note"** button using the same one-shot `AudioContext` + `BufferSource` + `onended` cleanup pattern as `RecordingModal.audition` (per-audition context, `pendingPreviewContexts`-style set, `releasePreview` on stop/close). Release `checkEvidence` on: routeKey change, invalidation, modal `close()` (the existing unmount cleanup `void samplerRef.current?.cancel()` extends to the audition context), and replacement by a new check. Memory bound: exactly one buffer at any time.

### 4.2 Generic routing UI without breaking saved profiles
Keep the three-entry `Profile` select but relabel as "Routing example (optional)" with **Custom first**. `loadPreferences`/`applyProfile` already persist and restore per-profile routes, including the saved-audio-device resolution dance (`desiredAudioRef`, `inputResolutionRequired`) — unchanged. All capture logic stays profile-agnostic; profiles contribute only `setupSteps`/`profileHelp` text. No new profile schema.

### 4.3 Per-note recovery (keep what works, close the gap)
Existing, confirmed functional: `inspectTake` warnings → `selected=false` → per-note `retryNotes` buttons → `begin(note, true)` replaces the warned take only on a clean retry (`if(!replacing||result.selected)onTake(result,replacing)`), and `RecordingModal` renders "Retry this MIDI note before selecting it." Gap: `retryNotes` is never cleared when `routeKey` or profile changes, so a retry button can fire a note under settings that differ from those that produced the warning. Fix: clear `retryNotes` in the existing `routeKey` effect alongside `setCheckedRoute('')`.

### 4.4 Review → editor → save/export handoff (existing, keep)
`apply()` → `prepareRecordingApplication` → `dispatch COMMIT_PREPARED_RECORDINGS` with `operationId` → receipt effect applies/retains and reports exact counts ("N takes added; M retained in review"). Success surfaces **only** from the receipt; no message claims transfer. Save/library/archive/export are the existing `ProjectToolbar` actions and `ExportPreflight` guide. Nothing here changes; the design explicitly forbids adding any "Transferred to OP-XY" state.

### 4.5 Race, cleanup, and accessibility invariants (preserve as invariants, not redesigns)
Confirmed already present and must not regress: `runIdRef`/`generation` guard on every async callback; `stopOperationRef` single-flight stop; `visibilitychange` auto-stop; `portschanged` stop + reconnect message; `releaseOwnedNote` in `finally` of `captureNote` and in `cleanupActive`; `useOwnedDialog` Escape top-of-stack and focus trap; discard guard (`confirmDiscard` alertdialog when takes exist or capture is active); `StudioShell.guard` blocking workspace changes while the recorder is open; `role="status"`/`role="alert"` live regions.

**Additions:** (a) stale-progress fix below; (b) stuck-note advisory: when `releaseOwnedNote`'s `noteOff` send throws, currently swallowed (`catch {/* disconnected output */}`) — set a visible warning "The note-off for MIDI note N could not be sent; stop the note on the instrument" instead of silence **[hypothesis that stuck notes occur in practice; the silent catch is confirmed]**; (c) the check-audition preview must stop when capture starts (reuse the `audition`-style guard that stops preview when state is active).

---

## 5. Top risks (max 6)

| # | Risk | Severity | Status | Evidence | Minimal fix |
|---|---|---|---|---|---|
| 1 | Custom profile bypasses the mandatory sound-check gate, and Custom users get no check-status paragraph at all | High | Confirmed | `begin()`: gate `onlyNote===undefined&&profile!=='custom'&&checkedRoute!==routeKey`; render `{profile!=='custom'&&<p role="status">…}` | Gate on `checkedRoute!==routeKey` for all profiles; render status unconditionally |
| 2 | Sound check analyzes and discards its recording; "Listen to confirm" instruction has no audition affordance | High | Confirmed | checkSound branch of `onTake` returns before `onTake`; no retention path exists | `checkEvidence` slot + bounded audition (§4.1) |
| 3 | `routeKey` omits `holdSeconds`, `tailSeconds`, `settleSeconds`, `readinessTimeoutSeconds`, `endNote`, `step` — check evidence silently survives level-relevant changes (hold/tail) while nominally over-broad omissions (endNote/step) are harmless | Medium | Omission confirmed; real-world impact [hypothesis] | `routeKey` join list in `AutoSamplingPanel` | Keep them out of the key; add hold/tail-changed hint; do not invalidate (§2) |
| 4 | Stuck note on the instrument: failed `noteOff` send is swallowed with no user notice; double note-on is guarded (one `noteOn` per `captureNote`, release in `finally`/`cleanupActive`) but residue is invisible | Medium | Silent catch confirmed; occurrence [hypothesis] | `releaseOwnedNote` catch in `autoSampler.ts`; `cleanupActive` | Surface a stuck-note warning; no protocol change |
| 5 | Stale retry buttons: `retryNotes` survives route/settings/profile changes, so a retry can run under different settings than produced the warning | Medium | Confirmed | `retryNotes` state never reset in the `routeKey` effect or `applyProfile` | Clear `retryNotes` in the `routeKey` effect |
| 6 | Stale progress text misleads: on settings change, only progress starting with `'Sound check'` is cleared, so "Captured 8/8: MIDI note 72." from a previous range persists and implies the current configuration captured it | Low/Medium | Confirmed | `routeKey` effect: `setProgress(current=>current.startsWith('Sound check')?'':current)` | Clear all capture progress on `routeKey` change; keep error/status distinct |

---

## 6. Acceptance checks (for Root/Codex to verify locally — not asserted passing)

1. With profile **Custom**, Start automatic capture without a passing check is blocked with the check-required message; the status paragraph is visible for Custom.
2. A passing check leaves one retained buffer; "Audition check note" plays it; a second check replaces it; modal close stops audition audio and releases the context (no more than one check buffer held).
3. Changing channel, velocity, MIDI output, audio input, or a MIDI `portschanged` event resets check evidence to "required". Changing endNote/step does **not**. Changing hold/tail keeps evidence but shows the hold/tail-changed hint.
4. Stop or tab-hide during capture keeps finished takes in review, clears check evidence, reports "stopped", and no phantom success message appears anywhere before a commit receipt with `status!=='rejected'`.
5. A warned note shows its warning and a retry button; changing route/settings clears the retry button; a clean retry replaces only that take; a warned retry leaves the prior take intact.
6. After a completed range capture, editing any setting clears the "Captured X/Y" progress line.
7. Escape/close with takes in review raises the existing discard alertdialog; workspace switching via `StudioShell` is blocked while the recorder is open; drum task and manual/sound-triggered modes behave exactly as before (no panel rendered for `instrument==='drum'`).
8. `grep` confirms no message asserts device transfer; export path remains the existing `.preset` ZIP + MTP guide.

---

## 7. Verdict: **READY WITH CONDITIONS**

The architecture is sound: the guided sequence can be layered without touching `AutoSampler`, `CaptureSession`, or the commit pipeline, and the hardest correctness work (generation guards, stop semantics, discard guards, dialog stack) already exists in source. Conditions — all required before this ships:

1. Extend the sound-check gate and status display to **all** profiles including Custom (Risk 1).
2. Retain and audition the check take with bounded, invalidated cleanup (Risk 2).
3. Add the hold/tail-changed hint; keep the invalidation set exactly as specified in §2 (Risk 3).
4. Surface stuck-note note-off failures; clear `retryNotes` and stale capture progress on `routeKey` change (Risks 4–6).
5. No dependency additions; no phantom "saved/transferred" states; manual and drum workflows untouched. Root/Codex performs local integration and the §6 checks.