import {test,expect} from './control-audit-test';
// Exercise link routing only. External destinations are intercepted, so no
// payment, feedback submission, login, or third-party availability is tested.
test('support and footer links open their declared destinations without external requests',async({page,context})=>{
 await context.route(/^https:\/\//,route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Isolated destination</title><p>Test destination</p>'}));
 for(const route of ['/#/studio/overview','/#/donate','/#/feedback']){
  await page.goto(route);const links=page.locator('a[href^="https://"]');await expect(links.first()).toBeVisible();const count=await links.count();expect(count).toBeGreaterThan(0);
  for(let i=0;i<count;i++){const link=links.nth(i),href=(await link.getAttribute('href'))!;await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('rel',/noopener/);const opened=page.waitForEvent('popup');await link.click();const popup=await opened;await expect(popup).toHaveURL(href);await popup.close();}
 }
});

test('remote post links use validated destinations with a synthetic feed',async({page,context})=>{
 await context.route(/^https:\/\//,route=>route.request().url().includes('allorigins.win')?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:'audit',attributes:{title:'Audit post',content:'Synthetic feed only.',published_at:'2026-09-01',url:'https://www.patreon.com/posts/audit'}}]})}):route.fulfill({status:200,body:'Isolated destination'}));
 await page.goto('/#/donate');await expect(page.getByText('Audit post',{exact:true})).toBeVisible();for(const name of ['read more →','continue on patreon']){const link=page.getByRole('link',{name:new RegExp(name)});const href=await link.getAttribute('href');const opening=page.waitForEvent('popup');await link.click();const popup=await opening;await expect(popup).toHaveURL(href!);await popup.close();}
});
