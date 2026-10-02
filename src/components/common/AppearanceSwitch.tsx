import { useId, useState } from 'react';
import { useStudioTheme } from '../../context/StudioTheme';
import type { StudioAppearance } from '../../context/StudioTheme';
import '../../styles/studio-appearance-switch.css';

const choices: { value: StudioAppearance; label: string }[] = [
  { value: 'field', label: 'OP-1 Field' },
  { value: 'opxy', label: 'OP-XY' },
];

// Small original glyphs: a bright slab for Field, a black slab with a grey screen for OP-XY.
function Glyph({ value }: { value: StudioAppearance }) {
  return <svg className="studio-appearance-glyph" viewBox="0 0 18 12" width={18} height={12} aria-hidden="true" focusable="false">
    {value === 'field'
      ? <><rect x={0.75} y={0.75} width={16.5} height={10.5} rx={1.5} fill="none" stroke="currentColor" strokeWidth={1.5} /><circle cx={5} cy={6} r={1.6} fill="currentColor" /><circle cx={9} cy={6} r={1.6} fill="currentColor" /><circle cx={13} cy={6} r={1.6} fill="currentColor" /></>
      : <><rect x={0} y={0} width={18} height={12} rx={1} fill="currentColor" /><rect x={3} y={2.5} width={12} height={4} fill="var(--studio-appearance-glyph-screen, #9a9a9a)" /><path d="M3 9.5h2m2 0h2m2 0h2m2 0h1" stroke="var(--studio-appearance-glyph-screen, #9a9a9a)" strokeWidth={1.2} /></>}
  </svg>;
}

/**
 * Presentation setting styled as two tabs. Native radios give arrow-key selection and
 * a single tab stop; it deliberately avoids tab/tablist roles because no panel switches.
 */
export function AppearanceSwitch() {
  const { appearance, setAppearance } = useStudioTheme();
  const name = `studio-appearance-${useId()}`;
  // WebKit drops :focus-visible when arrow keys move between radios, so keyboard use is tracked here
  // to keep the focus ring on the newly selected tab. Pointer use clears it.
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  return <fieldset
    className="studio-appearance-switch"
    data-appearance-switch
    data-keyboard-focus={keyboardFocus ? 'true' : undefined}
    onKeyDown={() => setKeyboardFocus(true)}
    onPointerDown={() => setKeyboardFocus(false)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setKeyboardFocus(false); }}
  >
    <legend className="studio-appearance-legend">Appearance</legend>
    {choices.map(choice => <label key={choice.value} className="studio-appearance-choice" data-checked={appearance === choice.value ? 'true' : undefined}>
      <input
        type="radio"
        name={name}
        value={choice.value}
        checked={appearance === choice.value}
        onChange={() => setAppearance(choice.value)}
      />
      <Glyph value={choice.value} />
      <span className="studio-appearance-label">{choice.label}</span>
    </label>)}
  </fieldset>;
}
