import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {useState} from 'react';
import {SampleSectionPicker} from '../../components/common/SampleSectionPicker';
import type {SampleSection} from '../../utils/sampleSection';
const seen=vi.hoisted(()=>({buffers:[] as AudioBuffer[]}));
vi.mock('../../components/common/WaveformZoomModal',()=>({WaveformZoomModal:(props:{audioBuffer:AudioBuffer;initialInPoint:number;initialOutPoint:number;onSave:(a:number,b:number)=>void;onClose:()=>void})=>{
 seen.buffers.push(props.audioBuffer);return <div role="dialog"><output>{props.initialInPoint} to {props.initialOutPoint}</output><button onClick={()=>{props.onSave(.2,.6);props.onClose()}}>Use this section</button><button onClick={props.onClose}>Cancel</button></div>;
}}));
afterEach(cleanup);
it('keeps the original for reopening and leaves selection unchanged on cancel',()=>{
 const original={length:100,sampleRate:100} as AudioBuffer;
 function Harness(){const [section,setSection]=useState<SampleSection>();return <SampleSectionPicker label="test" audioBuffer={original} section={section} onChange={setSection}/>}
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Choose a section of test'}));
 expect(screen.getByText('0 to 1')).toBeInTheDocument();fireEvent.click(screen.getByText('Use this section'));
 expect(screen.getByText('0.20–0.60 s selected')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Choose a section of test'}));
 expect(screen.getByText('0.2 to 0.6')).toBeInTheDocument();expect(seen.buffers.every(buffer=>buffer===original)).toBe(true);
 fireEvent.click(screen.getByText('Cancel'));expect(screen.getByText('0.20–0.60 s selected')).toBeInTheDocument();
});
