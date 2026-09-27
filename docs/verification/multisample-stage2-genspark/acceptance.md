# Stage 2 acceptance and review disposition

Status: software implementation verified. See verification.md and attached fresh logs; physical device checks remain outstanding.

## Acceptance checks

| Boundary | Required evidence |
| --- | --- |
| Entry | Hardware and software multisample choices enter a real guided recorder; single sample and drums keep their existing recorders. |
| Permission | Opening the journey never requests input or sends MIDI. |
| Sound check | A passing level analysis retains one auditionable buffer outside the take tray; user confirms the intended instrument. |
| Invalidation | Route and capture timing changes invalidate check evidence; range end/spacing do not unnecessarily invalidate it. |
| Cancellation | Stop, close, hidden page and MIDI loss cannot revive old capture or preview callbacks. |
| Capacity | Existing roots, take count and owned buffer budget are validated before MIDI. |
| Capture | Finished takes survive partial completion; retry does not destroy an earlier take on failure. |
| Review | Only receipt-confirmed committed IDs advance to Finish; rejected/partial results remain actionable. |
| Exit | Remaining takes require explicit discard; Help and back/next navigation preserve work. |
| Finish | Editor/library/export links target existing actions; no false save or device-transfer success. |
| Compatibility | Manual, sound-triggered and drum capture; project/library/export regressions pass. |
| Presentation | Desktop and narrow viewport navigation, focus, help stacking and visible instructions verified. |

## Genspark review disposition

- Accepted: guided custom routes require a sound check; check recording needs audition and explicit user confirmation; timing belongs in evidence identity; stale capture progress must be cleared.
- Corrected: retain retry eligibility after a route change but require a fresh check; do not strand existing warned takes.
- Corrected: a longer release tail does not mathematically reduce an existing peak; timing invalidation is justified by changed capture evidence.
- Deferred outside this UI scope: capture-engine note-off failure reporting. Preserve existing stuck-note guidance; do not claim that software checks prove hardware silence.
- Physical MIDI/audio routing, sound identity and OP-XY playback remain user/hardware checks, distinct from automated software evidence.

## Execution provenance

Genspark Super Agent produced the design/risk review. Its task API offered no model/tier selector. Implementation uses the locally configured Genspark proxy with requested model `gpt-5.6-sol`, high reasoning. Local runtime logs confirm that provider/model route. This is route evidence, not independent proof of the upstream model or a cost claim.

OpenCode snapshots were disabled after cloud-offloaded Git metadata blocked startup. A separate source baseline exists in `/tmp/opstudio-stage2-before`; source preservation and final verification remain the integration owner's responsibility.
