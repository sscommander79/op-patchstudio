# Follow-up: source fidelity and Keep original rate semantics

Source: Claude static review F2/FOLLOWUP A3, 2026-10-02. Pre-existing behavior; not changed by the CI portability repair.

`readWavMetadata` in `src/utils/audio.ts` and browser-decoded formats in `src/utils/audioFormats.ts` use the realtime device context. Native decoding can therefore resample a source WAV/AIFF to the output-device rate. Source metadata and encoded bytes are retained separately; editing coordinates and portable audio assets use the decoded buffer rate.

`src/utils/exportPlanning.ts` currently chooses the decoded rate without conversion, but original source metadata when other conversion (such as normalization) is requested with no explicit target rate. This makes Keep original output rate dependent on another processing option. Exact48k-to44.1k output bytes are tested; equivalent device-default44.1k export fidelity needs its own regression.

Recommended separate scope: define Keep original rate/fidelity behavior, test48k source on44.1k and48k contexts with normalization on/off and explicit output rates, then decide whether to preserve source-rate decoding with offline contexts. Include WAV/AIFF and unsupported source rates, marker/provenance coordinates, restoration compatibility, and source-byte preservation. Do not claim an offline decode change restores already-resampled project assets.

No data loss or changed original source bytes were demonstrated by this review. No decoding architecture change is included in this CI repair. This is an open, concrete follow-up rather than release acceptance.
