// Run against a local frontend. Playwright is supplied through PLAYWRIGHT_MODULE or installed locally.
// API fixtures exist only inside this browser context; they are never published to the app.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.BHAROSA_BASE_URL || 'http://127.0.0.1:5173';
const out = path.resolve('work/audit');
(async()=>{
  const {forecastFixture}=await import('./fixtures/forecast.mjs');
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
  const context=await browser.newContext();
  const cycle=forecastFixture();
  const archived=structuredClone(cycle);archived.issue.init_utc='2026-09-20T00:00:00Z';archived.generated_at=archived.issue.init_utc;
  const user={id:999,name:'UI test operator',email:'ui@example.test',role:'forecaster',home_region:'konkan',lead_day:1,alert_threshold:64.5,theme:'light',onboarded:true,created_at:new Date().toISOString(),is_admin:true};
  await context.route('**/api/v1/**',async route=>{
    const url=new URL(route.request().url());let data;let status=200;
    if(url.pathname==='/api/v1/cycle') data=url.searchParams.has('issue')?archived:cycle;
    else if(url.pathname==='/api/v1/cycles') data={issues:['20260920T00']};
    else if(url.pathname==='/api/v1/auth/me') data=user;
    else if(url.pathname==='/api/v1/alerts/acks') data=[];
    else if(url.pathname==='/api/v1/telemetry') {const point=cycle.points.find(p=>p.id===url.searchParams.get('point_id'));data={...point,point_id:point.id,is_coastal:false,fetched_at:new Date().toISOString(),air_quality:null,surface:null,marine:null,products:Object.fromEntries(['air_quality','surface','marine'].map(k=>[k,{status:k==='marine'?'not_applicable':'unavailable',source:'UI fixture',kind:'modelled'}]))};}
    else if(url.pathname==='/api/v1/admin/overview') data={status:'operational',checked_at:new Date().toISOString(),freshness_limit_hours:24,cycle:{init_utc:cycle.issue.init_utc,generated_at:cycle.generated_at,issue_age_hours:1,publication_age_hours:1,points:4,records:60,live_sources:2,latest_rain_truth_date:'2026-09-25'},sources:cycle.sources.map(s=>({...s,record_count:60,status:'participating'})),users:{total:1,onboarded:1,acknowledgements:0},exports:{cycles:1,scorecard:false,validation:false},note:'Synthetic UI fixture. Backend authorization is tested separately.'};
    else {status=503;data={detail:'Not available in isolated test'};}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const watermark=async()=>page.addStyleTag({content:'body::after {content:"SYNTHETIC UI TEST · NOT A WEATHER FORECAST";position:fixed;bottom:0;right:0;z-index:9999;background:#fef3c7;color:#78350f;font:9px system-ui;padding:3px 6px;pointer-events:none;}'});
  const noOverflow=async(name)=>{if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)){console.log(await page.evaluate(()=>[...document.querySelectorAll('main *')].map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right,text:el.textContent.slice(0,60)})).filter(r=>r.right>innerWidth+1).slice(0,14)));await page.screenshot({path:path.join(out,'overflow-debug.png'),fullPage:true});}assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Page overflow: ${name}`);};
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/app');await page.getByLabel('CHOOSE YOUR DISTRICT').waitFor();
  await page.getByLabel('CHOOSE YOUR DISTRICT').selectOption('mumbai');
  await page.getByRole('button',{name:'Explore in 3D'}).click();await page.getByLabel('Rotate rainfall view').waitFor();
  await page.getByRole('button',{name:/Day 3.*mm/}).click();assert.match(page.url(),/lead=3/);
  await noOverflow('desktop briefing');await watermark();await page.screenshot({path:path.join(out,'after-briefing-desktop.png'),fullPage:true});
  for(const width of [768,390,320]){await page.setViewportSize({width,height:844});await noOverflow(`${width}px briefing`);if(width===390){assert.equal(await page.locator('.prism-side').first().evaluate(el=>getComputedStyle(el).display),'none');assert.notEqual(await page.locator('.rain-prism').first().evaluate(el=>getComputedStyle(el).backgroundImage),'none');}if(width===390)await page.screenshot({path:path.join(out,'after-briefing-mobile.png'),fullPage:true});}
  await page.getByRole('combobox',{name:'Region',exact:true}).selectOption('kerala');await page.waitForFunction(()=>document.querySelector('#briefing-district')?.value==='thrissur');assert.equal(await page.getByLabel('CHOOSE YOUR DISTRICT').inputValue(),'thrissur');
  await page.getByRole('button',{name:'Open navigation'}).click();assert.equal(await page.getByRole('dialog').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').isVisible(),false);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>getComputedStyle(document.querySelector('.spatial-stage')).transform==='none');assert.equal(await page.locator('.spatial-stage').evaluate(el=>getComputedStyle(el).transform),'none');
  await page.goto(base+'/app/districts?region=konkan&district=mumbai');await page.locator('.leaflet-container').waitFor();await page.getByRole('combobox',{name:'Region',exact:true}).selectOption('kerala');await page.waitForTimeout(600);const map=await page.locator('.leaflet-container').boundingBox();const marker=await page.locator('.leaflet-marker-icon[title="Thrissur"]').boundingBox();assert.ok(marker && marker.x>=map.x && marker.x<=map.x+map.width,'map refits to Kerala');await noOverflow('320px district');
  await page.goto(base+'/app/forecast');await page.getByLabel('Forecast publication').selectOption('20260920T00');await page.getByText('Viewing an archived forecast publication.').waitFor();await noOverflow('320px forecast');await page.getByRole('button',{name:'Return to latest'}).click();assert.ok(!page.url().includes('issue='));
  for(const route of ['alerts','models','verification','settings']){await page.goto(base+'/app/'+route);await page.waitForTimeout(300);await noOverflow(`320px ${route}`);}
  await page.evaluate(u=>localStorage.setItem('bharosa.session',JSON.stringify({state:{mode:'account',token:'ui-test-token',user:u},version:0})),user);
  await page.goto(base+'/admin');await page.getByRole('heading',{name:'Publication health'}).waitFor();
  await page.setViewportSize({width:1440,height:1000});await noOverflow('admin desktop');await watermark();await page.screenshot({path:path.join(out,'after-admin-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await noOverflow('admin mobile');await page.screenshot({path:path.join(out,'after-admin-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[],'No uncaught application errors');
  console.log('PASS: district/day selection, CSS 3D, 320/390/768/1440 layouts, map region refit, history/return to latest, reduced motion, mobile dialog, all secondary routes, admin layout; no uncaught errors.');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
