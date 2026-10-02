import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FourKnobControl} from '../../components/common/FourKnobControl';
const defaults=[{label:'attack',value:50,color:'black'},{label:'decay',value:50,color:'dark'},{label:'sustain',value:50,color:'light'},{label:'release',value:50,color:'white'}] as const;
afterEach(cleanup);
it('makes every envelope knob keyboard operable and clamps its bounds',()=>{
 function Harness(){const [values,setValues]=useState([50,50,50,50]);return <FourKnobControl knobs={defaults.map((knob,index)=>({...knob,value:values[index]})) as Parameters<typeof FourKnobControl>[0]['knobs']} onValueChange={(index,value)=>setValues(old=>old.map((item,i)=>i===index?value:item))}/>;}
 render(<Harness/>);
 for(const {label} of defaults){const knob=screen.getByRole('slider',{name:label});expect(knob).toHaveAttribute('tabindex','0');fireEvent.keyDown(knob,{key:'ArrowUp'});expect(knob).toHaveAttribute('aria-valuenow','51');fireEvent.keyDown(knob,{key:'ArrowDown'});expect(knob).toHaveAttribute('aria-valuenow','50');fireEvent.keyDown(knob,{key:'Home'});fireEvent.keyDown(knob,{key:'ArrowLeft'});expect(knob).toHaveAttribute('aria-valuenow','0');fireEvent.keyDown(knob,{key:'End'});fireEvent.keyDown(knob,{key:'ArrowRight'});expect(knob).toHaveAttribute('aria-valuenow','100');}
});
it('mouse dragging updates only the selected knob and stops after release or unmount',()=>{
 const change=vi.fn();const {unmount}=render(<FourKnobControl knobs={defaults.map(knob=>({...knob})) as Parameters<typeof FourKnobControl>[0]['knobs']} onValueChange={change}/>);
 const attack=screen.getByRole('slider',{name:'attack'});fireEvent.mouseDown(attack,{clientY:100});fireEvent.mouseMove(document,{clientY:80});expect(change).toHaveBeenLastCalledWith(0,60);fireEvent.mouseUp(document);change.mockClear();fireEvent.mouseMove(document,{clientY:60});expect(change).not.toHaveBeenCalled();fireEvent.mouseDown(attack,{clientY:100});unmount();fireEvent.mouseMove(document,{clientY:60});expect(change).not.toHaveBeenCalled();
});
it('touch cancel removes drag listeners',()=>{
 const change=vi.fn();render(<FourKnobControl knobs={defaults.map(knob=>({...knob})) as Parameters<typeof FourKnobControl>[0]['knobs']} onValueChange={change}/>);
 const release=screen.getByRole('slider',{name:'release'});fireEvent.touchStart(release,{touches:[{clientY:100}]});fireEvent.touchMove(document,{touches:[{clientY:80}]});expect(change).toHaveBeenLastCalledWith(3,60);fireEvent.touchCancel(document);change.mockClear();fireEvent.touchMove(document,{touches:[{clientY:60}]});expect(change).not.toHaveBeenCalled();
});
