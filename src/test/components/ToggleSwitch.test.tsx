import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ToggleSwitch} from '../../components/common/ToggleSwitch';
afterEach(cleanup);
it('supports mouse and keyboard activation with exposed state',()=>{
 function Harness(){const [right,setRight]=useState(false);return <ToggleSwitch leftLabel="c3=60" rightLabel="c4=60" isRight={right} onToggle={()=>setRight(old=>!old)}/>;}
 render(<Harness/>);const toggle=screen.getByRole('switch',{name:'c4=60'});expect(toggle).toHaveAttribute('aria-checked','false');fireEvent.keyDown(toggle,{key:' '});expect(toggle).toHaveAttribute('aria-checked','true');fireEvent.keyDown(toggle,{key:' ',repeat:true});expect(toggle).toHaveAttribute('aria-checked','true');fireEvent.keyDown(toggle,{key:'Enter'});expect(toggle).toHaveAttribute('aria-checked','false');fireEvent.click(toggle);expect(toggle).toHaveAttribute('aria-checked','true');
});
it('disabled switches do not react to pointer or keyboard input',()=>{const change=vi.fn();render(<ToggleSwitch leftLabel="off" rightLabel="on" isRight={false} disabled onToggle={change}/>);const toggle=screen.getByRole('switch',{name:'on'});expect(toggle).toHaveAttribute('aria-disabled','true');expect(toggle).toHaveAttribute('tabindex','-1');fireEvent.click(toggle);fireEvent.keyDown(toggle,{key:'Enter'});expect(change).not.toHaveBeenCalled();});
