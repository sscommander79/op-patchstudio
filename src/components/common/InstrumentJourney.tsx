import { useRef, useState } from 'react';
import { useAudioImport } from './AudioImportContext';

export type InstrumentSource = 'single' | 'set' | 'software' | 'hardware';
const sources = [
  { id: 'single', title: 'One audio file', description: 'Play one recording at different pitches.', needs: 'An audio recording and the note it was played on.', steps: ['Add your recording.', 'Confirm its original note, then play the keyboard.', 'For a held sound, try an optional loop and listen.'], detail: 'The same recording is played faster or slower across the keys. This does not record new notes from the original instrument. Notes farther from the original may sound less natural.' },
  { id: 'set', title: 'A set of recorded notes', description: 'Build an instrument from recordings of different notes.', needs: 'Audio files from your own recordings or a compatible sample pack.', steps: ['Add the audio files from your set.', 'Check the note suggested for each file; resolve any missing notes or conflicts.', 'Play across the keyboard and listen where recordings meet.'], detail: 'Each recording keeps the character of that original note. Add the audio files, not a preset made for another sampler. File names can suggest notes, but you can correct them before adding the set.' },
  { id: 'software', title: 'A software instrument', description: 'Record a sound from your music software.', needs: 'Your instrument open in music software, a MIDI connection and an audio input the browser can hear.', steps: ['Open the instrument in your music software and select the sound you want.', 'Send notes from this app to that instrument; send its audio back to a browser input.', 'Check one note and listen before recording the full range.'], detail: 'Your music software runs the instrument. This app sends MIDI note instructions and records the returning sound. A MIDI connection alone does not carry audio. You may need a virtual audio connection or an audio interface.' },
  { id: 'hardware', title: 'A hardware instrument', description: 'Record a sound from your synth.', needs: 'Your synth, a MIDI output to it and an audio input from it.', steps: ['Select the sound you want on your instrument.', 'Connect MIDI to send notes, and audio to bring sound back to the computer.', 'Check one note and listen before recording the full range.'], detail: 'MIDI tells your instrument which notes to play. The audio connection records how those notes actually sound. Some instruments send audio over USB; others need an audio interface. A USB MIDI connection alone is not audio.' },
] as const;

export function JourneyDiagram({ source }: { source: InstrumentSource }) {
  const recording = source === 'software' || source === 'hardware';
  return <svg className="studio-journey-diagram" viewBox="0 0 360 120" role="img" aria-label={source === 'single' ? 'One recording mapped across a long keyboard' : source === 'set' ? 'Different recordings mapped to their original notes' : `${source === 'software' ? 'Music software' : 'Synth'} receives MIDI notes and returns audio to this app`}>
    {recording ? <>
      <rect x="8" y="20" width="118" height="80" rx="3"/><text x="67" y="65" textAnchor="middle">This app</text>
      <rect x="233" y="20" width="118" height="80" rx="3"/>
      {source === 'hardware' ? <><circle cx="252" cy="39" r="6"/><circle cx="275" cy="39" r="6"/><circle cx="298" cy="39" r="6"/><path d="M245 75h94m-84 0v18m14-18v18m14-18v18m14-18v18m14-18v18m14-18v18"/></> : <><path d="M244 32h95v18h-95zM252 82v-20m12 20v-10m12 10v-26m12 26v-15"/><text x="293" y="96" textAnchor="middle">Music software</text></>}
      <path d="M133 43h90m-8-5 8 5-8 5M223 83h-90m8-5-8 5 8 5"/><text x="178" y="32" textAnchor="middle">MIDI notes</text><text x="178" y="106" textAnchor="middle">Audio back</text>
    </> : <>
      {(source === 'single' ? [160] : [38,160,282]).map(x=><g key={x}><rect x={x} y="5" width="40" height="35" rx="2"/><path d={`M${x+7} 23h4l3-9 4 18 4-12 3 3h8M${x+20} 43v18m-4-4 4 4 4-4`}/></g>)}
      <rect x="8" y="66" width="344" height="46"/>{Array.from({length:21},(_,i)=><line key={i} x1={8+i*16.4} x2={8+i*16.4} y1="66" y2="112"/>)}
      {[1,2,4,5,6,8,9,11,12,13,15,16,18,19,20].map(i=><rect key={i} className="studio-journey-black-key" x={3+i*16.4} y="66" width="9" height="26"/>)}
      {(source==='single'?[10]:[3,10,17]).map(i=><circle className="studio-journey-note" key={i} cx={16+i*16.4} cy="103" r="3"/>)}
    </>}
  </svg>;
}

export function InstrumentJourney({ onRecord, onOpenEditor, initialSource='single', onSourceChange }: { initialSource?:InstrumentSource; onSourceChange?:(source:InstrumentSource)=>void; onRecord: (source: 'software' | 'hardware') => void; onOpenEditor: () => void }) {
  const [selected, setSelected] = useState<InstrumentSource>(initialSource);
  const input = useRef<HTMLInputElement>(null);
  const importer = useAudioImport();
  const source = sources.find(item => item.id === selected)!;
  const fileSource = selected === 'single' || selected === 'set';
  return <section className="studio-instrument-journey" aria-labelledby="instrument-source-title">
    <p className="studio-eyebrow">Make a playable instrument</p><h1 id="instrument-source-title">Where will your sound come from?</h1>
    <p className="studio-shell-lead">Choose a starting point. Each path ends with an instrument you can play on your OP-XY.</p>
    <div className="studio-source-grid">{sources.map(item=><button key={item.id} type="button" className="studio-start-card studio-source-card" aria-pressed={selected===item.id} onClick={()=>{setSelected(item.id);onSourceChange?.(item.id);}}><strong>{item.title}</strong><JourneyDiagram source={item.id}/><span>{item.description}</span></button>)}</div>
    <section className="studio-journey-steps" aria-label={`${source.title} steps`}><div><h2>{source.title}</h2><p>{source.detail}</p><p><strong>What you need</strong><br/>{source.needs}</p></div><ol>{source.steps.map((step,i)=><li key={step}><span aria-hidden="true">{i+1}</span>{step}</li>)}</ol></section>
    <div className="studio-action-row"><button type="button" className="studio-button-primary" onClick={()=>fileSource?input.current?.click():onRecord(selected as 'software'|'hardware')}>{fileSource?selected==='single'?'Add audio file':'Add recorded notes':'Connect and check sound'}</button><button type="button" className="studio-button-secondary" onClick={onOpenEditor}>Open instrument editor</button></div>
    {fileSource&&<p className="studio-journey-hint">Add audio files such as WAV or AIFF. Import checks the files and lets you choose where each recording belongs.</p>}
    <input ref={input} hidden aria-label="Instrument audio files" type="file" accept="audio/*,.wav,.aif,.aiff,.flac" multiple={selected==='set'} onChange={event=>{if(event.target.files?.length&&importer){importer.beginFiles(event.target.files,{instrument:'multisample'});onOpenEditor();}event.target.value='';}}/>
  </section>;
}
