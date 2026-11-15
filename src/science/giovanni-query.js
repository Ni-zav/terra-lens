/** Construct a Giovanni query for the one validated area-mean product.
 * Giovanni performs the request in its own site; no Earthdata token enters this app.
 */
export function giovanniTemperatureQuery({west,south,east,north,start,end}) {
  const values=[west,south,east,north].map(v=>typeof v==='string'&&v.trim()===''?NaN:Number(v));
  const [w,s,e,n]=values, first=Number(start),last=Number(end);
  if(values.some(v=>!Number.isFinite(v)) || w < -180 || e > 180 || s < -90 || n > 90 || w>=e || s>=n)
    throw Error('Enter valid west, south, east and north bounds; antimeridian-crossing boxes are not supported.');
  if(!Number.isInteger(first)||!Number.isInteger(last)||first<1980||last>2025||first>last)
    throw Error('Choose whole years from 1980 through 2025.');
  const params=new URLSearchParams({service:'ArAvTs',starttime:`${first}-01-01T00:00:00Z`,endtime:`${last}-12-31T23:59:59Z`,
    bbox:values.join(','),data:'M2TMNXSLV_5_12_4_T2M'});
  return 'https://giovanni.gsfc.nasa.gov/giovanni/#'+params.toString();
}
