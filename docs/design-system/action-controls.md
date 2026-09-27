# Studio System: action controls

The visual contract for ordinary tool actions is a compact, flat control with a readable label. Rounded or molded treatment belongs to playable pads and keys, not utility buttons.

## What the drum editor exposed

The old drum action row held five individually styled buttons in a non-wrapping flex container. At a 1024px viewport, its editor column was 468px wide; buttons shrank to 51–107px, and labels wrapped until the controls were 73–97px tall. The disabled Bulk edit button also used a dark fill with low-visibility text. Multisample copied part of the same one-off styling.

## Shared rule

- Use `.studio-utility-actions` for an instrument's secondary action group and `.studio-utility-action` for each button. The container owns available width and wrapping; buttons do not set individual fixed widths, `isMobile` widths, or mouse-enter style mutations.
- Keep visible text on every action. Icons supplement labels and use `aria-hidden="true"`; they never replace the label.
- Use the `--danger` variant for destructive or reset actions and `--import` for an import route. Color is an accent, not the only indicator of meaning. The action label and any existing confirmation remain authoritative.
- Keep disabled actions readable, visibly unavailable, and semantically disabled. Do not turn them into unlabeled dark blocks or rely on reduced opacity alone.
- Maintain a 44px minimum target, distinct keyboard focus, no clipped text, and no unintended horizontal overflow. A wrapped row is preferable to squeezed controls.
- Use the same pattern across drum and multisample. Other dense action groups should be audited against this rule before another local styling exception is added.

## Review gate for action groups

Check a populated and an empty/disabled state at 390px and 1024px, then at increased browser text scale. Inspect computed button bounds and the rendered screen: text must fit, disabled labels must be readable, and the group must not exceed its own width. Check keyboard focus and confirm that action behavior is unchanged. Repeat in both instrument editors when changing this shared CSS.

This rule covers utility actions, not the pad-key surface or the primary project toolbar. It does not change import, reset, clear, or export behavior.
