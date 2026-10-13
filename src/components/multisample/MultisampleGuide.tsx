import { LOOPING_EXPLANATION, recordedNoteName, sampleFieldListening, sampleFields, type SampleHelpTopic } from './multisampleHelp';
import type { MultisampleFile } from '../../context/AppContext';

export function MultisampleGuide({ topic, sample, loopEnabled, multiple, midiNoteMapping = 'C3' }: {
  topic: SampleHelpTopic | null; sample?: MultisampleFile; loopEnabled: boolean; multiple: boolean; midiNoteMapping?: 'C3' | 'C4';
}) {
  const loopTopic = topic === 'loopStart' || topic === 'loopEnd';
  return <aside className="studio-multisample-guide" aria-label="Multisampling guide">
    <header className="studio-listening-header">
      <span className="studio-listening-kicker">LISTEN / CHECK YOUR SOUND</span>
      <h3>{sample ? 'Try your sound' : 'Start with one recording'}</h3>
      <p>{sample ? <>Play a few keys. Your recording plays at its original pitch on <strong>{recordedNoteName(sample.rootNote, midiNoteMapping)}</strong>. Lower keys play it lower; higher keys play it higher.</> : 'Add or record one clear note, then try it across the keyboard.'}</p>
    </header>
    {sample && <dl className="studio-listening-facts">
      <div><dt>Assigned key</dt><dd>{recordedNoteName(sample.rootNote, midiNoteMapping)}</dd><p>Original pitch</p></div>
      <div><dt>Playback</dt><dd>{sample.inPoint.toFixed(2)}–{sample.outPoint.toFixed(2)} <span>s</span></dd><p>Selected section</p></div>
      <div><dt>Looping</dt><dd><span className="studio-listening-dot" data-active={loopEnabled} aria-hidden="true" />{loopEnabled ? 'On' : 'Off'}</dd><p>{loopEnabled ? `${sample.loopStart.toFixed(2)}–${sample.loopEnd.toFixed(2)} s repeats` : 'Plays without repeating'}</p></div>
    </dl>}
    {topic
      ? <div className="studio-guide-context" aria-live="polite">
        <strong>{sampleFields[topic].label}</strong>
        <p>{sampleFields[topic].tip}</p>
        <p><strong>Listen:</strong> {sampleFieldListening[topic]}</p>
        {loopTopic && <p>{LOOPING_EXPLANATION}{loopEnabled ? '' : ' Looping is off for this instrument, so these points are stored but not used yet.'}</p>}
      </div>
      : null}
    <details className="studio-listening-more"><summary>Learn more <span>Playing, looping &amp; finishing</span></summary>
    <div className="studio-listening-help">
    {!sample && <p>Add or record one clear note. One recording can be played across the whole keyboard, and you can add recordings of other notes later.</p>}
    {sample && !multiple && <p>This one recording is played across the keyboard at different pitches. Notes farther from the recorded note may sound less natural. Adding recordings of other notes keeps each key closer to a real recording.</p>}
    {sample && multiple && <p>Each recording covers the keys nearest its recorded note. Check which note belongs to each file, then play across the keyboard where one recording hands over to the next.</p>}
    <details open={!sample}><summary>Steps for a first instrument</summary>
      <ol>
        <li><strong>Add or record a sound.</strong> Start with a clear recording of one note.</li>
        <li><strong>Check its key assignment.</strong> The key you chose when adding the sound is shown under Key assignment. Use Change assignment only if you need to correct it.</li>
        <li><strong>Choose the playback section.</strong> Playback start skips unwanted audio at the beginning; playback end sets the end of the playable section. Times are positions in the original recording.</li>
        <li><strong>Decide whether it should repeat.</strong> Looping is optional. In Focus view, use the Looping switch beside the loop points. In Table view, use loop enabled under Preset and performance settings.</li>
        <li><strong>Check it on the keyboard.</strong> Play the assigned key first: it should match the original recording’s pitch. Play a few lower keys, then higher keys: the pitch should move down, then up. Hold a key to check the repeat if looping is on. Release it and listen to the ending; the release envelope and loop mode control how it ends.</li>
      </ol>
      <p>“Play selected” plays the sample at its original pitch. Use the keyboard to check key assignment and key release.</p>
    </details>
    <details><summary>When should I use looping?</summary>
      <svg viewBox="0 0 300 75" role="img" aria-label="Play the beginning once, then repeat the selected loop section" style={{width:'100%',color:'var(--studio-text)'}}><g stroke="currentColor" fill="none"><path d="M8 40l10-25 10 43 10-38 10 32 10-24 10 14 12-7h200"/><rect x="95" y="22" width="125" height="30"/><path d="M105 18v-9h105v9m-6-5 6 5 6-5"/></g><text x="12" y="71" fill="currentColor" fontSize="10">Beginning</text><text x="122" y="71" fill="currentColor" fontSize="10">Loop repeats</text></svg>
      <p>{LOOPING_EXPLANATION} To cover more of the keyboard naturally, add recordings of other notes.</p>
      <p><strong>Try it for sustained sounds:</strong> pads, strings and organ-like tones when you want a note to keep sounding longer than the recording.</p>
      <p><strong>Usually leave it off:</strong> drum hits, short plucks and phrases that should play through and end naturally.</p>
      <p>Looping is one setting for the whole instrument: when it is on, every recording repeats between its own loop points.</p>
    </details>
    <details><summary>How do I set good loop points?</summary>
      <ul>
        <li><strong>Pick a steady section</strong> after the initial hit or attack. Avoid looping across silence or a big change in the sound.</li>
        <li><strong>A click at each repeat:</strong> move the loop points to a smoother section. Crossfade in Zoom and edit may soften the join; listen again after changing it.</li>
        <li><strong>A repeated dip, swell or sudden change in tone:</strong> the loop may include a fade or a changing sound. Try a more even section or a longer loop.</li>
        <li><strong>Keep the loop inside the playback section.</strong> Loop end must come after loop start.</li>
        <li><strong>Check the ending:</strong> hold a key, release it and listen. The loop mode and release setting control whether the repeat continues while the note fades.</li>
      </ul>
    </details>
    <details><summary>What should I listen for?</summary>
      <ul>
        <li><strong>The assigned key sounds out of tune:</strong> compare with the note originally recorded. A filename’s note is only a clue.</li>
        <li><strong>The beginning sounds cut off:</strong> move playback start earlier.</li>
        <li><strong>The ending stops abruptly:</strong> check playback end and the release setting. A short release may be intentional.</li>
        {multiple && <li><strong>A jump where recordings meet:</strong> if pitch jumps unexpectedly, or volume or tone changes abruptly, check the recorded notes, key assignments and sample levels. Some tone differences are natural.</li>}
      </ul>
    </details>
    <details><summary>What do the status marks mean?</summary>
      <p className="studio-guide-legend">✓ Valid = usable values · ! Needs fixing = invalid values · ◇ Listen = a musical check · — Not in use = optional setting is off. Valid values do not guarantee a good sound.</p>
    </details>
    <p>Once the listening checks sound right, download the preset and check it on your OP-XY.</p>
    </div></details>
  </aside>;
}
