import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {useState} from 'react';
import {NoteSuggestion} from '../../components/common/NoteSuggestion';
const mocks=vi.hoisted(()=>({suggest:vi.fn()}));
vi.mock('../../utils/noteSuggestion',()=>({suggestOriginalNote:mocks.suggest}));
afterEach(()=>{cleanup();vi.clearAllMocks()});
const buffer={} as AudioBuffer;const label=(n:number)=>n===69?'A4':`Note ${n}`;
it('waits for Yes and collapses to one assignment confirmation',async()=>{
 mocks.suggest.mockResolvedValue({midiNote:69});const confirm=vi.fn();
 function Harness(){const [note,setNote]=useState<number>();return <NoteSuggestion audioBuffer={buffer} noteLabel={label} confirmedNote={note} onConfirm={n=>{confirm(n);setNote(n)}}/>}
 render(<Harness/>);expect(await screen.findByText('This recording sounds like A4. Assign it to the A4 key?')).toBeInTheDocument();
 expect(confirm).not.toHaveBeenCalled();expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Yes, assign to A4'}));expect(confirm).toHaveBeenCalledWith(69);
 expect(screen.getByText('Assigned to A4')).toBeInTheDocument();expect(screen.queryByRole('button',{name:/Yes, assign/})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Change'}));expect(screen.getByRole('combobox',{name:'Assign to key'})).toBeInTheDocument();
});
it('shows the key picker only after No and assigns the chosen value',async()=>{
 mocks.suggest.mockResolvedValue({midiNote:69});const confirm=vi.fn();render(<NoteSuggestion audioBuffer={buffer} noteLabel={label} onConfirm={confirm}/>);
 fireEvent.click(await screen.findByRole('button',{name:'No, choose another key'}));
 expect(screen.queryByRole('button',{name:/Yes, assign/})).not.toBeInTheDocument();
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'60'}});expect(confirm).toHaveBeenCalledWith(60);
 expect(screen.getByText(/doesn’t retune/)).toBeInTheDocument();
});
it('offers manual assignment when analysis and metadata cannot identify a note',async()=>{
 mocks.suggest.mockResolvedValue(null);render(<NoteSuggestion audioBuffer={buffer} noteLabel={label} onConfirm={vi.fn()}/>);
 expect(await screen.findByRole('combobox')).toBeInTheDocument();expect(screen.getByText(/couldn’t identify/)).toBeInTheDocument();
});
it('treats metadata as a suggestion, never consent',async()=>{
 mocks.suggest.mockResolvedValue(null);const confirm=vi.fn();render(<NoteSuggestion audioBuffer={buffer} noteLabel={label} suggestedNote={69} onConfirm={confirm}/>);
 expect(await screen.findByText('Your file or chosen destination suggests A4. Assign it to the A4 key?')).toBeInTheDocument();expect(confirm).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Yes, assign to A4'})).toBeEnabled();
});
it('does not let late analysis overwrite a newer file',async()=>{
 let resolve!:(x:{midiNote:number})=>void;mocks.suggest.mockReturnValueOnce(new Promise(r=>resolve=r)).mockResolvedValueOnce(null);
 const props={noteLabel:label,onConfirm:vi.fn()};const view=render(<NoteSuggestion {...props} audioBuffer={buffer}/>);view.rerender(<NoteSuggestion {...props} audioBuffer={{} as AudioBuffer}/>);
 await screen.findByText(/couldn’t identify/);resolve({midiNote:69});await waitFor(()=>expect(screen.queryByText(/This recording sounds like/)).not.toBeInTheDocument());
});
it('analyzes only the selected section and rechecks changed bounds',async()=>{
 mocks.suggest.mockResolvedValue({midiNote:69});const pcm=Float32Array.from([1,2,3,4,5,6,7,8]);const source={length:8,sampleRate:8,numberOfChannels:1,getChannelData:()=>pcm} as unknown as AudioBuffer;
 const props={audioBuffer:source,noteLabel:label,onConfirm:vi.fn()};const view=render(<NoteSuggestion {...props} section={{inPoint:.25,outPoint:.75}}/>);
 await screen.findByText(/This recording sounds like/);expect(Array.from(mocks.suggest.mock.calls[0][0].getChannelData(0))).toEqual([3,4,5,6]);
 view.rerender(<NoteSuggestion {...props} section={{inPoint:0,outPoint:.25}}/>);await waitFor(()=>expect(mocks.suggest).toHaveBeenCalledTimes(2));expect(Array.from(mocks.suggest.mock.calls[1][0].getChannelData(0))).toEqual([1,2]);
});
