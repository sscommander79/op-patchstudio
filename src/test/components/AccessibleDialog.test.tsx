import { useRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AccessibleDialog } from '../../components/common/AccessibleDialog';

function NestedDialogs() {
  const [outer,setOuter]=useState(false),[inner,setInner]=useState(false);
  const launchOuter=useRef<HTMLButtonElement>(null),launchInner=useRef<HTMLButtonElement>(null);
  return <><button ref={launchOuter} onClick={()=>setOuter(true)}>Open outer</button>
    {outer&&<AccessibleDialog labelledBy="outer-title" onClose={()=>setOuter(false)} returnFocus={launchOuter.current}>
      <h2 id="outer-title">Outer</h2><button ref={launchInner} onClick={()=>setInner(true)}>Open inner</button><button>Outer last</button>
      {inner&&<AccessibleDialog labelledBy="inner-title" onClose={()=>setInner(false)} returnFocus={launchInner.current}>
        <h2 id="inner-title">Inner</h2><button data-initial-focus="true">Inner first</button><button>Inner last</button>
      </AccessibleDialog>}
    </AccessibleDialog>}
  </>;
}

describe('owned dialog focus',()=>{
  it('traps the topmost nested dialog, closes only it on Escape, and restores each trigger',async()=>{
    const user=userEvent.setup();render(<NestedDialogs/>);
    await user.click(screen.getByRole('button',{name:'Open outer'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Open inner'})).toHaveFocus());
    await user.click(screen.getByRole('button',{name:'Open inner'}));
    const first=screen.getByRole('button',{name:'Inner first'}),last=screen.getByRole('button',{name:'Inner last'});
    await waitFor(()=>expect(first).toHaveFocus());
    last.focus();fireEvent.keyDown(document,{key:'Tab'});expect(first).toHaveFocus();
    first.focus();fireEvent.keyDown(document,{key:'Tab',shiftKey:true});expect(last).toHaveFocus();
    fireEvent.keyDown(document,{key:'Escape'});
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Inner'})).not.toBeInTheDocument());
    expect(screen.getByRole('dialog',{name:'Outer'})).toBeInTheDocument();
    await waitFor(()=>expect(screen.getByRole('button',{name:'Open inner'})).toHaveFocus());
    fireEvent.keyDown(document,{key:'Escape'});
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Outer'})).not.toBeInTheDocument());
    expect(screen.getByRole('button',{name:'Open outer'})).toHaveFocus();
  });
});
