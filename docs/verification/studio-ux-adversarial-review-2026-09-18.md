# Studio UX adversarial review — 2026-09-18

Verdict: retain the accepted concept; resolve the stage 1 conditions before shipping the new shell. One bounded independent Astra review, plus root integration inspection. Read-only source assessment; no new browser or assistive-technology testing was performed in this review. Earlier prototype smoke checks are separate evidence.

## Findings and disposition

| Priority | Finding and source | Required action | Gate |
| --- | --- | --- | --- |
| P1 | Navigation can unmount a workflow. MainTabs.tsx:39–59 conditionally mounts editors; RecordingModal.tsx:22 holds unaccepted takes locally and :40–43 resets/cleans up the session. The prototype merely hides views (index.html:297). | Keep Help independent of recording lifecycle. Specify resume/discard behavior before wiring Start/Create/Library. Verify no silent loss of unaccepted takes. This is an integration risk, not a reproduced current data-loss bug. | Stage 1 |
| P2 | Context tooltip CSS (:146) forces visibility on hover/focus; Escape (:367) only clears the open class. Triggers lack a programmatic relationship to content (e.g. :214). | Use a dismissible state model, connect trigger/content, and test Escape while focus remains on the trigger, pointer, and touch. | Stage 1 if adopted |
| P2 | Routing Help (:364) calls generic openHelp (:339); earlier search filtering (:370) persists and can hide routing topics. | Contextual Help must reveal the relevant hardware/software guide and clear conflicting filters. Test after searching for backup. | Stage 1 |
| P2 | Favorites control uses favorites (:257), item uses data-favorite (:258), predicate constructs data-favorites (:343). | Align the filter and attribute. Verify Warm keys appears under Favorites and all entries return after clearing. This finding applies to the prototype, not the current app library. | Before reusing prototype library behavior |
| P2 | Prototype management presents future full-library backup (:263), while the existing ProjectToolbar.tsx:28 exports an editable project archive. | Clearly distinguish Save to Library, Download Project, full-library backup, and device ZIP. Keep existing project protection available; label future capabilities accurately. | Stage 1 wording/navigation |
| P2 | Drum progress (:233) uses five steps; shared editor (:245) switches to six synth steps; renderEditor (:338) changes titles but not progress. | Derive progress and return destinations from the selected workflow. Drum routes must not acquire nonexistent Setup/Capture steps. | Stage 2 |

Prototype references above are to `docs/prototypes/studio-usability/index.html`; source references are under `src/components/common/`.

## What the review supports

The task-first start screen, hardware/software second choice, persistent Help, DAW hosting explanation, and prominent simulation notices are appropriate. The reviewer found no deceptive claim that the prototype actually records or transfers. Nonfunctional example recording and backup were not treated as defects.

## Implementation acceptance

- Help can open and close without interrupting capture or losing review takes; focus returns correctly.
- Navigation has an explicit preservation/discard contract, tested with unfinished work.
- Contextual Help shows the relevant guide despite earlier unrelated searches.
- Popups dismiss through keyboard and pointer/touch interaction.
- Existing project archive remains distinguishable from future full-library backup and device export.
- Desktop and narrow layouts retain usable navigation and Help.
- Stage 2 includes recovery guidance for permissions, missing input, silence and clipping; stage 3 requires actual backup/restore and device-transfer validation.

All findings remain open implementation requirements. No app or prototype code was changed during this review. No commits, dependencies, or hardware actions were performed.
