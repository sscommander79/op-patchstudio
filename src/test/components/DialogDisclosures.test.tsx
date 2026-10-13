import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {AccessibleDialog} from '../../components/common/AccessibleDialog';
describe('Dialog optional controls',()=>{
  it('cycles through summaries but skips controls inside a closed disclosure',async()=>{
    render(<AccessibleDialog labelledBy="title" onClose={vi.fn()}><h2 id="title">Example</h2><button>First</button><details><summary>More settings</summary><input aria-label="Hidden setting" data-initial-focus="true"/></details></AccessibleDialog>);
    const first=screen.getByRole('button',{name:'First'}),summary=screen.getByText('More settings');
    await waitFor(()=>expect(first).toHaveFocus());
    first.focus();fireEvent.keyDown(document,{key:'Tab',shiftKey:true});expect(summary).toHaveFocus();
    fireEvent.keyDown(document,{key:'Tab'});expect(first).toHaveFocus();
  });
});
