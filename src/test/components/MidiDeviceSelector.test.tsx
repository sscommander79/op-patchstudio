import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MidiDeviceSelector} from '../../components/common/MidiDeviceSelector';
const midi=vi.hoisted(()=>({state:{isSupported:true,isInitialized:false,isConnecting:false,devices:[{id:'in',name:'Test input',type:'input'},{id:'out',name:'Test output',type:'output'}],error:null},initialize:vi.fn(async()=>{}),refreshDevices:vi.fn()}));
vi.mock('../../hooks/useWebMidi',()=>({useWebMidi:()=>midi}));
beforeEach(()=>{vi.clearAllMocks();midi.state.isSupported=true;midi.state.isInitialized=false;midi.state.isConnecting=false;});
afterEach(()=>{cleanup();vi.useRealTimers();});
it('initializes only on Connect, rescans explicitly, and publishes a selected channel',async()=>{
 vi.useFakeTimers();const change=vi.fn();const {rerender}=render(<MidiDeviceSelector onChannelChange={change}/>);expect(midi.initialize).not.toHaveBeenCalled();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/connect/i}));});expect(midi.initialize).toHaveBeenCalledOnce();await act(async()=>{await vi.advanceTimersByTimeAsync(100);});expect(midi.refreshDevices).toHaveBeenCalledOnce();
 midi.state.isInitialized=true;rerender(<MidiDeviceSelector onChannelChange={change}/>);expect(screen.getByText('2 connected')).toBeVisible();fireEvent.click(screen.getByTitle('Rescan MIDI devices'));expect(midi.refreshDevices).toHaveBeenCalledTimes(2);
 fireEvent.change(screen.getByRole('combobox',{name:'MIDI audition channel'}),{target:{value:'16'}});expect(change).toHaveBeenCalledWith(16);expect(screen.getByRole('combobox',{name:'MIDI audition channel'})).toHaveValue('16');
 midi.state.isConnecting=true;rerender(<MidiDeviceSelector onChannelChange={change}/>);expect(screen.getByTitle('Rescan MIDI devices')).toBeDisabled();
});
it('shows unsupported state without requesting access',()=>{midi.state.isSupported=false;render(<MidiDeviceSelector/>);expect(screen.getByText('webmidi not supported')).toBeVisible();expect(screen.queryByRole('button')).not.toBeInTheDocument();expect(midi.initialize).not.toHaveBeenCalled();});
