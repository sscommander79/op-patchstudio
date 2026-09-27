# OP–PatchStudio Studio System — Visual-Only Design

**Status:** candidate design approved in conversation; implementation plan pending review.

**Scope:** visual redesign only. This document does not authorize a MIDI-mapping feature, device-profile behavior, audio-processing change, persistence migration, route change, dependency change, release, commit, or deployment.

## Product intent

OP–PatchStudio is an independent, local sound-creation workspace for preparing and managing OP-compatible preset material. The redesign must make the application feel like one precise instrument utility instead of a generic dashboard, while preserving all established workspaces and their behavior.

The application is not affiliated with, endorsed by, or sponsored by Teenage Engineering. The design may learn from contemporary electronic-instrument principles—functional color, tactile controls, compact information, and restraint—but must not reproduce Teenage Engineering marks, typefaces, product imagery, key geometry, iconography, layouts, or claims of affiliation.

## Approved visual direction

### The Studio System

- **Flat, technical application structure.** Pale warm-gray canvas and surfaces; thin graphite rules; dense but readable information; no glass, gradients-as-decoration, purple AI styling, floating SaaS cards, large empty framed regions, or fake browser chrome.
- **Tactile controls as a deliberate exception.** Interactive pad and key controls may have modest rounded corners, a one-to-three-pixel physical press depth, and restrained inset/highlight treatment. The rest of the UI remains flat.
- **Molded drum-key language.** Drum pads sit in a darker-gray tray. Their original rounded visual form is not a reconstruction of OP–1 field or OP–XY hardware. The existing names, computer-key mapping, and lower/upper pad banks remain unchanged.
- **Truthful state.** Any visualization must represent current data or a clearly empty/loading/error state. The visual layer must not fabricate project history, successful MIDI transmission, a hardware test, a loaded sample, or a generic device mapping.
- **Natural-height landing page.** The Start page ends after its genuine actions. It must not reserve a blank “project area” unless a later authorized data-backed project list exists.

## Color and type roles

These values are role suggestions, not claims about any other company’s palette. Exact contrast must be verified against the final local type and theme implementation.

| Role | Token intent | Suggested value | Usage |
| --- | --- | --- | --- |
| Workspace canvas | warm pale gray | `#F1F0EB` | Page background and broad working surfaces |
| Surface | soft off-white | `#FBFAF6` | Panels and editable areas |
| Structural ink | graphite | `#151615` | Text, rules, active navigation |
| Instrument tray | dark neutral gray | `#777873` | Containment for tactile keys/pads only |
| Signal display | near black | `#101112` | Actual live technical state, never generic decoration |
| Route / loaded / connected | cyan | `#16BEE8` | Loaded pad LED, verified connection, true route state |
| Selected / active capture | orange | `#FF5A1F` | Selected drum pad and real active capture state |
| Failure / destructive | red | `#FF3D38` | Actual failure, destructive confirmation, or explicit error |

Keep the existing local font asset unless the implementation review finds a documented reason to change it. Use a compact technical treatment—such as the existing monospaced utility styling—for stable values, key labels, timestamps, and state labels; do not replace all product type with a typeface imitation.

## Shared primitives

| Primitive | Purpose | Behavior boundary |
| --- | --- | --- |
| Application header | Brand, primary destinations, compact system status | Navigation targets retain current behavior |
| Tool strip | Secondary workspace destinations | No new routes or functionality |
| Route heading | Title, purpose, current scope, restrained actions | Existing action callbacks remain unchanged |
| Technical module | A compact action entry with a meaningful diagram | Must route only to existing workspaces |
| Signal display | Near-black panel for current live technical data | No fake MIDI/send/record evidence |
| Ledger/table | Dense library, sample, and event information | Existing table data, filters, and preview behavior remain unchanged |
| Molded key | Original tactile pad/key control in a tray | Existing keyboard, MIDI, focus, and click semantics remain unchanged |
| State marker | Text plus small cyan/orange/red indicator | Color never becomes the sole state signal |

## Route application

### Start

The Start page is a natural-height launch surface with current behavior preserved:

1. **Multisample a synth** uses a compact note/velocity diagram and keeps its current task selection callback.
2. **Sample a sound** uses a compact waveform/capture diagram and keeps its current task selection callback.
3. **Build a drum kit** uses a pad-grid diagram and keeps its current task selection callback.
4. **External gear** may be promoted as a visual entry only to the existing Devices workspace. It must not introduce generic CC-mapping behavior or represent it as tested.
5. Existing Library and Back up/transfer actions remain secondary entries. Do not render synthetic “recent projects.”

### Create and setup

Current source and setup stages retain their current choices, instructions, guard behavior, and editor transition. The redesign adds a clear stage hierarchy and reduces decorative containers; it does not consolidate, skip, or reorder a workflow step.

### Multisample and drum editors

Editor controls, project toolbar, tabs, tables, and modals preserve all existing semantics. The redesign establishes a consistent header, technical ledgers, tray-contained tactile controls, and state treatment around them.

### Library and transfer

Library data, preview, search, filters, project archive, import, and export behavior are unchanged. The redesign improves information hierarchy only.

### Devices and recording

The existing Devices and recording surfaces may receive Studio System styling but no new MIDI message, mapping, setup persistence, profile, route lease, hardware test, or recording behavior. A black signal display is allowed only for real observed connection/recording state. Before the user completes a separate MIDI mapping test, no component may present a generic device mapping as verified.

## Drum-pad component contract

The lower bank preserves the current labels and computer-key associations:

| Top row | Bottom row |
| --- | --- |
| `KD2 / W`, `SD2 / E`, `CLP / R`, `CH / Y`, `OH / U` | `KD1 / A`, `SD1 / S`, `RIM / D`, `TB / F`, `SH / G`, `CL / H`, `CAB / J` |

The upper bank remains the current twelve pads: `RC`, `CC`, `COW`, `LC`, `HC`, `LT1`, `MT`, `HT`, `TRI`, `LT2`, `WS`, and `GUI`.

The visual state vocabulary is:

- **Empty:** neutral molded key, `EMPTY` text, neutral dot.
- **Loaded:** neutral molded key, `LOADED` text, cyan dot.
- **Selected:** orange molded key, `SELECTED` text, explicit selected-panel detail.
- **Pressed:** transient one-to-three-pixel key depression only; never replaces keyboard focus treatment.

This component preserves click selection, computer-key playback, MIDI playback, lower/upper-bank selection, arrow-key focus movement, existing ARIA labels, and mobile behavior.

## Responsive and accessibility requirements

- The desktop layout must remain effective at 1024px width; tool strips may scroll horizontally rather than wrap into ambiguous controls.
- On narrow screens, pad banks use their existing accessible lower/upper-bank behavior. The visual treatment must not reduce touch targets below current supported dimensions.
- Visible keyboard focus remains distinct from selection and pressed state.
- Every cyan, orange, or red indicator has adjacent readable text or an accessible label.
- Text and controls meet WCAG 2.1 AA contrast requirements after real theme/token integration.
- Motion is limited to immediate control feedback and honors reduced-motion preference.

## Visual acceptance criteria

1. Every revised route uses the Studio System tokens and shared primitives; no route reintroduces the dark-green side rail.
2. The Start page has no blank interior area after its real actions and no invented project data.
3. Start actions continue to open the same current flows and workspace transitions.
4. Drum labels, indices, computer-key associations, MIDI map, selection, audition, ARIA labels, and mobile banks remain unchanged.
5. A loaded or selected color state always has explicit text and survives keyboard focus.
6. No UI screen uses Teenage Engineering trademarks, logo, distinctive visual asset, exact key construction, or an affiliation claim.
7. Devices shows only actual state; no generic MIDI mapping is displayed as tested before user acceptance.
8. Desktop and narrow screenshots show no clipping, unintended dead in-app space, broken borders, or unintentional overflow.
9. Existing unit, component, and end-to-end behavior tests remain green, with targeted visual/component coverage added for changed presentation.

## Source grounding

- Teenage Engineering’s official OP–XY page describes its black exterior and grayscale center; the design uses this only as evidence for a restrained neutral structural direction, not as an asset or layout to copy.
- Teenage Engineering’s official Field System page describes a connected portable instrument system; the design uses this only as a product-context reference for compact functional information design.
- Genspark research task `PatchStudio visual language research` was used as an independent critique. Its external non-official commentary is not treated as normative design evidence; implementation follows the boundaries and original design decisions in this document.

## Next gate

After the user reviews this specification, create a file-by-file implementation plan. No product source changes begin until that plan is reviewed and approved.
