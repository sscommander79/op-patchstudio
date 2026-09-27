# Production verification harnesses

Run from the repository with dependencies and matching Playwright browsers installed. Build the app, then start a separate production preview at http://127.0.0.1:5188:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 5188 --strictPort
```

In another terminal:

```sh
node docs/verification/harnesses/task-8-demo-proof.mjs
node docs/verification/harnesses/task-8-focus-proof.mjs
```

These harnesses exercise the rendered production UI in Chromium, Firefox and WebKit, using fresh isolated browser contexts and actual downloaded archives. Demo proof rewrites demo-audio artifacts and verification.json. Focus proof rewrites task-8-focus-browser-proof.json and instruments actual AudioBufferSource start/stop calls to verify loop/cleanup behavior; it does not assess audible quality.

Both original harness executions passed at Task8 round1. The retained copies change only repository path resolution and were syntax checked. They require the preview server above; they do not start or stop it. No physical device or real microphone is used.

Both retained harnesses were executed again serially against the frozen Task 9 production build on 2026-09-05. Demo and Focus passed in Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6. The Task 9 run logs and exact harness snapshots are retained in `docs/verification/task-9-final-evidence/`; the refreshed machine-readable results remain `docs/verification/demo-audio/verification.json` and `docs/verification/task-8-focus-browser-proof.json`.
