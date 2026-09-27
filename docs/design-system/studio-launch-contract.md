# Studio launch and drum workbench: design contract

**Status:** candidate. Implemented 2026-09-26/27 against the user-supplied launch references. **Not design-approved** and not release-ready.

This contract states what the launch surface and drum workbench must keep. Automated checks enforce it in two independent layers:

- **Semantic and layout contract:** `tests/e2e/studio-design-contract.spec.ts`, plus `tests/e2e/studio-shell.spec.ts` and `tests/e2e/drum-pad-access.spec.ts`. These run in the ordinary Playwright suite and in CI. They measure the DOM, so a re-recorded screenshot cannot approve a structural regression.
- **Reviewed pixel baselines:** `tests/visual/studio-visual.spec.ts`, 12 images. They cover launch, the empty drum workbench and the Studio Seed drum workbench, each at desktop 1440×1000 and narrow 390×844, in light and dark.

## 1. Header and navigation

- One horizontal application header with one brand (`.studio-shell-brand`). There is no sidebar and no second brand header.
- One navigation landmark, **Workspace:** Overview · Create · Library · Transfer · Devices, all on one row at desktop. No Tools row.
- Outside Overview, a compact noninteractive "Studio / …" breadcrumb remains below the header to identify the current editor or page. Overview uses its current navigation item and heading.
- At narrow widths primary navigation scrolls horizontally; Help and current location remain visible.

## 2. Routes (all existing links keep working)

| Route | Shows |
| --- | --- |
| `#/studio/overview` (default) | Unified launch surface |
| `#/studio/create` | Guided setup chooser: "What would you like to make?" → source → setup |
| `#/studio/drum`, `#/studio/multisample`, `#/studio/library` | Editors and Library |
| `#/studio/transfer` | Back up or transfer |
| `#/studio/devices` | Devices (External gear) |

## 3. Unified launch surface (Overview)

The hierarchy runs top to bottom:

1. The h1 "What are you working on?" with a local-storage note.
2. One row of four equal task modules on wide screens; two columns at 641–1050px and one column at ≤640px.
3. The External gear strip.
4. The secondary shortcuts.
5. A local-save footer line.

- **Modules**, in order: Multisample a synth · Sample a sound · Build a drum kit · Record OP-XY tracks.
  - Each is an `article` with an h2, a diagram, a footer status and one bordered call to action. The first three retain subordinate Setup guide links; the recording card opens its existing guided recorder.
  - At desktop the four share a top edge (±2px), width (±4px) and height (±2px).
- **Diagrams** are SVG `role="img"` elements with descriptive names. Each is at least 96px tall, fills at least 85% of its module's width and takes at least 30% of its module's height.
  - **Note range:** a vertical keyboard plus 24 zone columns. Loaded zones are filled cyan from project data.
  - **Capture:** a waveform spanning most of the diagram width, a dotted review marker intersecting its fading tail, and a baseline. REVIEW remains legible above/right of the marker.
  - **Pad illustration:** six colored percussion pictograms in two rows × three columns, aligned with the left edge of its heading and occupying nearly the diagram width. No slot numbers or live-state claims. The actual editor retains 24 slots and the footer independently reports its real loaded count.
  - **Track recording:** eight separate schematic audio lanes and a dashed marker. It illustrates the workflow without implying recording is active.
  - Live loaded counts and note zones reflect project data. Capture and drum artwork are clearly identified workflow illustrations, not live state.
- **Calls to action:**
  - **Open recorder** (accessible name "Record OP-XY tracks") opens the existing guarded, lazy-loaded recorder; no audio/MIDI permission request until explicitly enabled inside it.
  - **Open kit** opens the drum editor directly, with no setup step and no dialog.
  - **Open capture** opens the multisample editor with guided Record takes.
  - **Open sampler** opens the multisample editor with manual Record takes (capture mode is focused).
  - **Setup guide: …** links (subordinate, optional) open the existing guided setup at the matching step.
  - Inside the drum editor, the optional **Kit setup guide** disclosure carries the same drum steps.
- **External gear strip:**
  - A dark strip (background luminance < 0.15) spanning the module row, shorter than a module.
  - One button, named "External gear Open devices", that routes to Devices.
  - The MIDI CC → Synth → State chips describe the workflow only. They never show connection state.
- **Secondary shortcuts:** "Open library …" and "Back up or transfer …" sit side by side under the strip and are shorter than it.
- **Compactness:** the whole launch surface fits in a 1440×1000 viewport.
- **Keyboard:** from the focused h1, Tab visits the controls in this order:
  1. Setup guide (multisample), then Open capture
  2. Setup guide (sample), then Open sampler
  3. Setup guide (drum), then Open kit
  4. Record OP-XY tracks
  5. External gear
  6. Open library
  7. Back up or transfer

  Every stop shows a focus outline, and Enter activates.
- **Narrow (390px):** modules stack in one column. Every launch button is at least 44px tall and inside the viewport. Footer status text is never clipped. There is no horizontal overflow.

## 4. Drum workbench

- **Desktop (1024 and 1440):**
  - The stacked lower and upper pad banks sit on the left.
  - The selected-pad editor sits on the right, with the same top edge (±2px).
  - The performance column is at least as wide as the editor.
- **Compact header zone:**
  - The project toolbar is a single row, ≤64px tall.
  - The Studio Seed strip is ≤64px.
  - The workbench starts within 90px of the toolbar.
  - The note "Project backup keeps editable audio and settings…" lives in the Project menu.
- **Pad state labels:**
  - LOADED and SELECTED stay visible under pads.
  - EMPTY is hidden visually (`clip-path`) and never repeated under empty pads.
  - Every pad's accessible description is its state: EMPTY, LOADED or SELECTED.
  - Pad accessible names are unchanged, for example "KD1 drum key A".
- **Tray header:**
  - The loaded count ("0 / 24 loaded") has at least 4.5:1 contrast on the tray header.
  - The help icon has at least 3:1.
  - The check icon appears only when at least one pad is loaded.
  - The region name stays "Drum pad instrument, N of 24 loaded".
- **Toolbar save state:** at least 4.5:1 contrast.
- **Empty selected pad:** the panel is ≤150px tall at desktop. The loaded waveform editor is unchanged.
- **Collapse:** at 900px and 390px the editor sits below the performance column, with no horizontal overflow.
- **Deferred:** the graphic key/pad shape is unchanged by user decision.

## 5. Semantic colour

| Colour | Means | Never used for |
| --- | --- | --- |
| Cyan | Loaded or connected: pad LEDs, loaded zones, loaded status dots | Ordinary buttons, export, view toggles, focus |
| Orange | Selection or capture: the selected pad, the capture waveform, drag target | Ordinary actions |
| Red | Destructive actions (reset/clear accents) and errors | Anything else |
| Graphite / neutral | Ordinary actions: Export OP-XY, primary buttons, the Focus/Table toggle, current navigation | — |

The contract compares computed UI-state colours against the `--studio-system-*` tokens. User-approved exception: the decorative percussion illustration has its own five-color palette; these colors do not represent live state or recolor controls.

## 6. Build identity

- The document root carries `data-opstudio-version`, `data-opstudio-build` and `data-opstudio-mode`. The footer shows `v<version> · [dev ]build <last 8 characters of the build id>`.
- On loopback origins only, the app compares its build with `/__opstudio/build.json`, which only the dev server provides. When they differ, it shows a non-blocking notice. It never reloads the page and never clears storage.

## 7. Dev-origin stale worker guard

- `scripts/dev-stale-worker-guard.ts` runs only in the Vite dev server (`apply: 'serve'`). It never runs in production builds or `vite preview`.
- For loopback `Host` headers it answers `/sw.js` with a retiring worker. Extra hostnames are allowed only through `OPSTUDIO_DEV_SW_GUARD_HOSTS`. Setting `OPSTUDIO_DEV_SW_GUARD=0` disables it (used only to reproduce the fault).
- The retiring worker:
  - calls `skipWaiting`, then unregisters its own registration;
  - answers only same-origin `/assets/*` GETs, from existing caches, with `ignoreSearch` and `ignoreVary`;
  - never answers navigations;
  - never deletes caches, IndexedDB or localStorage, and never reloads or navigates a tab.
- The canonical dev origin is `npm run dev:studio`, which serves `http://127.0.0.1:5191`. `localhost:5191` is a different origin with separate storage.

## 8. Gates and failure behaviour

| Gate | Command | Where |
| --- | --- | --- |
| Unit and component tests (shell, pads, build identity, guard, host allowlist) | `npm test` | Local (`npm run check`) and the CI `quality-and-chromium` job |
| Semantic/layout contract | `npm run test:e2e:studio-contract`, and inside `npm run test:e2e:production -- --project=chromium` | Local and the CI `quality-and-chromium` job |
| Dev-origin recovery | `npm run test:e2e:dev-origin` | Local and the CI `quality-and-chromium` job |
| Pixel baselines | `npm run test:visual` | Local macOS and the CI `macos-visual` job (`macos-15`) |
| All studio gates together | `npm run verify:studio` | Local |

- In CI a missing baseline fails (`updateSnapshots: 'none'`).
- Tolerance is tight: per-pixel colour threshold 0.1 and at most 20 differing pixels. Local renders reproduce with zero drift.
- A visual failure uploads diff images (`visual-diffs` artifact) for a person to review.
- Baselines are recorded on this Mac (Darwin 25, Chromium from Playwright 1.63). The `macos-15` runner may render fonts differently. If the first CI run differs, a person must compare the artifact with these baselines before any runner-specific baseline is accepted.
- **Recommended required checks** for protected branches: `quality-and-chromium` and `macos-visual`. Branch protection is not configured by this change; nothing was pushed and no repository settings were touched.

## 9. Changing a baseline

1. Make the intended UI change and make sure the semantic contract still passes, or update it only for intended behaviour.
2. Run `npm run test:visual` and open every failing image's diff in `test-results/visual/`.
3. A person compares the new images with the approved references and records why the change is intended.
4. Re-record only the affected tests, for example `npm run test:visual -- -g "narrow" --update-snapshots=all`. Then run `npm run test:visual` twice to confirm the result reproduces.
5. Never run `--update-snapshots` to silence an unexplained failure.

These checks reduce regressions; they cannot rule them out. Anything outside the asserted properties (for example typography details, or states not captured) can still change unnoticed.
