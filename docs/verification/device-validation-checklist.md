# Physical OP-XY validation checklist

Status: **not performed**. This checklist requires an actual OP-XY and must remain pending until evidence includes the device firmware version, transferred files and observed results.

| Check | Required evidence | Status |
|---|---|---|
| MTP transfer | Computer/OS, OP-XY firmware, COM then M4 connection and copied `.preset` folder | Pending |
| Drum import | Sparse and full 24-pad presets load with the intended sample on each mapped pad | Pending |
| Multisample import | Root notes, ranges, pitch direction and sample selection match the exported `patch.json` | Pending |
| WAV and AIFF audio | Device accepts each generated format/rate/depth/channel combination claimed by the UI | Pending |
| Frame markers | Start, end and one-frame boundary fixtures play without rejected or shifted bounds | Pending |
| Loop modes | Loop off, loop forever and loop until release match the device behavior | Pending |
| Crossfade | Several exported fractions, including a retained imported value above the preview editor limit, are compared on device | Pending |
| Engine settings | Transpose, velocity, width, envelopes, modulation, tuning and portamento match the exported raw values | Pending |
| Size limits | A near-limit preset imports and an over-limit preset remains blocked before download | Pending |
| Recording source | A recorded take transferred through the normal export route loads and plays | Pending |
| Repeated export | Edit, export again, replace the folder and confirm the newer content is loaded | Pending |
| Eject/reopen | Eject with M4, reopen the preset after device restart and confirm persistence | Pending |

Automated browser playback is useful regression evidence but cannot complete any row above. Record subjective listening observations separately from byte, frame and settings checks.
