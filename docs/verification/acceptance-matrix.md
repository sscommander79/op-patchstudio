# Upgrade acceptance matrix

This records delivered behavior, not intentions. Pending is the default until direct evidence exists.

| Requirement | Evidence required | Current status |
|---|---|---|
| Sparse drum mapping | Real downloaded ZIP from pad 0/5 has 53/58 | Browser GREEN in all5 configurations; Task1 independent re-review PASS |
| Collision-safe samples | Same-name/different-content files survive archive | Browser GREEN in all5 configurations; Task1 independent re-review PASS |
| Failed export rejects | Forced conversion/export rejection produces no completed archive | Real ZIP rejection tests GREEN; Task1 independent re-review PASS |
| Imported settings survive | Imported fx/LFO/settings match exported JSON | Browser import→download GREEN; raw precision and independent re-review PASS |
| Export frame/marker truth | Actual PCM/AIFF frame counts and valid bounds | RealRIFF/AIFF byte bounds and converted/cutbrowserexport verified; Task4 independentround2PASS |
| Atomic saves | Failed transaction retains old samples and session | Real browser rollback GREEN in5 profiles; Task2 independent re-review PASS |
| Serialized save/clear | Ordered queue and failure recovery | Independent focused tests GREEN |
| Lossless saved audio | Exact Float32 values/dimensions after round trip | Exact precision/rate/dimensions browser GREEN in5 profiles |
| Complete restore | Advanced settings/zero loops/assignments/imports preserved | Unit and actual library reload/export GREEN; settings-only recovery browser GREEN; independent re-review PASS |
| Visible storage status | State revision tracked; actionable failures/retry | Retry and stale-completion checks GREEN; failed-load autosave/marker outcome regressions GREEN; independent re-review PASS |
| Recovery independent of age | Older sessions remain recoverable | Two-day-old recovery and nondestructive Escape browser GREEN in5 profiles |
| Undo/redo | Musical gestures/replacement/slicing reversible, memory bounded | Task3 history/batches/realCarbon gestures/keyboard and memory bounds verified; independent round2 PASS. Task5 guarded slicing commit and actual one-click Undo verified in all5 browser profiles |
| Portable projects | Versioned validated lossless backup round trip | Real ZIP precision/schema/rejection and DOM backup/open/undo GREEN across5profiles; independent Task3 PASS |
| Loop editing | Crossfade/playhead/numeric boundaries/drag outside frame | Task4 actualnumeric/pointer/touch/transport/exportbrowserGREEN all5profiles; independentround2PASS |
| Preview calibration | Primary documentation + device comparison | Source research and honestapproximatepreviewlabels delivered; gain/trim/release/clocksoftwaretestsPASS; physicalhardwarecalibrationpending |
| Automatic slicing | Preview/sensitivity/adjustment/cancel/assignment | Task5 full85browserPASS,617unitPASS, independentround2PASS; bounded heuristic and portable capacity checked |
| Manual chopping | Audition/mark/refine/apply, one undo | Actualaudio-clockMark/numeric/drag/Cancel/Apply/Undo/restore verified; stablemarkeridentity, ownedpreviewcleanup, independentTask5PASS |
| Batch recording | Multiple takes/review/assignment/cleanup | Task6 accepted:684units, recording10/10 browser +productionfake1/1, Astra round3PASS; guarded Apply/overflow/Undo/ownership verified |
| Sound-triggered capture | Pre-roll and onset/silence/length behavior | Actual processor frame/credit/limits tests and synthetic five-profile capture PASS; observed idle gaps recover, active/unseen gaps reject; physical input fidelity unverified |
| Better imports | Multiple payload types, errors, user-controlled suggestions | Task7 accepted:743units, prior full118browserpass/2desktop-onlymobile skips plus final localized23pass/2skips; Astra round2PASS. Nine findings closed; actual codec backup/reopen, partial intake, guarded settings and allocation bounds verified |
| Focus workspace | Full retained capability map, selected editor/table/tray | Task8 accepted: retained Focus/Table/tray capability, guarded replacement, stable selection, actual loop/Stop behavior; Astra round2 PASS |
| Demo/onboarding | Original demo, first-preset route, no destructive replacement | Task8 accepted: original Studio Seed, guarded Add/Replace and one Undo; three-engine exact PCM/backup proof PASS; human listening pending |
| Mobile/accessibility | Portrait, focus, keyboard, contrast, reduced motion | Task8 software checks PASS: 320px reflow, keyboard selection, nested dialog focus, contrast and theme behavior; real assistive technology unperformed |
| Dark mode | Entire workflow/dialog/canvas coverage | Task8 reviewed surfaces and mounted-canvas theme redraw PASS; retained screenshots and measured notification contrast |
| Offline/performance | Offline cold reload and workflows; measured startup assets | Task9 ACCEPTED: entry JS raw/gzip reduced 15.89%/13.62%, CSS 69.04%/54.20%; 32 unique revised precache URLs. Final controller offline, conservative A/B/C update, held-install/natural-activation and bounded-waiter proofs PASS. Same-name static bytes update, unrelated caches survive and old lazy routes remain available while activation waits |
| Meaningful checks | No placeholders, unit/build/lint/browser pass | Final760units77files/type/lint/build/PWA PASS; production113pass2deliberatemobileskips, source-storage10pass, deterministicrecording1pass, finalofflinePASS. Prior unchanged-subsystem evidence retained accurately |
| CI/documentation | Runnable scripts/workflows reflect verified behavior | Task10 corrected production versus source-integration command separation; all selected commands passed locally. README and workflow agree. Remote CI not run |
| Independent final review | Scoped fixes + full requirement audit | Task9 and finalTask10 accepted; all prior findings plus R10-1..3 closed. Final independent whole-branch assessment and controller scoped correction review retained in task-10-review.md and task-10-final-review.md |
| Device validation | OP-XY loads/plays representative exported presets | Unperformed; physical OP-XY transfer/import/playback remains a delivery limitation |
| Reviewable delivery | Source attribution, local runnable build, branch clean of generated files | Local candidate accepted; generated build/dependency outputs ignored; source and verification artifacts retained; no commit/push/deploy |

## Final Task 10 acceptance

All ten software tasks accepted on 2026-09-05. The final review and current validation supersede earlier staged counts: 760 units/77 files, typecheck/lint/build/PWA PASS; production browser113pass/2deliberatemobileskips, separate source-storage10pass, deterministicrecording1pass and finalproductionofflinePASS. R10-1..3 are closed. Production CI wiring and final-candidate archive admission are corrected; remote CI itself was not run. See [final review](task-10-final-review.md). Physical OP-XY, real input/listening and assistive-technology checks remain unperformed. Local changes are uncommitted and unpushed.
