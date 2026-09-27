# Task 9 library readiness preflight

Prepared by Astra on 2026-09-04 at approximately 22:55–22:58 America/Los_Angeles (2026-09-05 05:55–05:58 UTC). Read-only preparation while the sole Sol worker implements Task 8. This is a source-grounded diagnostic handoff, not a reproduced defect, implementation, or Task 9 acceptance verdict.

## Established evidence

Two historical failures exist, but they should not be treated as one proven root cause:

1. **Task 3 unit failure.** `/tmp/opstudio-task3-round2-full-unit-green.log:522-535` records `LibraryPage > Selection Management > should clear selection` failing at `fireEvent.click(checkboxes[1])` with `Unable to fire a "click" event - please provide a DOM element`. The run actually finished **519 passed / 1 failed**, despite `green` in its filename. The isolated rerun passed **1/1** and the complete rerun **520/520**. The isolated log still contains React act warnings. The missing indexed checkbox establishes an invalid readiness assumption at the moment of interaction; it does not itself identify which refresh caused that state.
2. **Task 6 Firefox browser failure.** `/tmp/opstudio-task6-round1-full-browser.log:502-524` records a 30-second timeout waiting for the exact `ok` button after the Load click. The full run was **94 passed / 1 failed**. `/tmp/opstudio-task6-round1-library-firefox.log:313-315` records the same isolated case passing, with a 2.8-second test duration. Task 9 notes report a Library page snapshot without the dialog, but the referenced historical `test-results/.../error-context.md` is no longer present at that path, so this preflight did not independently re-inspect its DOM or pointer history.

The later Task 7 full configured browser matrix completed **118 passed / 2 deliberate desktop-only mobile skips**, verified in `/tmp/opstudio-task7-round1-full-browser.log`. No browser or test was run for this preflight, and the intermittent failure was **not reproduced** here.

## Actual route and inspected anchors

| Stage | Inspected source and behavior |
| --- | --- |
| Save readiness | `src/components/multisample/MultisampleTool.tsx:214-228` awaits `savePresetToLibrary` before showing the saved notification and emitting `library-refresh`. `src/utils/libraryUtils.ts:124-166` prepares a snapshot, awaits the preset write, and treats the optional session marker separately. `src/utils/indexedDB.ts:204-214` resolves the write on transaction completion. |
| Library mount | `src/components/common/MainTabs.tsx:83-92` mounts LibraryPage only when the Library tab is active. `src/main.tsx` wraps the app in StrictMode. Account for its development lifecycle in diagnostics; do not assume identical effect counts in development and production. |
| Read scheduling | `src/components/library/LibraryPage.tsx:60-109` calls `getAll(PRESETS)` on mount, separately schedules another read after 100 ms when the tab is Library, and listens for `library-refresh`. Every read sets `isLoading=true`, later replaces `presets`, and independently clears loading. There is no request-generation or in-flight counter. |
| Row readiness | `LibraryPage.tsx:112-153` derives filtered/sorted rows in a separate effect. `src/components/library/LibraryTable.tsx:121-125` replaces the entire table content with the loading view whenever `isLoading` is true. A refresh can therefore remove existing row controls. |
| Load event | `src/components/library/LibraryTableContent.tsx:374-379` connects the desktop icon's click to `onLoadPreset(preset)`; the mobile equivalent is at line 120. `IconButton.tsx` supplies the accessible name from its title. There is no asynchronous operation between that callback and the confirmation decision. |
| Confirmation | `LibraryPage.tsx:163-173` checks current rendered loaded-audio state and immediately sets both the pending preset and dialog-open state when audio exists. The confirmation modal is outside the conditionally rendered table. A table refresh alone does not reset those two LibraryPage state values or unmount the dialog. |
| Restore | `LibraryPage.tsx:393-397` closes the dialog only after OK starts the confirmation callback, then `actuallyLoadPreset` awaits `deserializeLibraryPreset` and dispatches `RESTORE_LIBRARY`. Decoding is downstream of OK; slow decode cannot directly explain a timeout while waiting for the first OK button. |
| Browser assertion | `tests/e2e/export-workflow.spec.ts:156-193` loads drum and multisample audio, waits for the library-save notification, edits temporary settings, switches to Library, clicks Load, then waits for OK. Successful restore is checked through actual exported preset fields and preservation of the drum kit. |

## Source-grounded hypotheses

**Unit harness: high-confidence source issue, historical causal attribution still unproven.** `src/test/components/LibraryPage.test.tsx:41-90` creates `dispatch: vi.fn()` anew each time its mocked `useAppContext` runs. LibraryPage's `loadPresets` callback depends on dispatch, and its mount/read effect depends on that callback. Consequently local rerenders change the mocked dispatch identity and can restart the effect/read/loading cycle. The real AppContext passes the reducer dispatch, so this particular unstable-mock mechanism is not an explanation for Firefox production behavior. The test's setup waits for loading to disappear and one name to appear, then uses unscoped checkbox array positions (`:388-424`); another read can invalidate those assumptions. Fixing only an added wait would leave the mock-induced churn unexplained.

**Production refresh/readiness: plausible browser contributor, not proven.** On an ordinary Library mount the immediate read and 100 ms scheduled refresh overlap the first opportunity to click Load. Replacing the table during the refresh could disrupt a pointer interaction or change its target. Existing actionability waiting does not establish that the application callback ran. However, the source also constrains the hypothesis: if `handleLoadPreset` ran with loaded audio, it opens the dialog synchronously; list refresh does not clear dialog state. A useful trace must distinguish a missing callback from a callback that opened a dialog which was subsequently canceled or whose page unmounted. Do not declare that the duplicate read "closes the dialog."

**Overlapping request ownership: established structural hazard, no demonstrated failing completion order.** Each pending request can publish its own result and clear a shared loading boolean, regardless of whether a later request is still active. This can expose rows while a newer read is pending or let an older captured result replace a newer one. IndexedDB normally provides ordered transaction behavior, so an actual out-of-order or stale-result claim requires an observed timeline or controlled regression. The absence of guards alone is not proof that the historical browser failure took that path.

**Pending save or slow decoding: weak explanations for the recorded failure.** The test already waits for the saved notification, which follows the committed preset write. A delayed session marker can postpone that notification but is awaited before the test proceeds. Restoration decode starts after OK, whereas the failure is waiting for OK. Investigate these only if new evidence contradicts that ordering; do not add arbitrary save/decode delays to this test.

## Minimal next diagnostic and regression

1. **Make the unit harness faithful and controlled first.** Give the mocked context a stable dispatch identity and a stable state fixture. Control the first and second `getAll` promises explicitly; advance only the component's 100 ms refresh timer within the test's update boundary. Record/assert the request count and the appearance/removal of the named row controls. Do not assume a row stays ready because it was visible once. Prefer a specific preset row and its checkbox to array indices. Verify selection persists through a refresh and that an unrelated local selection rerender does not start another read. Keep the real LibraryPage and table components so this regression does not mock away the lifecycle being checked.
2. **Reproduce the confirmation sequence deterministically at component level.** With real context state containing loaded audio and one valid saved preset, resolve the first read, open its Load confirmation, then trigger/resolve the scheduled refresh. Assert the confirmation remains available and references the intended preset. This tests the source-supported ownership boundary without guessing that it caused Firefox's earlier timeout. Also resolve two controlled reads in the opposite order to establish whether stale completion is observable before selecting an ownership policy.
3. **Only then run one instrumented Firefox case under controller ownership.** Retain the first-failure trace, screenshot, and DOM/error context. Capture a small timestamped event timeline: Library page mount/unmount; each preset read start/end and request identity; pointerdown/pointerup/click target and whether the Load callback ran; loaded-audio counts at that callback; dialog open/cancel/confirm transitions; and tab/generation changes. Record identifiers/counts, not audio contents or full preset documents. Put the explicit dialog-visible checkpoint immediately after Load so failure is localized. If it passes, retain that result as non-reproduction instead of retrying until green or expanding to a full matrix.

The diagnostic should answer one question: **did Load fail to reach the callback, reach it with unexpected state, or open a dialog that another event dismissed/unmounted?** That evidence determines whether to change refresh scheduling, preserve rows during background refresh, add request ownership, fix an interaction boundary, or only repair the test harness. No product fix is selected by this preflight.

## Ownership and preservation hazards

- Task 8 owns workspace/component changes now. Reconcile its final source before implementing this plan; do not independently edit LibraryPage, shared confirmation UI, MainTabs, context, or E2E helpers while Sol is working.
- Keep list-refresh readiness separate from project-replacement consent. A refresh must not count as approval to load, switch the selected preset behind an open confirmation, or cause an extra load/Undo action.
- If the actual restore path is changed, preserve the existing complete incoming decode before the single `RESTORE_LIBRARY` action, both-mode preservation rules, project-generation invalidation of pending imports, and one-Undo semantics. Library restore's own asynchronous latest-wins/cancellation policy is a distinct ownership question; it is not established as the cause of the pre-OK failure.
- Do not hide intermittency with blanket retries, forced clicks, a larger timeout, an unconditional sleep, or an assertion that OK may be absent. The tested state contains audio and requires confirmation.
- Keep the original failure, isolated pass, and subsequent broad pass as separate evidence. Existing act warnings should be resolved by deterministic test ownership, not suppressed.

## Inspection fingerprint

Hashes captured during preparation, to detect source drift before Task 9 work:

| File | SHA-256 |
| --- | --- |
| `src/components/library/LibraryPage.tsx` | `465fad5c03ca50b76bd868586c6bb17f2933084e5564f32fd7f7892b417e7008` |
| `src/test/components/LibraryPage.test.tsx` | `4c206b22e5c4cdbaf3ce5a6dd9d3b9d0378a9d73621fad85b0c4edb8df9f5f4c` |
| `src/components/library/LibraryTable.tsx` | `5993416c58c18debe920692d4a2468115b03639f8950515aa5c6f1e2303ef4f5` |
| `src/utils/libraryUtils.ts` | `49eab7da41ee78ece7efdd104054f053fe09245079f82f1dabcbd08c85e35197` |
| `src/utils/indexedDB.ts` | `52945da7f107d07152942dd568630abc0f0f7045b581c083754e6203027a452c` |
| `tests/e2e/export-workflow.spec.ts` | `37ae2a0c617505d56b7a3160faeff9ddb35d0bf2a55f7df38dea2887a40b795b` |

LibraryPage's inspected hash also matches `/tmp/opstudio-task3-before-round2/src/components/library/LibraryPage.tsx` and `/tmp/opstudio-before-task7/src/components/library/LibraryPage.tsx`, tying its current read/confirmation structure to the historical snapshots. That establishes source continuity, not runtime causation. No runtime, test, E2E, configuration, or other task document was modified during this preflight.
