// Original OP-XY appearance artwork: grayscale "screen" diagrams drawn on a black panel.
// They are illustrations, not controls, and never depict device renders, marks, or live states.

const frame = <rect className="studio-opxy-art-screen" x={0.5} y={0.5} width={279} height={111} rx={3} />;

/** Note range as a screen readout: 24 zone columns above a compact keybed. Loaded zones are solid with a cap tick. */
export function OpxyNoteRangeArt({ loaded }: { loaded: number }) {
  const zoneWidth = 256 / 24;
  const whiteKeys = Array.from({ length: 14 }, (_, index) => index);
  const blackKeys = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12];
  return <svg className="studio-launch-diagram studio-opxy-art" data-launch-diagram="note-range" data-appearance-art="opxy" data-loaded={loaded} viewBox="0 0 280 112" preserveAspectRatio="none" role="img" aria-label={`OP-XY note range display: 24 zones across the keyboard, ${loaded} loaded`}>
    {frame}
    <g className="studio-opxy-art-zones">{Array.from({ length: 24 }, (_, index) => {
      const state = index < loaded ? 'loaded' : 'empty';
      const x = 12 + index * zoneWidth;
      const height = 20 + ((index * 7) % 5) * 7;
      return <g key={index} data-zone={index} data-zone-state={state}>
        <rect className={`studio-opxy-art-zone studio-opxy-art-zone--${state}`} x={x + 1} y={70 - height} width={zoneWidth - 2} height={height} />
        {state === 'loaded' && <rect className="studio-opxy-art-zone-cap" x={x + 1} y={66 - height} width={zoneWidth - 2} height={2} />}
      </g>;
    })}</g>
    <line className="studio-opxy-art-rule" x1={12} x2={268} y1={74} y2={74} />
    <g className="studio-opxy-art-keybed">
      {whiteKeys.map(index => <rect key={index} className="studio-opxy-art-key" x={12 + index * (256 / 14)} y={78} width={256 / 14 - 1.5} height={26} />)}
      {blackKeys.map(index => <rect key={`b${index}`} className="studio-opxy-art-key-dark" x={12 + (index + 1) * (256 / 14) - 5} y={78} width={9} height={15} />)}
    </g>
    <text className="studio-opxy-art-label" x={14} y={13}>ZONES {String(loaded).padStart(2, '0')}/24</text>
  </svg>;
}

/** Capture as a finished take: a waveform between trim brackets with a review cursor. Idle, so no live indicator. */
export function OpxyCaptureArt() {
  const points = Array.from({ length: 60 }, (_, index) => {
    const t = index / 59;
    const envelope = Math.min(1, t * 9) * Math.exp(-t * 3.1);
    const amplitude = 34 * envelope * (0.55 + 0.45 * Math.abs(Math.sin(index * 1.7)));
    return { x: 30 + t * 220, amplitude };
  });
  const upper = points.map(point => `${point.x.toFixed(1)},${(56 - point.amplitude).toFixed(1)}`).join(' ');
  const lower = [...points].reverse().map(point => `${point.x.toFixed(1)},${(56 + point.amplitude).toFixed(1)}`).join(' ');
  return <svg className="studio-launch-diagram studio-opxy-art" data-launch-diagram="capture" data-appearance-art="opxy" viewBox="0 0 280 112" preserveAspectRatio="none" role="img" aria-label="OP-XY capture display: a recorded take between trim markers, ready to review">
    {frame}
    <line className="studio-opxy-art-rule" x1={12} x2={268} y1={56} y2={56} />
    <polygon className="studio-opxy-art-wave" points={`${upper} ${lower}`} />
    <path className="studio-opxy-art-trim" d="M30 16h-6v80h6M250 16h6v80h-6" />
    <line className="studio-opxy-art-cursor" x1={172} x2={172} y1={12} y2={100} />
    <text className="studio-opxy-art-label" x={36} y={14}>TAKE 01</text>
    <text className="studio-opxy-art-label" x={266} y={106} textAnchor="end">REVIEW</text>
  </svg>;
}

/** Pad map as an abstract two-row grid. Loaded pads carry a square mark; the selected pad is inverted with corner brackets. */
export function OpxyPadMapArt() {
  const loaded = new Set([0, 1, 2, 4, 5, 9]);
  const selected = 1;
  return <svg className="studio-launch-diagram studio-opxy-art" data-launch-diagram="pad-map" data-appearance-art="opxy" viewBox="0 0 280 112" preserveAspectRatio="none" role="img" aria-label="OP-XY pad map display: twelve grayscale pads in two rows, loaded pads marked with a square and one selected pad inverted">
    {frame}
    {Array.from({ length: 12 }, (_, index) => {
      const column = index % 6, row = Math.floor(index / 6);
      const x = 14 + column * 43, y = 14 + row * 46;
      const state = index === selected ? 'selected' : loaded.has(index) ? 'loaded' : 'empty';
      return <g key={index} data-opxy-pad={index} data-pad-art-state={state}>
        <rect className={`studio-opxy-art-pad studio-opxy-art-pad--${state}`} x={x} y={y} width={37} height={38} rx={2} />
        {state !== 'empty' && <rect className="studio-opxy-art-pad-mark" x={x + 5} y={y + 5} width={5} height={5} />}
        {state === 'selected' && <path className="studio-opxy-art-bracket" d={`M${x - 3} ${y + 7}v-10h10M${x + 30} ${y - 3}h10v10M${x + 40} ${y + 31}v10h-10M${x + 7} ${y + 41}h-10v-10`} />}
        <line className="studio-opxy-art-pad-legend" x1={x + 12} x2={x + 25} y1={y + 29} y2={y + 29} />
      </g>;
    })}
  </svg>;
}

/** Eight numbered lanes with separately captured clips and a shared playhead. */
export function OpxyTracksArt() {
  const clips: Array<Array<[number, number]>> = [
    [[40, 90], [150, 60]], [[40, 200]], [[70, 50], [140, 40], [200, 50]], [[40, 120]],
    [[100, 150]], [[40, 30], [90, 30], [140, 30], [190, 30]], [[60, 180]], [[40, 70], [180, 80]],
  ];
  return <svg className="studio-launch-diagram studio-opxy-art" data-launch-diagram="tracks" data-appearance-art="opxy" viewBox="0 0 280 112" preserveAspectRatio="none" role="img" aria-label="OP-XY track display: eight numbered lanes, each captured as its own audio clip">
    {frame}
    {clips.map((lane, index) => {
      const y = 8 + index * 12.25;
      return <g key={index} data-opxy-lane={index + 1}>
        <text className="studio-opxy-art-lane-number" x={16} y={y + 8}>{index + 1}</text>
        <rect className="studio-opxy-art-lane" x={34} y={y} width={236} height={9} />
        {lane.map(([start, width]) => <rect key={start} className="studio-opxy-art-clip" x={start} y={y + 1.5} width={width} height={6} />)}
      </g>;
    })}
    <line className="studio-opxy-art-cursor" x1={198} x2={198} y1={4} y2={108} />
  </svg>;
}

/** Decorative screen strip beside the brand in the header. */
export function OpxyHeaderDisplay() {
  return <span className="studio-opxy-display" aria-hidden="true">
    <svg viewBox="0 0 64 20" width={64} height={20} focusable="false">
      <rect className="studio-opxy-display-screen" x={0} y={0} width={64} height={20} rx={2} />
      {[4, 9, 6, 12, 8, 14, 7, 10, 5, 11, 6, 9].map((height, index) => <rect key={index} className="studio-opxy-display-bar" x={5 + index * 4.6} y={10 - height / 2} width={2.2} height={height} />)}
    </svg>
  </span>;
}
