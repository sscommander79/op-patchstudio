# Isolated main-app Serum integration

Build from the repository root with `bash desktop-instrument/build.sh`.
The output is `~/Library/Caches/OP-PatchStudio/SerumIntegration/OP-PatchStudio Serum Integration.app`.
This development build uses an independent bundle identity and localhost port 5220. It does not deploy or replace another app.

The native host serves the main app, opening its software-instrument workspace. The existing browser, drum, hardware and file-import paths remain available. Only the desktop host exposes the Audio Unit bridge. Serum's AUv2 editor and internal rendering are the previously proved path; no VST or Ableton-native hosting is added.

Choose instrument → choose sound → range and spacing → multisample → export. Advanced is optional. Export uses the macOS save dialog. Captured audio participates in the main app's existing project recovery and portable backups. The recovered recording can be exported without reloading its plug-in; choose the instrument again to make a new recording.

Local capture evidence is kept in `~/Library/Application Support/OP-PatchStudio Serum Integration/Captures`. Plug-in state files there are diagnostic snapshots, not a portable project dependency. Project audio is saved separately by the main app.

This build is ad-hoc signed for local review. Production signing/notarization, robust plug-in crash containment and broader compatibility qualification remain release work. The installed Serum demo's normal licensing restrictions still apply.
