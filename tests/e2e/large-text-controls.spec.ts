import {test,expect} from './control-audit-test';
import {expectDrumLoaded} from './workspace-actions';
for(const width of [390,1440])for(const percent of [150,200])for(const appearance of ['field','opxy'])for(const theme of ['light','dark']) {
  test(`readable toolbar ${width}px ${percent}% ${appearance} ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.addInitScript(({appearance,theme})=>{localStorage.setItem('opstudio-appearance',appearance);localStorage.setItem('opstudio-theme',theme);},{appearance,theme});
    await page.goto('/#/studio/drum');
    await page.getByRole('button',{name:'Load demo kit',exact:true}).click();await expectDrumLoaded(page,10);
    await page.addStyleTag({content:`html{font-size:${percent}% !important}`});
    const toolbar=page.getByRole('region',{name:'Instrument project controls'});
    const controls=toolbar.locator('button,summary,input');
    for(const control of await controls.all()) {
      if(!await control.isVisible())continue;
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport({ratio:.98});
      expect(await control.evaluate(el=>{
        const r=el.getBoundingClientRect();
        for(let a=el.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect();if(/hidden|clip|auto|scroll/.test(s.overflowX)&&(r.left<b.left-1||r.right>b.right+1))return false;if(/hidden|clip|auto|scroll/.test(s.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))return false;}
        return true;
      }),'whole control remains inside any clipping ancestors').toBe(true);
      if(await control.evaluate(e=>e.tagName!=='INPUT'))expect(await control.evaluate(e=>e.scrollWidth-e.clientWidth),'button/summary text fits').toBeLessThanOrEqual(1);
    }
    expect((await toolbar.getByRole('textbox',{name:'Instrument name'}).boundingBox())!.width).toBeGreaterThan(150);
    const location=page.locator('.studio-shell-location');
    expect(await location.evaluate(el=>{const r=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);return [...range.getClientRects()].every(t=>t.left>=r.left-1&&t.right<=r.right+1&&t.top>=r.top-1&&t.bottom<=r.bottom+1);}),'entire breadcrumb fits, including wrapped lines').toBe(true);
    const selector=page.getByRole('combobox',{name:'Theme',exact:true});
    for(const choice of [theme,'system']) {
      await selector.selectOption(choice);
      expect(await selector.evaluate(el=>{const select=el as HTMLSelectElement,s=getComputedStyle(el),ctx=document.createElement('canvas').getContext('2d')!;ctx.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;return select.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)-ctx.measureText(select.selectedOptions[0].text).width;}),'selected theme has room for text and native arrow').toBeGreaterThan(20);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}
