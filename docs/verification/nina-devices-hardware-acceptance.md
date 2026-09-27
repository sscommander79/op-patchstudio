# NINA Devices hardware acceptance

Status: **NOT PERFORMED — USER COMPLETION REQUIRED.**

This packet records physical Melbourne Instruments NINA behavior. The automated Chromium fake-MIDI test does not prove that NINA received a message, moved a control, sounded correct, isolated another physical device, or recovered safely after a cable disconnect. Do not mark this packet accepted until every required item below has a user-observed result.

## Run record

| Field | User entry |
|---|---|
| Tester |  |
| Timestamp and time zone |  |
| Computer / operating system |  |
| Browser and exact version |  |
| OP–PatchStudio build / commit |  |
| NINA firmware version |  |
| Selected NINA MIDI output name exactly as shown |  |
| NINA layer / actual receive channel |  |
| Second connected MIDI device and output name |  |
| Audio monitoring path used for observation |  |
| Overall result: PASS / FAIL / BLOCKED |  |
| User-observed outcome summary |  |

## Safety and setup

- [ ] I confirmed that the selected NINA layer is on the actual receive channel recorded above; I did not assume channel 1.
- [ ] I lowered monitoring volume to a safe level and chose a patch where filter and level changes are easy to hear.
- [ ] I connected a second MIDI device or virtual output so destination isolation can be observed.
- [ ] In NINA, I set **SYSTEM → GLOBAL SETTINGS → MIDI Echo Filter = Echo Filter**, specifically **not Filter All**, so incoming filter CC changes can be observed.
- [ ] Before clicking **Enable MIDI**, opening **Devices**, changing desired values, and saving/loading/importing a setup produced no audible or visible hardware change.

Setup notes / observed outcome:

> 

## First physical control check: Cutoff 64

Run this safe test before Patch Volume, Resonance, or Drive. Start from the selected NINA output and actual layer channel recorded above.

| Exact tested identity | User entry |
|---|---|
| Output name exactly as shown |  |
| Actual NINA layer / MIDI channel |  |
| Controller | **CC 29** |
| Value | **64** |
| User-selected outcome: Confirmed / Not observed / Skip |  |
| User-observed local outcome |  |
| Result: PASS / FAIL / BLOCKED |  |

- [ ] Before sending, the Hardware test summary showed the exact output and channel recorded in this table, plus CC 29 and value 64.
- [ ] I checked the Echo Filter acknowledgement and clicked **Send test** exactly once.
- [ ] The UI receipt beginning **Tested: Output** exactly matched the tested output, channel, CC 29, and value 64 recorded above.
- [ ] I recorded one explicit UI outcome: **Confirmed**, **Not observed**, or **Skip**.
- [ ] I understand that this outcome is only my local observation; it is not automatic proof that NINA received or applied the message.
- [ ] I compared the MIDI monitor before and after choosing the observation outcome. Recording the outcome sent no additional MIDI, relayed no incoming MIDI, and left the single Cutoff test as the only new outgoing event.
- [ ] I verified the second connected device did not change during the Cutoff 64 test or while I recorded the observation.

Cutoff receipt / monitor evidence and local observation:

> 

## Remaining physical control checks

Only after completing Cutoff 64, change one desired value at a time, use that parameter's explicit **Send** button, and record what NINA actually does.

| Check | Required message | Sent value | Exact output / channel | User-observed NINA outcome | Result: PASS / FAIL / BLOCKED |
|---|---|---:|---|---|---|
| Patch Volume | CC 7 on the recorded channel |  |  |  |  |
| Resonance | CC 28 on the recorded channel |  |  |  |  |
| Drive | CC 30 on the recorded channel |  |  |  |  |

- [ ] I verified the MIDI monitor showed the intended outgoing bytes and destination for each explicit send.
- [ ] I used **Preview Apply**, verified output/channel plus CC 7/28/29/30, and confirmed that preview alone sent nothing.
- [ ] If I used **Confirm Apply**, I observed all four changes only after confirmation and recorded any partial or failed sequence.

Remaining CC receipt notes / observed outcome:

> 

## Second-device isolation

- [ ] With NINA selected, I sent Cutoff 64 and verified the second connected device did not change or receive the action.
- [ ] I selected the second output without sending and verified selection alone changed neither device.
- [ ] I re-selected NINA explicitly before any later NINA send.

Second-device evidence (device name, activity indicator/monitor used, and observed outcome):

> 

## Capture route lock and unlock

Use the same recorded NINA output for automatic sampling or track capture. This check is about route ownership, not audio quality.

- [ ] I started capture on the same NINA MIDI output and confirmed that the capture workflow owned that route.
- [ ] While that route was owned, a Devices send attempt was rejected as busy and produced no additional NINA or second-device message. If the current UI did not permit a concurrent attempt, I recorded this item as **BLOCKED**, not PASS.
- [ ] I stopped or cancelled capture and confirmed its MIDI route was released.
- [ ] After unlock, Devices still required an explicit output selection/action as presented by the UI; one deliberate Cutoff 64 send reached only NINA.
- [ ] Stop/cancel left no held note or continuing MIDI activity.

Capture lock/unlock evidence (capture type, busy message, monitor delta, and observed outcome):

> 

## Disconnect and reconnect without retargeting

- [ ] With NINA selected, I disconnected the NINA MIDI cable or powered off its MIDI connection.
- [ ] The selected route became unavailable, Devices disabled send actions, and no extra MIDI message was emitted.
- [ ] The second output remained unchanged and was not selected automatically.
- [ ] I reconnected NINA and verified the app did not silently retarget a similarly named or different output.
- [ ] I explicitly selected the reconnected NINA output again before sending.
- [ ] One deliberate Cutoff 64 send after re-selection reached only the intended NINA layer/channel.

Disconnect/reconnect evidence (port names before/after, monitor counts, and observed outcome):

> 

## Acceptance decision

- [ ] Every required checkbox above is complete, with no item inferred from the automated fake-MIDI test.
- [ ] Any FAIL or BLOCKED item is listed below with reproduction details.
- [ ] I accept this exact browser, NINA firmware, output, and layer-channel combination for the tested Devices workflow.

Final result: **PASS / FAIL / BLOCKED**

Open findings and user-observed outcome:

> 

Tester signature / initials: ____________________

Completion timestamp: ____________________
