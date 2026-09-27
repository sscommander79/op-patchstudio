# OP-PatchStudio Studio System Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dashboard-like Studio shell with the approved compact, original Studio System visual language while preserving every existing interaction and device/MIDI behavior.

**Architecture:** Keep the current React route/state ownership in `StudioShell` and the existing drum-pad state machine in `DrumKeyboard`. Change only semantic presentation markup, CSS classes/data attributes, and visual-regression assertions. Centralize the new palette and control primitives in `studio.css`; consume those primitives across Start, editor, library, transfer, and drum-pad surfaces. MIDI devices remain functionally unchanged and are styled only from their existing rendered state.

**Tech Stack:** React 19, TypeScript, Vite, CSS custom properties, Testing Library/Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-22-studio-system-visual-design.md`

## Global Constraints

- This is a visual-only phase. Do not change MIDI mapping, MIDI sending, device profiles, route leases, Web MIDI permissions, audio capture, recording, export, persistence, project data, or keyboard interaction behavior.
- NINA remains an unvalidated test device; do not make claims that a generic external-synth mapping workflow works or has been tested.
- Preserve the existing `StudioShell` view state, recorder guard, focus restoration, accessibility names, keyboard navigation, drag/drop behavior, and responsive behavior.
- Preserve the real drum labels and pad indexes in `DrumKeyboard`; presentation must derive `LOADED`, `EMPTY`, selected, pressed, and drag-over states from existing state only.
- Do not use Teenage Engineering trademarks, logos, proprietary fonts, supplied imagery, icons, product UI, or exact control geometry. This product must remain visibly original and clearly marked unofficial where that disclosure already exists.
- Use only the approved visual vocabulary: warm off-white, graphite rules, dark technical panels reserved for actual state, cyan for connected/loaded/route, orange for active/selected capture, and red for errors/destructive actions. No gradients, glass effects, decorative fake telemetry, or green sidebar.
- Keep pages natural height. Do not reserve blank “projects,” “recent work,” or status areas when there is no real data to show.
- The checkout is user-owned and dirty. Do not revert unrelated changes. Do not commit, push, deploy, or alter environment/config files without a separate explicit authorization.

## Review Focus

- Confirm that desktop Start fills a sensible working width without a tall empty canvas, and that the mobile layout has no horizontal overflow.
- Confirm every Start, setup, library, transfer, editor, recorder, help, and Devices navigation path still reaches the exact existing underlying workflow.
- Confirm the drum keyboard remains operable by pointer, physical computer keyboard, focus/arrow movement, drag/drop, and mobile bank controls.
- Confirm visible route/loaded/selected state corresponds to actual component state; no simulated MIDI readiness, messages, or project data.
- Treat snapshots as presentation evidence only; retain unit/E2E behavior tests as the behavioral contract.

---

## Task 1: Establish Studio System tokens and shared flat-control primitives

**Files:**
- Modify: `src/styles/studio.css`
- Add: `src/test/components/StudioShell.test.tsx`

- [ ] **Step 1: Add a failing render-level contract for the new shell landmarks.**
  - Render the application shell/provider using the existing test conventions.
  - Assert the semantic header/navigation/tool-strip landmarks expected by the approved design, rather than testing CSS pixels: branded product name, primary navigation, tool navigation, current-page state, and the existing unofficial disclosure.
  - Run the focused test and confirm it fails before markup changes because the current persistent sidebar structure is still present.

- [ ] **Step 2: Add the shared visual foundation at the end of `studio.css`.**
  - Introduce narrowly named Studio System variables for warm page/panel/recess surfaces, graphite rule/text/muted text, cyan/orange/red semantic signals, pad tray, and raised-key surfaces. Map legacy `--studio-*` aliases to them so existing components continue to render coherently.
  - Add reusable classes for: compact top-level header, tool strip, technical eyebrow/metadata, flat outlined action, active state, quiet secondary action, dark state panel, and reduced-motion/focus-visible behavior.
  - Use physical-looking depth only inside the drum-pad tray: modest border radius, a thin highlight/shadow pair, and a `translateY` pressed state. Keep general cards flat and ruled.
  - Remove/override the green sidebar palette and any shell minimum height that creates the observed dead space. Do not edit global behavior styles or design unrelated components.

- [ ] **Step 3: Verify baseline presentation compilation.**
  - Run `npm run typecheck` and the focused render-level test.
  - Run `npm run lint` if any class/markup change is included in this task.

## Task 2: Recompose the Studio shell and Start page around real work, not placeholder space

**Files:**
- Modify: `src/components/common/StudioShell.tsx`
- Modify: `src/styles/studio.css`
- Modify: `tests/e2e/studio-shell.spec.ts`
- Modify: `src/test/components/StudioShell.test.tsx`

- [ ] **Step 1: Extend the E2E contract before changing layout.**
  - In `tests/e2e/studio-shell.spec.ts`, add assertions for the desktop shell’s primary navigation and tool strip, Start’s three real task launchers, the two existing library/transfer actions, and absence of a fabricated recent-project region.
  - Add a viewport assertion that the Start route’s main content uses the available viewport width without document horizontal overflow. Keep the existing 390px navigation/focus tests intact.
  - Run the focused spec and confirm the new landmark/layout expectation fails against the old sidebar shell.

- [ ] **Step 2: Change `StudioShell` structure without changing its state transitions.**
  - Replace the visual `<aside className="studio-shell-sidebar">` composition with a compact header containing the brand/unofficial label, existing Workspace navigation actions, existing Tools actions, and the existing Help entry point.
  - Retain the exact button text, `aria-current` logic, handlers, `guard`, `workspace`, `chooseTask`, `openHelp`, title computation, focus effect, recorder-open event behavior, and dialogs/modals.
  - Add deterministic semantic classes/data attributes only where needed for styling the current route and current tab. Do not introduce a new router, persistent project list, fake connection indicator, or new product action.
  - Recompose Start into a dense, natural-height launch grid: multisample, one-shot sample, and drum kit retain their current actions; each gets a small original functional diagram built from CSS/semantic markup, not external imagery. Keep the existing Library and Back up/transfer actions as a compact utility row below it.
  - Replace any decorative diagonal/ambiguous graphic with a legible note-range, waveform, or pad-grid motif that is visually bounded inside its own launcher.

- [ ] **Step 3: Style the shell and Start modules.**
  - Create a responsive, full-width but bounded workbench frame with warm background, hairline graphite rules, compact header/tool strip, clear active indicator, and no left-side dark-green column.
  - Give each Start launcher an equal visual rhythm: title, short process label, bounded diagram, and action affordance. Avoid tall fixed card heights that strand unused space.
  - Ensure no outer mock-device border consumes large screen areas on wide desktops; the real app should expand naturally to a documented maximum content width.
  - At tablet/mobile breakpoints, wrap/scroll only navigation where necessary, collapse launch modules to one column, preserve 44px targets, and avoid horizontal overflow.

- [ ] **Step 4: Prove no workflow regression.**
  - Run `npx playwright test tests/e2e/studio-shell.spec.ts`.
  - Run `npm run typecheck` and `npm run lint`.
  - Capture desktop and 390px screenshots for visual review; compare them to the approved compact/natural-height principles, not to a TE product UI.

## Task 3: Apply the shared system to setup, library, transfer, and existing editor chrome

**Files:**
- Modify: `src/styles/studio.css`
- Modify: `tests/e2e/studio-workspace.spec.ts`
- Modify: `tests/e2e/studio-shell.spec.ts`

- [ ] **Step 1: Add a failing behavior-preserving visual contract.**
  - Extend existing Playwright coverage to assert the editor/tool tab remains reachable from the new tool strip, project controls remain available, and Library/transfer copy still distinguishes local editable project, saved library item, and device export.
  - Add only stable state assertions (role/name/visibility/class or data attribute); do not assert implementation-specific DOM nesting or color hex values.

- [ ] **Step 2: Apply the shared CSS primitives across real working surfaces.**
  - Style setup/source/manage panels, project toolbar, tab navigation, Library navigation/index, export/transfer panels, empty states, dialogs, and notifications using the new tokens and flat technical rule treatment.
  - Preserve current semantic message colors through the tokens: cyan for actual loaded/connected state only, orange for current selection/capture only, red for errors/destructive actions only.
  - Let content determine height. Remove visual padding/min-height that yields a blank lower half of pages, while retaining safe modal/scroll behavior.
  - Do not modify library data, export logic, dialogs, recorder state, or project menu handlers.

- [ ] **Step 3: Verify working-surface behavior.**
  - Run `npx playwright test tests/e2e/studio-workspace.spec.ts tests/e2e/studio-shell.spec.ts`.
  - Run the relevant Testing Library suite for toolbar/library components if touched.
  - Run `npm run typecheck` and `npm run lint`.

## Task 4: Give the drum keyboard the approved flat-but-molded pad system

**Files:**
- Modify: `src/components/drum/DrumKeyboard.tsx`
- Modify: `src/styles/studio.css`
- Modify: `src/test/components/DrumKeyboard.test.tsx`
- Modify: `tests/e2e/drum-pad-access.spec.ts`

- [ ] **Step 1: Add failing tests for truthful pad state hooks.**
  - In `DrumKeyboard.test.tsx`, load known samples using the existing test helper and assert pads expose stable presentation attributes/classes for loaded versus empty, selected, and pressed state without changing their accessible name, `data-drum-pad`, or keyboard mapping.
  - In the existing drum accessibility E2E test, assert visible key labels such as KD1/KD2 still map to their current pads, mobile bank controls remain reachable, and no horizontal overflow appears at a narrow viewport.
  - Run the focused tests and confirm the new state-hook expectation fails before implementation.

- [ ] **Step 2: Add presentation-only pad hooks in `DrumKeyboard`.**
  - Derive `data-pad-state="loaded" | "empty"`, selected/pressed/drag-over attributes, and optional visual-only `LOADED`/`EMPTY` status text from the existing `mapping`, sample presence, `selectedSampleIndex`, `pressedKeys`, and drag state.
  - Keep the actual existing pad labels, indexes, `aria-label`, keyboard event handling, audio play callback, drag/drop callback, focus continuity, mobile bank switching, and browser MIDI behavior unchanged.
  - Do not alter sample loading, selection, MIDI mapping, or audio payloads.

- [ ] **Step 3: Implement the contained pad tray.**
  - Place the keyboard visually inside a darker neutral-gray tray, with muted gray rounded pads that use shallow molded/raised edges but retain the system’s flat construction.
  - Use a cyan dot/status for loaded pads, an orange signal/edge for selected or active pads, and a restrained pressed-depth response. Empty pads remain legible and intentionally quiet.
  - Make desktop and mobile presentation share state colors and labels; preserve touch target size and focus visibility.
  - Remove inline presentation mutations only where they block deterministic CSS state styling; retain drag/drop behavior and event handling exactly.

- [ ] **Step 4: Verify interaction and rendering.**
  - Run `npx vitest run src/test/components/DrumKeyboard.test.tsx`.
  - Run `npx playwright test tests/e2e/drum-pad-access.spec.ts`.
  - Run `npm run typecheck` and `npm run lint`.
  - Capture one loaded/selected desktop pad-tray screenshot and one narrow/mobile bank screenshot for review.

## Task 5: Give Devices a visual-only alignment pass and complete whole-product QA

**Files:**
- Modify: `src/styles/studio.css`
- Do not modify: `src/components/devices/DevicesWorkspace.tsx`
- Do not modify: `src/components/devices/useDevicesWorkspace.ts`
- Do not modify: `src/midi/browserSession.ts`
- Do not modify: `src/midi/deviceSetup.ts`
- Do not modify: `src/midi/ninaProfile.ts`
- Do not modify: `src/midi/routeLease.ts`
- Modify only presentation assertions: `tests/e2e/devices-workspace.spec.ts`
- Add: `docs/visual-qa/2026-09-22-studio-system-visual-qa.md`

- [ ] **Step 1: Add a non-sending Devices presentation check.**
  - Extend `devices-workspace.spec.ts` using its existing fake/session setup to confirm Devices remains labeled NINA-specific, no MIDI action occurs merely from opening it, and disabled/connected/error visual states are driven by the existing state rather than fabricated dashboard telemetry.
  - Do not broaden the test into generic mapping coverage; that is a later hardware-validation phase.

- [ ] **Step 2: Style Devices only through existing selectors.**
  - Apply the common panel/rule/semantic-token styling to existing connection, desired-value, monitor, and activity areas.
  - The dark technical treatment may be used only for actual state/monitor content that already exists. Do not add synthetic signal graphs, fake “MIDI READY,” fake sent values, or new device controls.

- [ ] **Step 3: Run full automated validation.**
  - Run `npm run check`.
  - Run `npx playwright test tests/e2e/studio-shell.spec.ts tests/e2e/studio-workspace.spec.ts tests/e2e/drum-pad-access.spec.ts tests/e2e/devices-workspace.spec.ts`.
  - If any command fails due to pre-existing dirty-worktree behavior, isolate and report the failing test/error without modifying unrelated code.

- [ ] **Step 4: Perform independent visual review and document evidence.**
  - Capture screenshots at desktop (1440px+) and mobile (390px) for Start, source/setup, drum loaded/empty pads, Library, transfer, and Devices disabled/connected test fixture state.
  - Use Genspark as an independent design-critique pass over screenshots and the approved spec; it must flag dead space, accidental TE copying, semantic color misuse, and responsiveness. It does not edit the repository and does not establish functional MIDI proof.
  - Record the command/screenshot paths, visual findings, and any remaining manual hardware validation boundary in `docs/visual-qa/2026-09-22-studio-system-visual-qa.md`.

## Execution Notes

- Implement sequentially because the shell, CSS cascade, and existing user-owned dirty changes overlap heavily. Native execution is recommended for the implementation pass; use Genspark only as an independent read-only visual critic after screenshot capture.
- Keep commits out of this phase unless the user separately authorizes a specific commit scope after reviewing the changes.
