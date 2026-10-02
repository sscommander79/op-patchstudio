import {useState} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {NotificationSystem,type Notification} from '../../components/common/NotificationSystem';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('dismisses only the named notification through an accessible button',()=>{
 function Harness(){const [notifications,setNotifications]=useState<Notification[]>([{id:'one',type:'success',title:'Saved preset',message:'First notification'},{id:'two',type:'warning',title:'Another notice',message:'Second notification'}]);return <NotificationSystem notifications={notifications} onDismiss={id=>setNotifications(items=>items.filter(item=>item.id!==id))}/>;}
 render(<Harness/>);expect(screen.getByRole('region',{name:'Notifications'})).toHaveAttribute('aria-live','polite');fireEvent.click(screen.getByRole('button',{name:'Dismiss Saved preset notification'}));expect(screen.queryByText('First notification')).not.toBeInTheDocument();expect(screen.getByText('Second notification')).toBeVisible();
});
it('auto-dismisses at the specified duration and cleans timers on unmount',()=>{
 vi.useFakeTimers();const dismiss=vi.fn();const {unmount}=render(<NotificationSystem notifications={[{id:'one',type:'info',title:'Info',message:'Message',duration:1000}]} onDismiss={dismiss}/>);
 act(()=>vi.advanceTimersByTime(999));expect(dismiss).not.toHaveBeenCalled();act(()=>vi.advanceTimersByTime(1));expect(dismiss).toHaveBeenCalledWith('one');unmount();expect(vi.getTimerCount()).toBe(0);
});
