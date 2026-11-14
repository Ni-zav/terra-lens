/**
 * Conservative, user-consumable cross-source evidence. A pair of different
 * satellites/models only becomes comparable after explicit support checks.
 */
export function powerMonthlyContext(powerMonthly, {variable='PRECTOTCORR'}={}) {
  if(!['PRECTOTCORR','T2M','RH2M'].includes(variable))throw new RangeError('Unsupported POWER context variable');
  const unit={PRECTOTCORR:'mm/day',T2M:'°C',RH2M:'%'}[variable];
  const months=new Map();
  for(const r of powerMonthly){
    if(!Number.isInteger(r.year)||!Number.isInteger(r.month)||r.month<1||r.month>12||!Number.isFinite(r.value))
      continue;
    const date=String(r.year)+'-'+String(r.month).padStart(2,'0');
    if(months.has(date))throw new Error('Duplicate POWER month');
    months.set(date,{month:date,value:r.value,unit,variable,
      support:'NASA POWER monthly model grid-cell estimate'});
  }
  return [...months.values()].sort((a,b)=>a.month.localeCompare(b.month));
}
export function alignSWOTandPOWER(swotMonthly,powerMonths){
  const meteorology=new Map(powerMonths.map(m=>[m.month,m]));
  const paired=swotMonthly.filter(m=>meteorology.has(m.month))
    .map(swot=>({month:swot.month,swotMeanObservedM:swot.meanObserved,
      swotMinObservedM:swot.minObserved,swotMaxObservedM:swot.maxObserved,
      swotPasses:swot.count,swotWorstQuality:swot.maxQuality,
      powerValue:meteorology.get(swot.month).value,
      powerVariable:meteorology.get(swot.month).variable,
      powerUnit:meteorology.get(swot.month).unit}));
  const missingPower=swotMonthly.filter(m=>!meteorology.has(m.month)).map(m=>m.month);
  return {pairs:paired,excludedSWOTMonthsMissingPOWER:missingPower,
    interpretation:'Juxtaposed, NOT physically harmonized: NASA SWOT satellite passes over a single river reach versus NASA POWER monthly reanalysis cell estimates. A match by calendar month is not proof of shared watershed influence, causation, river discharge or flood risk.'};
}
export function descriptiveAssociation(pairs,{minPairs=6}={}){
  if(!Number.isInteger(minPairs)||minPairs<6)throw new RangeError('Require at least six matched months');
  if(pairs.length<minPairs)return {status:'insufficient',n:pairs.length,
    reason:'Fewer than six matched observed months; no association coefficient reported.'};
  const x=pairs.map(p=>p.powerValue),y=pairs.map(p=>p.swotMeanObservedM);
  if([...x,...y].some(v=>!Number.isFinite(v)))throw new Error('Cannot correlate missing observations');
  const xbar=x.reduce((a,b)=>a+b,0)/x.length,ybar=y.reduce((a,b)=>a+b,0)/y.length;
  let xx=0,yy=0,xy=0;
  for(let i=0;i<x.length;i++){
    xx+=(x[i]-xbar)**2;yy+=(y[i]-ybar)**2;xy+=(x[i]-xbar)*(y[i]-ybar);
  }
  if(xx<1e-14||yy<1e-14)return {status:'undefined',n:pairs.length,
    reason:'One variable has nearly no sample variance.'};
  const r=Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy)));
  return {status:'descriptive',n:pairs.length,pearsonR:r,
    inference:'No p-value or causal inference. Serial/seasonal dependence, unequal reach/grid support, sparse SWOT overpass sampling, variable selection and seasonal confounding have not been modeled.',
    notFor:'Flood warning, discharge estimation, river management advice or long-term significant-trend comparison'};
}
export function buildWaterCase({swot,power,contextLocation,question='How did a river reach change during satellite overpasses, and what was modeled precipitation context nearby?'}) {
  if(!swot?.observations?.length)throw new Error('Real SWOT observations required');
  const powerMonths=powerMonthlyContext(power.monthly,{variable:'PRECTOTCORR'});
  const alignment=alignSWOTandPOWER(swot.monthly,powerMonths);
  const association=descriptiveAssociation(alignment.pairs);
  const heights=swot.observations.map(r=>r.value);
  const earliest=swot.observations[0].time,latest=swot.observations.at(-1).time;
  return {
    schema:'terra-lens-cross-source-water-v1',question,
    simple:{
      title:'River levels from space, with nearby rainfall context',
      whatChanged:'Between the captured satellite overpasses, observed water-surface elevation spanned '+(Math.max(...heights)-Math.min(...heights)).toFixed(2)+' m at this reach. This is not a continuous-time rise or flood-stage estimate.',
      where:contextLocation,
      period:earliest.slice(0,10)+' to '+latest.slice(0,10),
      observationCount:swot.observations.length,commonMonths:alignment.pairs.length,
      nextStep:'Check local gauges, upstream watershed rain and official flood bulletins before responding to an event.',
      limitation:'SWOT observes a river reach intermittently; POWER precipitation is modelled at a nearby grid cell. Neither indicates a forecast, flooding extent, water safety or causation.'
    },
    advanced:{
      sourceA:{name:swot.source,product:swot.collection,version:'D',
        quantity:swot.quantity,unit:swot.unit,url:swot.sourceURL,retrievedAt:swot.retrievedAt,
        temporalSupport:swot.temporalSupport,spatialSupport:swot.spatialSupport,
        overpasses:swot.observations,excluded:swot.excluded,qualityCounts:swot.qualityCounts},
      sourceB:{name:power.source,variable:'PRECTOTCORR',unit:'mm/day',
        url:power.url,retrievedAt:power.fetchedAt,
        months:powerMonths},
      harmonization:alignment,association,
      method:'Observed SWOT pass heights grouped by UTC month (arithmetic sample means only); NASA POWER monthly average daily precipitation rate at nearby cell. Calendar-month overlap only. No shared-pixel or watershed model. No long-term slope/significance on a two-month event.',
      caveats:['SWOT water surface elevation relative to a geoid is not water depth','Do not infer flood thresholds from water height alone','Quality 1/2 flags and WSE uncertainty require review','POWER is a reanalysis cell, not a catchment rainfall total','Temporal correlation of sparse samples is not causal','Do not extrapolate to entire river basin or location population']
    }
  };
}
