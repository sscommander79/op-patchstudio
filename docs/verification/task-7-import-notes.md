# Import work: upstream contribution review and requirements

Read-only review of https://github.com/joseph-holland/op-patchstudio/pull/113 (2026-09-04). The PR centralizes audio extension checks and extracts file-kind DataTransferItem handles synchronously before async directory traversal, handles repeated readEntries batches, falls back to DataTransfer.files, and updates drum/multisample/table drop targets. This is useful prior work; preserve eimerreis attribution if adapting it.

Integration requirements beyond copying the patch:
- Never swallow directory errors as a successful empty import. Return a structured result with files, unsupported items and failed items, then show a concise summary.
- When some items resolve and others fail, retain fallback files for failed items without deduplicating distinct same-name samples. File identity cannot be filename alone; use captured object/entry identity and resolved metadata carefully.
- Capture item handles synchronously while the drop event still grants access. Preserve stable traversal/input order and bound concurrent reads.
- Do not interpret internal sample move payloads as external imports. Preserve copy/move indicators.
- Imported files fill empty slots by default, retaining overflow in the unassigned tray. Destructive replacement requires an explicit destination/action.
- Drum name suggestions are deterministic and explainable: common kick/kd/bd -> first free kick slot; snare/sd -> snare; clap/clp -> clap; closed/open hats disambiguated before generic hat. Present proposed assignments before applying. Unknown names fill remaining free slots in input order. Never overwrite occupied slots silently. MIDI/note name detection for multisamples remains intact.
- Validate content/decode results and visibly report failures, including zero-byte/unsupported files. Do not claim actual desktop Splice compatibility from synthetic payload tests alone.

Acceptance: synthetic DataTransfer items/Finder fallback/nested repeated directory batches/missing MIME/partial read failure/internal moves; real browser file picker/drop upload; duplicate basenames retained through export; suggestions apply as one undoable action and can be canceled.

PR #114 reviewed concurrently: useful unit-test CI, imported drum state-key correction and immutable library sorting. Task 1 and 2 own the latter fixes; CI task should incorporate tests/build/lint/browser gates only once each passes, with branch-protection configuration described separately from repository workflow files. No PR was merged or branch rule changed.
