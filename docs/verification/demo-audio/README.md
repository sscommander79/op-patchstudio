# Studio Seed audio verification artifacts

Production browser proof passed in Chromium 139.0.7258.5, Firefox 140.0.2 and WebKit 26.0. See verification.json and ../harnesses/task-8-demo-proof.mjs.

Each engine checked all 134,505 exported PCM samples against the expected 16-bit quantization, exact frame counts, mono 44.1 kHz format, and the ten physical pad mappings. Two fresh generations per engine produced identical source bytes. Backup reopening preserved source PCM and source identities exactly. Observed cross-engine Float32 difference was zero; the supported comparison tolerance remains 1e-6.

The ten WAV files total 269,890 bytes, including actual 88-byte headers. Studio-Seed.opstudio is the 1,087,530-byte editable backup; Studio-Seed-device.zip is the 276,080-byte device export. These are distinct formats.

Sounds are original mathematical synthesis described in ../demo-kit-design.md. Numerical verification does not establish subjective sound quality. Human listening, assistive-technology testing and physical device validation remain unperformed.
