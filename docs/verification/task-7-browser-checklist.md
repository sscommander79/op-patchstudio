# Task 7 controller browser acceptance

Prepared while Sol implements; this is a test plan, not delivered behavior. Root owns browser/server execution after source/tests/config freeze.

## Real codec baseline

Original fixtures and provenance are in `/tmp/opstudio-task7-codec-fixtures`; worker will copy into repository fixtures. Seven fixtures total roughly71KiB, generated from an original9600-frame48kHzmonoPCM16 test signal, no external samples. `browser-decoding-baseline.json` records direct browser decodeAudioData results, not application integration.

- WAV/FLAC/MP3/OggOpus/OggVorbis decode in all three installed engines.
- M4A decodes in Firefox/WebKit; installed headlessChromium returns EncodingError. Show conditional support/failure honestly.
- AIFF direct browser decode fails Chromium/Firefox, succeedsWebKit; the existing application's manual AIFF path must remain functional.
- Lossy framecounts differ: Vorbis10240Chromium/9600Firefox/9472WebKit, MP3 9600Chromium+Firefox/11520WebKit. Derive expectations from actual decode; do not assert exact original duration or identical lossy PCM across engines.

## New browser workflows

1. Actual drum chooser/batch: knownkick/snare names, ambiguousname, two same-name/different-byte assets, corruptfile. Verify visible accepted/rejected reasons, optional suggestions/corrections, no change before Apply, explicit occupied-pad protection, exact applied/retained counts. Download .opstudio and deviceZIP, assert distinct source bytes/references, actualdecodedframe metadata, oneUndo/Redo.
2. External drum drop and multisample chooser/drop: genuine DataTransfer File objects through actual handlers; plain path/URL-only payload gives chooser fallback and no network fetch. Internal move remains exclusive from external intake. Preserve physicaltarget/note intent.
3. Bounded directory fixture: repeated child batches, deterministic order despite delayed resolution, inaccessibledirectory alongside valid file, same metadata/different contents preserved. A real chooser remains available when directory APIs absent. Syntheticpayload coverage is not realFinder/Splice certification.
4. Cancellation: delay a captured entry/file resolution or decoder boundary through a test-owned fixture, cancel/replace operation, release late completion. No stale review reopening, no state/history change. Prefer actual exposed shared intake boundary over production test hooks.
5. Codec batch: all seven original fixtures through actual app, validunsupported M4A reason per currentengine. Preserve AIFFfallback. Portable backup retains exact originalfile bytes; unknown source bitdepth remains unknown after open/library/recovery. Export actual WAV/AIFF with chosenconversion and matchingheaders/patch framebounds.
6. Both actual patch.json caller routes: valid unknown raw settings preserved/exported, invalid knownshape/prototype/numericoverflow leaves name/settings/audio/history unchanged and visibleerror. Existing accepted precision/crossfade tests remain.

## Coordination

Finalize actual accessible labels/flow with implementer before assertions. If accepted intake intentionally adds a review step, update existing file-upload helpers to complete that step explicitly; do not bypass new validation through context dispatch. Preserve existing95 browser scenarios and add compact high-value cases. Run localized new cases then full matrix once on frozen source. Fake recordingdevice gate remains separate. Task9 will investigate the existing intermittentFirefoxlibrary confirmation case; no blanketretries.

## Additional source-rate fixture

`original-44100.wav` and `sample-44100.mp3` add a known44.1kHz source (8820originalPCMframes), bringing fixtureinventoryto9. Allthreeengineswith48kHzAudioContext decodeWAVto9600frames/48kHz; MP3to9600Chrome+Firefox and11284WebKit. `source-rate-decoding-baseline.json` recordsactualresults. Application/persistence must notmislabeldecoded48kHz asoriginal44.1kHz; preserveverifiedsourceinformationorhonestunknown separately. ThisextendsTask7's existingtruthfulmetadata requirement, notahardwarecalibrationclaim.
