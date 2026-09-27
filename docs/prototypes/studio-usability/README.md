# Studio usability prototype

A standalone interactive design for review. It does not change OP-PatchStudio, access audio/MIDI, read dropped files, save presets, restore backups, or transfer to hardware. All example sounds and capture states are illustrative.

## Agreed navigation

- Multisample a synth: choose hardware or software, configure MIDI notes and audio return, check routing, capture multiple notes, review mapping, save and prepare transfer.
- Sample a synth: choose hardware or software, configure audio input, record a single sound/phrase/performance, trim, save. MIDI is optional.
- Build a drum kit: import, record or slice sounds, assign pads, edit, save.
- Open your library: find saved presets and collections.
- Back up or transfer: separate editable library protection from device preset delivery.

Hardware/software is the second decision after the creative task. Equipment-specific examples must remain optional. Software synths run in the user's DAW; this browser app does not host VST instruments.

## Design goals

Give first-time users a clear starting point and next action. Use a compact persistent application shell, three prominent creation choices, secondary library/management actions, and a visible Help entry. Use progressive disclosure for advanced controls. Support hover/focus and click/tap explanations, help search, clear dismiss behavior, and useful drop-target instructions. Fit desktop and narrow screens without hiding essential actions.

## Product boundaries

The prototype proposes complete library backup/restore with audio, metadata and collection membership, a restore preview and explicit duplicate handling. Those capabilities have not yet been implemented in the working app. Guided device transfer must distinguish creating a download from copying it to the OP-XY. Direct USB transfer remains a separate feasibility task.

## Review checklist

- Can a new user distinguish Sample from Multisample and identify hardware/software setup?
- Does each path explain the needed audio and optional/required MIDI routing?
- Are help and contextual explanations discoverable by mouse, keyboard and touch?
- Are simulated states unmistakable, without claims of real recording, backup or transfer?
- Do desktop and narrow layouts make the next action visible?

## Validation

Browser smoke review on 2026-09-18 covered:

- Hardware and software setup for both single sampling and multisampling; optional versus required MIDI guidance.
- Hardware multisample example through capture, editing, save preview and transfer guide.
- Single-sample capture presentation, drum slicing choice and pad interaction.
- Library search, backup contents and restore previews, and disabled real transfer/backup controls.
- Searchable Help, contextual click explanations, and keyboard dismissal. Fixed and retested filtered Help focus wrapping and drum-pad assignment labels.
- Desktop appearance and 390 × 844 home/drum layouts; measured document width matched viewport width with no horizontal overflow.

This is a prototype smoke review, not a full accessibility audit or functional audio, backup, or device-transfer test. No working-app files or library data were changed. Drag/drop behavior was source-reviewed; actual file dropping was not exercised.
