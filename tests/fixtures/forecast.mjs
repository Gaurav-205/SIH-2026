// Synthetic contract/UI fixture. Never imported by src/, backend/, or the live pipeline.
export function forecastFixture() {
  const issue = new Date();
  const leadDates = Object.fromEntries([1,2,3,4,5].map(d=>[String(d),new Date(issue.getTime()+d*86400000).toISOString().slice(0,10)]));
  const points = [
    {id:'palghar',name:'Palghar',region:'konkan',lat:19.7,lon:72.8,elevation_m:12},
    {id:'mumbai',name:'Mumbai',region:'konkan',lat:19.07,lon:72.88,elevation_m:14},
    {id:'pune-ghats',name:'Pune Ghats',region:'konkan',lat:18.7,lon:73.4,elevation_m:640},
    {id:'thrissur',name:'Thrissur',region:'kerala',lat:10.52,lon:76.21,elevation_m:10},
  ];
  const forecasts = points.flatMap((p,i)=>[1,2,3,4,5].flatMap(lead=>['rain','tmax','wind'].map(variable=>{
    const blend=variable==='rain' ? [24.6,48.3,82.5,35.4,12.8][lead-1]+i*2 : variable==='tmax'? 30:5;
    return {point_id:p.id,lead,date:leadDates[String(lead)],var:variable,blend,p10:Math.max(0,blend*.4),p90:blend*1.8,sigma:blend*.35,equal_mean:blend+1,spread_sd:2,method:'stage_a',weights:{gfs_global:.6,icon_global:.4},values:{gfs_global:blend-2,icon_global:blend+3},corrected:{gfs_global:blend-2,icon_global:blend+3},skill:{gfs_global:{mae:8,bias:1,n:30,scope:'point'},icon_global:{mae:10,bias:2,n:30,scope:'point'}},prob:variable==='rain'?{'64.5':.2,'115.6':.05,'204.5':.01}:undefined,alert_level:variable==='rain'&&blend>=64.5?'Yellow':null,reasons:{gfs_global:[{effect:'up',text:'Synthetic fixture reason for UI testing'}]}};
  })));
  return {version:1,generated_at:issue.toISOString(),issue:{init_utc:issue.toISOString(),lead_dates:leadDates},method:{name:'Stage A test fixture',half_life_days:20,window_days:90,min_pairs:5},truth:{rain:'IMD rainfall (test fixture)',tmax:'IMD temperature (test fixture)',wind:'ERA5 (test fixture)',latest_rain_truth_date:'2026-09-25',ledger_as_of:'2026-09-25'},sources:[{id:'gfs_global',label:'GFS',family:'physics',live:true,run_init_utc:issue.toISOString()},{id:'icon_global',label:'ICON',family:'physics',live:true,run_init_utc:issue.toISOString()}],regions:[{id:'konkan',name:'Konkan & Goa'},{id:'kerala',name:'Kerala'}],points,thresholds_mm:[64.5,115.6,204.5],forecasts,attribution:'SYNTHETIC UI TEST FIXTURE — not a weather forecast.'};
}
