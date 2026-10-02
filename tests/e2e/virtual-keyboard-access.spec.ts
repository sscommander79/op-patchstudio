import {expect,test} from '@playwright/test';
import {gotoWorkspace} from './workspace-actions';

test('virtual notes support roving focus, visible focus and empty-note selection',async({page})=>{
  await gotoWorkspace(page,'multisample');
  const note=(number:number)=>page.getByRole('button',{name:`MIDI note ${number}, empty`,exact:true});
  await expect(note(72)).toHaveAttribute('tabindex','0');
  await note(72).focus();
  await page.keyboard.press('ArrowRight');
  await expect(note(73)).toBeFocused();
  await expect(note(72)).toHaveAttribute('tabindex','-1');
  await expect(note(73)).toHaveAttribute('tabindex','0');
  await expect(note(73)).toBeInViewport();
  const outline=await note(73).evaluate(element=>({style:getComputedStyle(element).outlineStyle,width:getComputedStyle(element).outlineWidth}));
  expect(outline.style).not.toBe('none');expect(parseFloat(outline.width)).toBeGreaterThan(0);
  await page.keyboard.press('ArrowLeft');await expect(note(72)).toBeFocused();
  await note(0).focus();await page.keyboard.press('ArrowLeft');await expect(note(0)).toBeFocused();
  await note(127).focus();await page.keyboard.press('ArrowRight');await expect(note(127)).toBeFocused();
  await note(73).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('region',{name:'Multisample instrument, 0 of 24 loaded',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
