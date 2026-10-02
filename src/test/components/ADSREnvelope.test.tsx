import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ADSREnvelope} from '../../components/common/ADSREnvelope';
const amp={attack:0,decay:0,sustain:0,release:0},filter={attack:32767,decay:32767,sustain:32767,release:32767};
afterEach(cleanup);
it('switches the edited envelope with keyboard without changing stored values',()=>{
 const changeAmp=vi.fn(),changeFilter=vi.fn();render(<ADSREnvelope ampEnvelope={amp} filterEnvelope={filter} onAmpEnvelopeChange={changeAmp} onFilterEnvelopeChange={changeFilter}/>);
 const toggle=screen.getByRole('switch',{name:'Edit filter envelope'});expect(toggle).toHaveAttribute('aria-checked','false');expect(screen.getByRole('slider',{name:'attack'})).toHaveAttribute('aria-valuenow','0');fireEvent.keyDown(toggle,{key:' '});expect(toggle).toHaveAttribute('aria-checked','true');expect(screen.getByRole('slider',{name:'attack'})).toHaveAttribute('aria-valuenow','100');fireEvent.keyDown(screen.getByRole('slider',{name:'attack'}),{key:'ArrowLeft'});expect(changeFilter).toHaveBeenCalledWith({...filter,attack:32439});expect(changeAmp).not.toHaveBeenCalled();fireEvent.keyDown(toggle,{key:'Enter'});expect(toggle).toHaveAttribute('aria-checked','false');
});
it('applies a preset and randomization as one paired change each',()=>{
 const pair=vi.fn(),single=vi.fn();render(<ADSREnvelope ampEnvelope={amp} filterEnvelope={filter} onAmpEnvelopeChange={single} onFilterEnvelopeChange={single} onEnvelopesChange={pair}/>);
 fireEvent.change(screen.getByRole('combobox',{name:'Envelope preset'}),{target:{value:'bass'}});expect(pair).toHaveBeenCalledTimes(1);expect(pair).toHaveBeenLastCalledWith({attack:1000,decay:12000,sustain:28000,release:15000},{attack:0,decay:8000,sustain:20000,release:12000});
 fireEvent.click(screen.getByTitle('generate new random values'));expect(pair).toHaveBeenCalledTimes(2);expect(single).not.toHaveBeenCalled();for(const envelope of pair.mock.calls[1])for(const value of Object.values(envelope)){expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(32767);}
});

it('releases envelope drag listeners on cancellation and unmount',()=>{
 const changed=vi.fn();const {container,unmount}=render(<ADSREnvelope ampEnvelope={amp} filterEnvelope={filter} onAmpEnvelopeChange={changed} onFilterEnvelopeChange={vi.fn()}/>);const svg=container.querySelector('svg')!;
 Object.defineProperty(svg,'createSVGPoint',{value:()=>({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}})});Object.defineProperty(svg,'getScreenCTM',{value:()=>({inverse:()=>({})})});const attack=svg.querySelectorAll('circle')[1];const x=Number(attack.getAttribute('cx')),y=Number(attack.getAttribute('cy'));
 fireEvent.mouseDown(svg,{clientX:x,clientY:y});fireEvent.mouseMove(document,{clientX:x+30,clientY:y});expect(changed).toHaveBeenCalled();changed.mockClear();fireEvent.touchCancel(document);fireEvent.mouseMove(document,{clientX:x+40,clientY:y});expect(changed).not.toHaveBeenCalled();
 fireEvent.mouseDown(svg,{clientX:x,clientY:y});unmount();fireEvent.mouseMove(document,{clientX:x+50,clientY:y});expect(changed).not.toHaveBeenCalled();
});
