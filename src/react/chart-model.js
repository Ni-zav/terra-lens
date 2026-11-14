/** A continuous calendar domain; missing records are null, never zero-filled. */
export function buildChartModel(results, monthly, range) {
  if (!results.length) return {dates:[],series:[]};
  const available=results.flatMap(result=>monthly?result.monthly:result.annual);
  if (!available.length) return {dates:[],series:[]};
  const end=Math.max(...available.map(point=>point.year));
  const first=range==='10'?end-9:Math.min(...available.map(point=>point.year));
  const dates=[];
  for(let year=first;year<=end;year++) {
    if(monthly) for(let month=1;month<=12;month++) dates.push(`${year}-${String(month).padStart(2,'0')}`);
    else dates.push(String(year));
  }
  const key=point=>monthly?`${point.year}-${String(point.month).padStart(2,'0')}`:String(point.year);
  const colors=['#62d6e4','#f6b975','#a38cf8','#56d39a'];
  return {dates,series:results.map((item,index)=>{
    const data=new Map((monthly?item.monthly:item.annual).map(point=>[key(point),point.value]));
    const fit=new Map((item.trend?.fitted||[]).map(point=>[String(point.year),point.value]));
    return {id:item.id,label:item.label,color:item.color||colors[index%colors.length],
      slopePerDecade:item.trend?.slopePerDecade??null,
      values:dates.map(date=>data.get(date)??null),
      fit:monthly?[]:dates.map(date=>fit.get(date)??null)};
  })};
}
