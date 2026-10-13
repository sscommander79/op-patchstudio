import {useState} from 'react';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect,it} from 'vitest';
import {DraftNumberInput} from '../../components/common/DraftNumberInput';
function Harness(){const [value,setValue]=useState(-12);return <><DraftNumberInput aria-label="Gain" min={-30} max={20} value={value} onValueChange={setValue}/><output>{value}</output><button>Next</button></>}
it('lets a negative value be retyped and never commits an empty value as zero',async()=>{const user=userEvent.setup();render(<Harness/>);const input=screen.getByRole('spinbutton',{name:'Gain'});await user.clear(input);expect(screen.getByRole('status')).toHaveTextContent('-12');await user.type(input,'-24');await user.tab();expect(input).toHaveValue(-24);expect(screen.getByRole('status')).toHaveTextContent('-24');});
it('restores a cleared value and bounds an out-of-range typed value on blur',async()=>{const user=userEvent.setup();render(<Harness/>);const input=screen.getByRole('spinbutton',{name:'Gain'});await user.clear(input);await user.tab();expect(input).toHaveValue(-12);await user.clear(input);await user.type(input,'99');await user.tab();expect(input).toHaveValue(20);});
