# WebKit storage isolation

2026-09-04, during Task2. Full browser storage matrix:15 passed (Chromium,Firefox,MobileChrome);10 failed (all five cases in WebKit and MobileSafari profiles), /tmp/opstudio-task2-browser-matrix.log. These are Playwright engine profiles, not physical Safari/iPhone certification.

Isolated raw IndexedDB writes on an otherwise blank same-origin page, without application code or autosave. Harness /tmp/opstudio-webkit-idb-probe.mjs, output /tmp/opstudio-webkit-idb-probe.log.

| Value | WebKit | Chromium |
|---|---|---|
| Plain object | Pass | Pass |
| ArrayBuffer | Pass | Pass |
| Text Blob | Abort | Pass |
| Float32 payload Blob | Abort | Pass |
| File | Abort | Pass |
| File.slice Blob | Abort | Pass |
| Blob copied from File bytes | Abort | Pass |

Every failing request reports UnknownError: `Error preparing Blob/File data to be stored in object store`. The File-only hypothesis is disproved: conversion to Blob alone does not fix this environment. ArrayBuffer storage is demonstrated to work.

The same message has a [historical WebKit bug report](https://bugs.webkit.org/show_bug.cgi?id=188438), marked fixed; that report does not establish the cause or prevalence on current physical Safari. We must not infer universal Safari failure from this harness.

Task2 should choose a minimal portable binary persistence representation or proven capability fallback, prepare data outside transactions, preserve legacy Blob records and public codec APIs, and rerun actual browser workflows. Do not weaken transaction-completion semantics to hide failed writes. Document cache/performance tradeoffs and device-verification limits.

## Resolution verified
Task2 now prepares cached ArrayBuffer envelopes outside transactions and reconstructs Blob/File values at public reads. Legacy native-Blob rows remain readable. Fresh WebKit5/5 and combined browser40/40 passed (/tmp/opstudio-task2-final-browser.log); unit482/482 and build pass. Physical Safari remains untested.
