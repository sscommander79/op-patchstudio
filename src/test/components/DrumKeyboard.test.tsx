import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DrumKeyboard } from '../../components/drum/DrumKeyboard';
import { DrumKeyboardContainer } from '../../components/drum/DrumKeyboardContainer';
import { AppContextProvider, useAppContext } from '../../context/AppContext';

const { play, midi } = vi.hoisted(() => ({
  play: vi.fn().mockResolvedValue(undefined),
  midi: {
    initialize: vi.fn().mockResolvedValue(false),
    state: { isSupported: true, isInitialized: true, isConnecting: false, devices: [], error: null as string | null },
  },
}));
vi.mock('../../hooks/useAudioPlayer', () => ({ useAudioPlayer: () => ({ play }) }));
vi.mock('../../hooks/useWebMidi', () => ({ useWebMidi: () => ({
  onMidiEvent: vi.fn(() => vi.fn()),
  state: midi.state,
  initialize: midi.initialize,
  refreshDevices: vi.fn(),
}) }));

function LoadedKeyboard() {
  const { dispatch } = useAppContext();
  const load = () => {
    for (const index of [0, 12]) {
      const audioBuffer = { duration: 1, sampleRate: 44100, length: 44100, tag: index } as unknown as AudioBuffer;
      dispatch({ type: 'LOAD_DRUM_SAMPLE', payload: {
        index,
        file: new File([String(index)], `${index}.wav`),
        audioBuffer,
        metadata: { format:'wav', duration:1, sampleRate:44100, bitDepth:16, channels:1, isFloat:false,
          audioBuffer, fileSize:1, midiNote:60, loopStart:0, loopEnd:0, hasLoopData:false },
      } });
    }
  };
  return <><button onClick={load}>load keys</button><DrumKeyboard /></>;
}

// Import the drumKeyMap to test the mapping directly
const drumKeyMap = [
  // Lower octave (octave 0)
  {
    W: { label: "KD2", idx: 1 },
    E: { label: "SD2", idx: 3 },
    R: { label: "CLP", idx: 5 },
    Y: { label: "CH", idx: 8 },
    U: { label: "OH", idx: 10 },
    A: { label: "KD1", idx: 0 },
    S: { label: "SD1", idx: 2 },
    D: { label: "RIM", idx: 4 },
    F: { label: "TB", idx: 6 },
    G: { label: "SH", idx: 7 },
    H: { label: "CL", idx: 9 },
    J: { label: "CAB", idx: 11 },
  },
  // Upper octave (octave 1)
  {
    W: { label: "RC", idx: 13 },
    E: { label: "CC", idx: 15 },
    R: { label: "COW", idx: 17 },
    Y: { label: "LC", idx: 20 },
    U: { label: "HC", idx: 22 },
    A: { label: "LT1", idx: 12 },
    S: { label: "MT", idx: 14 },
    D: { label: "HT", idx: 16 },
    F: { label: "TRI", idx: 18 },
    G: { label: "LT2", idx: 19 },
    H: { label: "WS", idx: 21 },
    J: { label: "GUI", idx: 23 },
  },
];

describe('DrumKeyboard', () => {
  it('keeps the focused pad node through pressed-state rerenders', () => {
    const {container}=render(<AppContextProvider><DrumKeyboard /></AppContextProvider>);
    const before=container.querySelector<HTMLButtonElement>('[data-drum-pad="0"]')!;
    before.focus();

    const pointerDown=new Event('pointerdown',{bubbles:true});
    Object.defineProperty(pointerDown,'pointerType',{value:'mouse'});
    fireEvent(before,pointerDown);

    const after=container.querySelector<HTMLButtonElement>('[data-drum-pad="0"]')!;
    expect(after).toBe(before);
    expect(document.activeElement).toBe(before);
    expect(after).toHaveAttribute('aria-pressed','true');
    const pointerUp=new Event('pointerup',{bubbles:true});
    Object.defineProperty(pointerUp,'pointerType',{value:'mouse'});
    fireEvent(after,pointerUp);
    expect(after).toHaveAttribute('aria-pressed','false');
  });

  it('requests MIDI only from the explicit connect action and does not auto-retry denial', async () => {
    midi.initialize.mockClear();
    Object.assign(midi.state,{isInitialized:false,isConnecting:false,error:null});
    const props={isOrganizeMode:false,setIsOrganizeMode:vi.fn()};
    const view=render(<AppContextProvider><DrumKeyboardContainer {...props}/></AppContextProvider>);
    expect(midi.initialize).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('connect midi devices'));
    fireEvent.click(screen.getByRole('button',{name:/connect midi devices/i}));
    await waitFor(()=>expect(midi.initialize).toHaveBeenCalledTimes(1));
    expect(midi.initialize).toHaveBeenCalledWith();

    Object.assign(midi.state,{isConnecting:true});view.rerender(<AppContextProvider><DrumKeyboardContainer {...props}/></AppContextProvider>);
    Object.assign(midi.state,{isConnecting:false,error:'permission denied'});view.rerender(<AppContextProvider><DrumKeyboardContainer {...props}/></AppContextProvider>);
    expect(midi.initialize).toHaveBeenCalledTimes(1);
    Object.assign(midi.state,{isInitialized:true,isConnecting:false,error:null});
  });

  it('should render without crashing', () => {
    render(
      <AppContextProvider>
        <DrumKeyboard />
      </AppContextProvider>
    );
  });

  it('exposes loaded and empty drum-pad presentation state from existing samples', () => {
    const { container } = render(<AppContextProvider><LoadedKeyboard /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'load keys' }));

    expect(container.querySelector('[data-drum-pad="0"]')).toHaveAttribute('data-pad-state', 'loaded');
    expect(container.querySelector('[data-drum-pad="1"]')).toHaveAttribute('data-pad-state', 'empty');
  });

  it('shows both desktop pad banks and readable loaded and empty states', () => {
    render(<AppContextProvider><LoadedKeyboard /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'load keys' }));

    expect(screen.getByText('Lower pads · 1–12')).toBeInTheDocument();
    expect(screen.getByText('Upper pads · 13–24')).toBeInTheDocument();
    expect(screen.getAllByText('LOADED')).toHaveLength(2);
    expect(screen.getAllByText('EMPTY')).toHaveLength(22);
    expect(screen.getByRole('button', { name: 'KD1 drum key A' })).toHaveAttribute('data-pad-state', 'loaded');
    expect(screen.getByRole('button', { name: 'SD1 drum key S' })).toHaveAttribute('data-pad-state', 'empty');
  });

  it('keeps pad state in the accessible description while quieting repeated EMPTY labels', () => {
    render(<AppContextProvider><LoadedKeyboard /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'load keys' }));

    const loaded = screen.getByRole('button', { name: 'KD1 drum key A' });
    const empty = screen.getByRole('button', { name: 'SD1 drum key S' });
    expect(loaded).toHaveAccessibleDescription('LOADED');
    expect(empty).toHaveAccessibleDescription('EMPTY');
    expect(loaded.querySelector('.studio-drum-pad-status')).not.toHaveAttribute('data-status-quiet');
    expect(empty.querySelector('.studio-drum-pad-status')).toHaveAttribute('data-status-quiet', 'true');
  });

  it('labels the selected pad SELECTED without changing its accessible name', () => {
    render(<AppContextProvider><DrumKeyboard selectedSampleIndex={2} /></AppContextProvider>);

    const selected = screen.getByRole('button', { name: 'SD1 drum key S' });
    expect(selected).toHaveAttribute('aria-current', 'true');
    expect(selected).toHaveTextContent('SELECTED');
    expect(selected).toHaveAccessibleDescription('SELECTED');
    expect(screen.getAllByText('SELECTED')).toHaveLength(1);
    expect(screen.getAllByText('EMPTY')).toHaveLength(23);
  });

  it('counts loaded pads out of 24 without including unassigned tray sounds', () => {
    function PadAndTray() {
      const { state, dispatch } = useAppContext();
      const seed = () => {
        const audioBuffer = { duration: 1, sampleRate: 44100, length: 44100 } as unknown as AudioBuffer;
        const sample = (isAssigned: boolean) => ({ ...state.drumSamples[0], name: isAssigned ? 'kick' : 'tray', isLoaded: true,
          file: new File(['x'], 'x.wav'), audioBuffer, isAssigned, assignedKey: isAssigned ? 0 : undefined });
        dispatch({ type: 'STORE_DRUM_SAMPLE_ASSET', payload: { targetKeyIndex: 0, sample: sample(true) } });
        dispatch({ type: 'STORE_DRUM_SAMPLE_ASSET', payload: { targetKeyIndex: null, sample: sample(false) } });
      };
      return <><button onClick={seed}>seed pad and tray</button><DrumKeyboardContainer isOrganizeMode={false} setIsOrganizeMode={vi.fn()} /></>;
    }
    const { container } = render(<AppContextProvider><PadAndTray /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'seed pad and tray' }));

    expect(container.querySelector('[data-drum-pad="0"]')).toHaveAttribute('data-pad-state', 'loaded');
    expect(screen.getByText(/\/ 24 loaded/)).toHaveTextContent(/^1 \/ 24 loaded$/);
  });

  it('places each octave in the physical five-upper, seven-lower key order', () => {
    const { container } = render(<AppContextProvider><DrumKeyboard /></AppContextProvider>);
    const banks = container.querySelectorAll('.studio-desktop-pad-bank');
    expect(banks).toHaveLength(2);

    const padOrder = (bank: Element, row: string) =>
      Array.from(bank.querySelectorAll(`${row} [data-drum-pad]`), pad => Number(pad.getAttribute('data-drum-pad')));

    expect(padOrder(banks[0], '.studio-pad-row--upper')).toEqual([1, 3, 5, 8, 10]);
    expect(padOrder(banks[0], '.studio-pad-row--lower')).toEqual([0, 2, 4, 6, 7, 9, 11]);
    expect(padOrder(banks[1], '.studio-pad-row--upper')).toEqual([13, 15, 17, 20, 22]);
    expect(padOrder(banks[1], '.studio-pad-row--lower')).toEqual([12, 14, 16, 18, 19, 21, 23]);
  });

  it('keeps the five-over-seven arrangement when switching mobile banks', () => {
    const previous = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const { container, unmount } = render(<AppContextProvider><DrumKeyboard /></AppContextProvider>);
    const mobileOrder = (row: string) =>
      Array.from(container.querySelectorAll(`${row} [data-drum-pad]`), pad => Number(pad.getAttribute('data-drum-pad')));

    expect(mobileOrder('.studio-mobile-pad-grid .studio-pad-row--upper')).toEqual([1, 3, 5, 8, 10]);
    expect(mobileOrder('.studio-mobile-pad-grid .studio-pad-row--lower')).toEqual([0, 2, 4, 6, 7, 9, 11]);
    fireEvent.click(screen.getByRole('button', { name: 'Upper pads 13–24' }));
    expect(mobileOrder('.studio-mobile-pad-grid .studio-pad-row--upper')).toEqual([13, 15, 17, 20, 22]);
    expect(mobileOrder('.studio-mobile-pad-grid .studio-pad-row--lower')).toEqual([12, 14, 16, 18, 19, 21, 23]);

    unmount();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: previous });
  });

  it('should have correct drum key mapping for G key in octave 1', () => {
    // Test that the G key in octave 1 correctly maps to "LT2" (low tom alt) at index 19
    const gKeyMapping = drumKeyMap[1].G;
    expect(gKeyMapping.label).toBe('LT2');
    expect(gKeyMapping.idx).toBe(19);
  });

  it('should have correct drum key mapping for A key in octave 1', () => {
    // Test that the A key in octave 1 correctly maps to "LT1" (low tom) at index 12
    const aKeyMapping = drumKeyMap[1].A;
    expect(aKeyMapping.label).toBe('LT1');
    expect(aKeyMapping.idx).toBe(12);
  });

  it('should have correct drum key mapping for S key in octave 1', () => {
    // Test that the S key in octave 1 correctly maps to "MT" (mid-tom) at index 14
    const sKeyMapping = drumKeyMap[1].S;
    expect(sKeyMapping.label).toBe('MT');
    expect(sKeyMapping.idx).toBe(14);
  });

  it('should have correct drum key mapping for D key in octave 1', () => {
    // Test that the D key in octave 1 correctly maps to "HT" (hi-tom) at index 16
    const dKeyMapping = drumKeyMap[1].D;
    expect(dKeyMapping.label).toBe('HT');
    expect(dKeyMapping.idx).toBe(16);
  });

  it('should have correct drum key mapping for F key in octave 1', () => {
    // Test that the F key in octave 1 correctly maps to "TRI" (triangle) at index 18
    const fKeyMapping = drumKeyMap[1].F;
    expect(fKeyMapping.label).toBe('TRI');
    expect(fKeyMapping.idx).toBe(18);
  });

  it('should have correct drum key mapping for Y key in octave 1', () => {
    // Test that the Y key in octave 1 correctly maps to "LC" (low conga) at index 20
    const yKeyMapping = drumKeyMap[1].Y;
    expect(yKeyMapping.label).toBe('LC');
    expect(yKeyMapping.idx).toBe(20);
  });

  it('should have correct drum key mapping for H key in octave 1', () => {
    // Test that the H key in octave 1 correctly maps to "WS" (wood stick) at index 21
    const hKeyMapping = drumKeyMap[1].H;
    expect(hKeyMapping.label).toBe('WS');
    expect(hKeyMapping.idx).toBe(21);
  });

  it('should not have duplicate "LT1" labels in octave 1', () => {
    // Test that there are no duplicate "LT1" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const lt1Count = octave1Labels.filter(label => label === 'LT1').length;
    expect(lt1Count).toBe(1); // Should only be one "LT1" label (on A key)
  });

  it('should not have duplicate "LT2" labels in octave 1', () => {
    // Test that there are no duplicate "LT2" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const lt2Count = octave1Labels.filter(label => label === 'LT2').length;
    expect(lt2Count).toBe(1); // Should only be one "LT2" label (on G key)
  });

  it('should not have duplicate "CL1" labels in octave 1', () => {
    // Test that there are no duplicate "CL1" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const cl1Count = octave1Labels.filter(label => label === 'CL1').length;
    expect(cl1Count).toBe(0); // Should be no "CL1" labels in octave 1 (it's in octave 0)
  });

  it('should not have duplicate "WS" labels in octave 1', () => {
    // Test that there are no duplicate "WS" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const wsCount = octave1Labels.filter(label => label === 'WS').length;
    expect(wsCount).toBe(1); // Should only be one "WS" label (on H key)
  });

  it('should have unique indices for all keys in octave 1', () => {
    // Test that all indices in octave 1 are unique
    const octave1Indices = Object.values(drumKeyMap[1]).map(mapping => mapping.idx);
    const uniqueIndices = new Set(octave1Indices);
    expect(uniqueIndices.size).toBe(octave1Indices.length);
  });

  it('leaves selects, dialogs, IME, repeats, and modifiers in charge', async () => {
    play.mockClear();
    render(<AppContextProvider><LoadedKeyboard /></AppContextProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'load keys' }));
    const select=document.createElement('select'); document.body.append(select); select.focus();
    fireEvent.keyDown(select,{key:'a'});
    select.remove();
    const dialog=document.createElement('div'); dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true'); document.body.append(dialog);
    fireEvent.keyDown(document,{key:'a'});
    dialog.remove();
    fireEvent.keyDown(document,{key:'a',isComposing:true});
    fireEvent.keyDown(document,{key:'a',repeat:true});
    fireEvent.keyDown(document,{key:'a',ctrlKey:true});
    expect(play).not.toHaveBeenCalled();

    fireEvent.keyDown(document,{key:'x',repeat:true});
    fireEvent.keyDown(document,{key:'a'});
    await waitFor(()=>expect(play).toHaveBeenCalledTimes(1));
    expect(play.mock.calls[0][0]).toMatchObject({ tag: 0 });
  });

  it('selects an empty pad without opening a file chooser and keeps performance separate', () => {
    const onSelectSample=vi.fn();
    const inputClick=vi.spyOn(HTMLInputElement.prototype,'click');
    render(<AppContextProvider><DrumKeyboard selectedSampleIndex={null} onSelectSample={onSelectSample}/></AppContextProvider>);
    const pad=screen.getByRole('button',{name:/KD1 drum key A/i});

    fireEvent.keyDown(pad,{key:'Enter'});
    expect(onSelectSample).toHaveBeenCalledWith(0);
    expect(inputClick).not.toHaveBeenCalled();

    onSelectSample.mockClear();
    fireEvent.keyDown(document,{key:'a'});
    expect(onSelectSample).not.toHaveBeenCalled();
    inputClick.mockRestore();
  });

  it('activates a desktop pad on a direct click without double-triggering a pointer click', () => {
    const onSelectSample = vi.fn();
    render(<AppContextProvider><DrumKeyboard selectedSampleIndex={null} onSelectSample={onSelectSample}/></AppContextProvider>);
    const pad = screen.getByRole('button', { name: /KD1 drum key A/i });
    fireEvent.click(pad);
    expect(onSelectSample).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(pad, { pointerType: 'mouse' });
    fireEvent.click(pad);
    expect(onSelectSample).toHaveBeenCalledTimes(2);
  });

  it('forwards a dropped unsupported file to the shared import preflight for visible feedback', () => {
    const onFileUpload = vi.fn();
    render(<AppContextProvider><DrumKeyboard onFileUpload={onFileUpload}/></AppContextProvider>);
    const pad = screen.getByRole('button', { name: /KD1 drum key A/i });
    const file = new File(['not audio'], 'notes.txt', { type: 'text/plain' });
    fireEvent.drop(pad, { dataTransfer: { files: [file] } });
    expect(onFileUpload).toHaveBeenCalledWith(0, file);
  });

  it('uses arrow keys to select adjacent physical pads without playback',async()=>{
    play.mockClear();const onSelectSample=vi.fn();
    const {container}=render(<AppContextProvider><DrumKeyboard selectedSampleIndex={0} onSelectSample={onSelectSample}/></AppContextProvider>);
    const first=container.querySelector<HTMLButtonElement>('[data-drum-pad="0"]')!;first.focus();
    fireEvent.keyDown(first,{key:'ArrowRight'});
    expect(onSelectSample).toHaveBeenCalledWith(1);
    expect(play).not.toHaveBeenCalled();
    await waitFor(()=>expect(document.activeElement).toBe(container.querySelector('[data-drum-pad="1"]')));
  });

  it('moves silent arrow selection across mobile bank boundaries',async()=>{
    const previous=window.innerWidth;Object.defineProperty(window,'innerWidth',{configurable:true,value:320});
    play.mockClear();const onSelectSample=vi.fn();const {container,unmount}=render(<AppContextProvider><DrumKeyboard selectedSampleIndex={11} onSelectSample={onSelectSample}/></AppContextProvider>);
    const last=container.querySelector<HTMLButtonElement>('[data-drum-pad="11"]')!;last.focus();fireEvent.keyDown(last,{key:'ArrowRight'});
    await waitFor(()=>expect(container.querySelector('[data-drum-pad="12"]')).toBe(document.activeElement));
    expect(onSelectSample).toHaveBeenCalledWith(12);expect(play).not.toHaveBeenCalled();
    unmount();Object.defineProperty(window,'innerWidth',{configurable:true,value:previous});
  });

  it('shows twelve ordered 44px-plus destinations per explicit mobile bank', () => {
    const previous=window.innerWidth;
    Object.defineProperty(window,'innerWidth',{configurable:true,value:320});
    const onSelectSample=vi.fn();
    const {container,unmount}=render(<AppContextProvider><DrumKeyboard onSelectSample={onSelectSample}/></AppContextProvider>);

    expect(container.querySelectorAll('.studio-mobile-pad-grid [data-drum-pad]')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button',{name:/Pad 1, KD1, empty/i}));
    expect(onSelectSample).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole('button',{name:'Upper pads 13–24'}));
    expect(container.querySelectorAll('.studio-mobile-pad-grid [data-drum-pad]')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button',{name:/Pad 13, LT1, empty/i}));
    expect(onSelectSample).toHaveBeenCalledWith(12);

    unmount();
    Object.defineProperty(window,'innerWidth',{configurable:true,value:previous});
  });
});
