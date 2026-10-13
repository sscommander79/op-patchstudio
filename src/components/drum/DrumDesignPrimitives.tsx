import type { ButtonHTMLAttributes } from 'react';

const icons = {
  add: 'da667', trim: '8bc44', undo: '22006', clear: 'dafeb', settings: 'ece3c',
  play: '6cf00', back: 'c20d4', record: 'f6b8e', file: '63b23', save: '6308e', keys: '6cf00', check: 'b4779',
} as const;

export function DrumIcon({ name }: { name: keyof typeof icons }) {
  return <span className={`drum-design-icon drum-design-icon--${name}`} aria-hidden="true"><img src={`/assets/drum-design/${icons[name]}.svg`} alt="" /></span>;
}

export function DrumFunctionButton({ icon, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: keyof typeof icons }) {
  return <button type="button" className="drum-function-button" {...props}><span className="drum-function-cap"><DrumIcon name={icon}/></span><span>{children}</span></button>;
}

export function DrumMachine({ complete = false }: { complete?: boolean }) {
  return <div className="drum-machine"><h2>{complete ? 'your sounds, ready to keep' : 'a kit, made from your sounds'}</h2><p>OP–XY · your destination instrument</p><img src="/assets/drum-design/30fb5.png" alt="Instrument reference from the approved drum design"/><small>{complete ? 'Your assignments and trims stay with this kit.' : 'Individual recordings become a playable drum kit.'}</small></div>;
}
