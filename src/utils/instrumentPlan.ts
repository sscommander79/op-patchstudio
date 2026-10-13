export function planInstrumentNotes(first:number,last:number,spacing:number):number[]{
 if(![first,last,spacing].every(Number.isInteger)||first<0||last>127||first>last||![1,3,6,12].includes(spacing))throw new Error('Choose a valid first note, last note and spacing.');
 const notes:number[]=[];for(let note=first;note<=last;note+=spacing)notes.push(note);
 if(notes.at(-1)!==last)notes.push(last);
 if(notes.length>24)throw new Error(`${notes.length} notes selected. Use wider spacing or a smaller range (24 recordings maximum).`);
 return notes;
}
export function instrumentNoteName(note:number):string{return `${['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][note%12]}${Math.floor(note/12)-2}`;}

/** Recover the displayed plan from saved root notes, without re-detecting pitch. */
export function savedInstrumentPlan(roots:number[]) {
 const sorted=[...roots].sort((a,b)=>a-b);
 if(!sorted.length)return null;
 const first=sorted[0],last=sorted[sorted.length-1];
 for(const spacing of [3,1,6,12]) {
  try {if(JSON.stringify(planInstrumentNotes(first,last,spacing))===JSON.stringify(sorted))return {first,last,spacing};}catch { /* Try a wider spacing. */ }
 }
 return null;
}
