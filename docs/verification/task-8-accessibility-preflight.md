# Task 8 accessibility preparation

Design-token calculation only, not a rendered audit or conformance claim. Prepared with the accessibility-review skill and verified W3C references. Reconcile final Task7 dialogs when implementing Task8.

## Proposed token contrast

| Theme | Pair | Ratio | Design use |
|---|---|---:|---|
| Light | Text #20251f / Panel #faf9f4 | 14.80:1 | Normal text |
| Light | Muted #596153 / Panel #faf9f4 | 6.11:1 | Secondary text |
| Light | Muted #596153 / Recess #e4e4dc | 5.04:1 | Secondary text |
| Light | Border #abb1a2 / Panel #faf9f4 | 2.09:1 | Required control boundary only |
| Light | Border #abb1a2 / Recess #e4e4dc | 1.72:1 | Required control boundary only |
| Light | Accent #d0ef62 / Panel #faf9f4 | 1.23:1 | Selection or focus indicator only |
| Light | Accent text #20251f / Accent #d0ef62 | 12.04:1 | Accent button label |
| Dark | Text #f3f3eb / Panel #222521 | 13.90:1 | Normal text |
| Dark | Muted #b8c0b1 / Panel #222521 | 8.28:1 | Secondary text |
| Dark | Muted #b8c0b1 / Recess #2c302a | 7.17:1 | Secondary text |
| Dark | Border #66715d / Panel #222521 | 3.02:1 | Required control boundary only |
| Dark | Border #66715d / Recess #2c302a | 2.61:1 | Required control boundary only |
| Dark | Accent #d0ef62 / Panel #222521 | 11.96:1 | Selection or focus indicator only |
| Dark | Accent text #20251f / Accent #d0ef62 | 12.04:1 | Accent button label |

Normal text uses4.5:1 minimum; required nontext identifying boundaries/states use3:1 against adjacent colors. Decorative separators need not carry control identification alone. The light border and light accent must not be the sole visible boundary/focus/selected-state cue. Dark border must be checked against the actual adjacent recess as well as panel. Use a tested stronger control-boundary token and a dual contrasting focus ring around black/white/accent pads. Measure actual computed colors including opacity/disabled/hover/portals/canvas, not just this table.

## Keyboard and focus acceptance

- Pad selection and sound playback are separate: arrowselectiondoesnotplay; Enter/Spaceplaysfocusedloadedpad once; MIDIkeepsselectededitorstable. Allassignment/move/swap/clear/replaceactions have explicit keyboardcontrols.
- Every dialog owns focus, Tab/Shift+Tab remain within active modal, Escape follows its actual nondestructive policy, and closing restores focus to the invoker or a sensible surviving control. Nested Zoom or confirmation must restore the underlying dialog correctly. Test importer, recorder, slicing, waveformeditor, backup/recovery and library.
- Project recovery is informational and its Escape must not erase saved work. Announced errors point to relevant controls. Progress/status announcements should be concise and avoid every audio meter tick.
- Expose numeric marker values and keyboard alternatives for canvas/pointer handles. Theme changes must redraw canvas colors. Decorations do not pollute accessible names.
- At320px portrait and200%zoom, name/status/export, captureStop, reviewApply/Cancel and waveformnumericediting stayvisible/reachable. Stickybars must not cover focusedcontent or onscreenkeyboard. Measure interactive hitareas44x44CSSpx, not iconartsize; avoidoverlappinghitareas.
- Run fullkeyboard/touchwalkthroughs with reducedmotion. Accessibilitytree/automatedchecks alone do not prove VoiceOver/NVDA behavior; reportactualassistivetechnologytests separately ifavailable.

## Source and skill clarification

The project's44px target requirement stands. The skill quick reference lists2.5.5 inside an AA audit, but W3C defines2.5.5 TargetSizeEnhanced as AAA; do not call44px a WCAG2.1AA criterion or inferoverallconformance.

- [W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [W3C44px target size enhanced, AAA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
