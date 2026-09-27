// Original flat pictograms for decorative launch artwork, not playable controls.

export function PercussionIllustration({ index }: { index: number }) {
  const drawings = [
    <><circle cx="20" cy="14" r="10" /><circle cx="20" cy="14" r="7" /><path d="m12 22-3 4m19-4 3 4" /><circle cx="23" cy="17" r="2" fill="currentColor" stroke="none" /></>,
    <><path d="M9 10v11c0 4 22 4 22 0V10M10 18h20m-17-5v9m7-9v10m7-10v9" /><ellipse cx="20" cy="10" rx="11" ry="4" /></>,
    <><path d="M20 4v22m-6 1 6-5 6 5M7 12h26M8 17h24" /><path d="m7 12 13-5 13 5m-25 5 12-3 12 3" /></>,
    <><path d="M20 4v22m-6 1 6-5 6 5M5 13q15-3 30 0M8 12q12-11 24 0" /><path d="M18 9h4" /></>,
    <><path d="M10 9v13q10 7 20 0V9m-16 5v10m12-10v10" /><ellipse cx="20" cy="9" rx="10" ry="4" /></>,
    <><path d="m15 5-5 19h20L25 5Zm-4 16h18M17 5V3h6v2" /><path d="m16 9-2 8" /></>,
    <><circle cx="20" cy="15" r="10" /><circle cx="20" cy="15" r="6" /><path d="M17 5h6m-6 20h6M10 12v6m20-6v6" strokeWidth="3" /></>,
    <><path d="m17 18-5 9m8-7-5 9" /><ellipse cx="23" cy="11" rx="7" ry="10" transform="rotate(30 23 11)" /><path d="m18 8 10 6" /></>,
    <><path d="m9 6 4-2 13 23-4 2Z" fill="currentColor" stroke="none" /><path d="m29 4 4 2-13 23-4-2Z" /></>,
    <><path d="M11 7q-1 13 5 20h8q6-7 5-20M15 12l2 11m8-11-2 11" /><ellipse cx="20" cy="7" rx="9" ry="4" /></>,
    <><path d="m26 23 7 2L20 4 7 25h14M26 10l9 7" /><path d="M18 4V2h4" /></>,
    <><path d="M7 7h26v17H7ZM11 13h18M11 17h18" /><circle cx="12" cy="21" r="1" fill="currentColor" stroke="none" /><circle cx="28" cy="21" r="1" fill="currentColor" stroke="none" /></>,
  ];
  return <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{drawings[index]}</g>;
}
