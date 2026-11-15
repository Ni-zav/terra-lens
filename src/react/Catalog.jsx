import React,{useEffect,useRef,useState} from 'react';
import {searchCmrCollections} from '../cmr.js';

export default function Catalog({region}) {
 const [term,setTerm]=useState(''),[result,setResult]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const active=useRef(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 useEffect(()=>{active.current?.abort();active.current=null;setLoading(false);setResult(null);setError('')},[region.west,region.south,region.east,region.north,region.start,region.end,term]);
 async function search(){
  active.current?.abort();const controller=new AbortController();active.current=controller;
  const timer=setTimeout(()=>controller.abort(),60000);setError('');setResult(null);setLoading(true);
  try{const data=await searchCmrCollections(term,region,{signal:controller.signal});if(active.current===controller)setResult(data)}
  catch(e){if(active.current===controller)setError(e.name==='AbortError'?'Catalog request timed out or was cancelled.':e.message)}
  finally{clearTimeout(timer);if(active.current===controller){active.current=null;setLoading(false)}}
 }
 return <section className="giovanni-card" aria-labelledby="catalog-title">
  <h3 id="catalog-title">Find datasets in NASA Earthdata (experimental)</h3>
  <p>Search NASA's collection catalog for the bounds and years above. Catalog overlap does not establish that observations exist at your exact location, that a variable is suitable, or that Terra-Lens can analyze the collection. Results may include partner data.</p>
  <label htmlFor="catalog-term">Dataset or topic</label><input id="catalog-term" value={term} maxLength="100" onChange={e=>setTerm(e.target.value)} placeholder="e.g. soil moisture" />
  <button type="button" id="catalog-search" disabled={loading} onClick={search}>{loading?'Searching NASA catalog…':'Search collections'}</button>
  <p className="giovanni-note">At most 10 collection records; successful searches are cached in this browser for 15 minutes. NASA's catalog may take up to a minute. No data archives are downloaded.</p>
  {error&&<p role="alert">{error}</p>}
  {result&&<div aria-live="polite"><p>{result.entries.length} collection records returned{result.cached?' (cached)':''}. <a href={result.url} target="_blank" rel="noreferrer">Original NASA catalog query</a></p>
   {result.entries.length>0&&<ul>{result.entries.map(e=><li key={e.id}><a href={e.url} target="_blank" rel="noreferrer">{e.title}</a> · {e.shortName} {e.version} · coverage {e.start?.slice(0,10)||'not stated'} to {e.end?.slice(0,10)||'open or not stated'}</li>)}</ul>}
  </div>}
 </section>;
}
