import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastFreshness, selectDistrict, districtLink } from '../src/features/forecast/domain.ts';
import { parseCycle } from '../src/features/forecast/contract.ts';
import { forecastFixture } from './fixtures/forecast.mjs';
test('republished old runs stay stale and future clocks are unverified',()=>{
  const now=Date.parse('2026-09-28T00:00:00Z');
  assert.equal(forecastFreshness({issue:{init_utc:'2026-09-20T00:00:00Z'},generated_at:'2026-09-28T00:00:00Z'},now).state,'stale');
  assert.equal(forecastFreshness({issue:{init_utc:'2030-09-20T00:00:00Z'},generated_at:'2026-09-28T00:00:00Z'},now).state,'unknown');
  assert.equal(forecastFreshness(undefined,now).state,'missing');
});
test('district selection respects the current region and links preserve it',()=>{
  const cycle=forecastFixture();
  assert.equal(selectDistrict(cycle,'kerala','mumbai').id,'thrissur');
  assert.equal(selectDistrict(cycle,'konkan','mumbai').id,'mumbai');
  assert.equal(districtLink('kerala','thrissur',3),'/app/districts?region=kerala&district=thrissur&lead=3');
});
test('publication contract accepts valid zero rainfall and rejects invalid or duplicate records',()=>{
  const cycle=forecastFixture();cycle.forecasts[0].blend=0;
  assert.equal(parseCycle(cycle).forecasts[0].blend,0);
  for(const change of [c=>c.forecasts[0].blend=null,c=>c.forecasts.push(c.forecasts[0]),c=>c.forecasts[0].prob['64.5']=1.5,c=>c.points[0].lat=999,c=>c.issue.lead_dates['1']='invalid',c=>c.forecasts[0].skill.gfs_global.mae='8']){
    const invalid=forecastFixture();change(invalid);assert.throws(()=>parseCycle(invalid),/incomplete or invalid/);
  }
});


test('rainfall categories follow the IMD daily thresholds', async () => {
  const { imdCategory } = await import('../src/lib/imd.ts');
  for (const [amount, expected] of [[0,'No rain / trace'],[0.1,'Very light'],[2.5,'Light'],[15.5,'Light'],[15.6,'Moderate'],[64.4,'Moderate'],[64.5,'Heavy'],[115.6,'Very heavy'],[204.5,'Extremely heavy']]) {
    assert.equal(imdCategory(amount).label, expected);
  }
});
