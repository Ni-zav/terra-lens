import React,{useEffect,useRef,useState} from 'react';
import {searchCmrCollections,searchCmrVariables} from '../cmr.js';

export default function Catalog({region}) {
 const [term,setTerm]=useState(''),[result,setResult]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [variables,setVariables]=useState(null),[variableError,setVariableError]=useState(''),[variableLoading,setVariableLoading]=useState(false),[variableFilter,setVariableFilter]=useState('');
 const active=useRef(null),variableActive=useRef(null);
 useEffect(()=>()=>{active.current?.abort();variableActive.current?.abort()},[]);
 useEffect(()=>{active.current?.abort();active.current=null;variableActive.current?.abort();variableActive.current=null;setLoading(false);setResult(null);setError('');setVariables(null);setVariableError('');setVariableLoading(false)},[region.west,region.south,region.east,region.north,region.start,region.end,term]);
 async function search(){
  active.current?.abort();const controller=new AbortController();active.current=controller;
  variableActive.current?.abort();variableActive.current=null;setVariables(null);setVariableError('');setVariableLoading(false);
  const timer=setTimeout(()=>controller.abort(),60000);setError('');setResult(null);setLoading(true);
  try{const data=await searchCmrCollections(term,region,{signal:controller.signal});if(active.current===controller)setResult(data)}
  catch(e){if(active.current===controller)setError(e.name==='AbortError'?'Catalog request timed out or was cancelled.':e.message)}
  finally{clearTimeout(timer);if(active.current===controller){active.current=null;setLoading(false)}}
 }
 async function findVariables(collection){
  variableActive.current?.abort();const controller=new AbortController();variableActive.current=controller;
  const timer=setTimeout(()=>controller.abort(),60000);setVariableError('');setVariables(null);setVariableFilter('');setVariableLoading(true);
  try{const data=await searchCmrVariables(collection.id,{signal:controller.signal});if(variableActive.current===controller)setVariables({collection,...data})}
  catch(e){if(variableActive.current===controller)setVariableError(e.name==='AbortError'?'Variable lookup timed out or was cancelled.':e.message)}
  finally{clearTimeout(timer);if(variableActive.current===controller){variableActive.current=null;setVariableLoading(false)}}
 }
 return <section className="giovanni-card giovanni-tutorial" aria-labelledby="catalog-title">
  <h3 id="catalog-title">Find datasets in NASA Earthdata (experimental)</h3>
  <p>Search NASA's collection catalog for the bounds and years above. Catalog overlap does not establish that observations exist at your exact location, that a variable is suitable, or that Terra-Lens can analyze the collection. Results may include partner data.</p>
  <label htmlFor="catalog-term">Dataset or topic</label><input id="catalog-term" type="text" value={term} maxLength="100" onChange={e=>setTerm(e.target.value)} placeholder="e.g. soil moisture" />
  <button type="button" id="catalog-search" disabled={loading} onClick={search}>{loading?'Searching NASA catalog…':'Search collections'}</button>
  <p className="giovanni-note">At most 10 collection records; successful searches are cached in this browser for 15 minutes. NASA's catalog may take up to a minute. No data archives are downloaded.</p>
  {error&&<p role="alert">{error}</p>}
  {result&&<div><p aria-live="polite">{result.entries.length} collection records returned{result.cached?' (cached)':''}. <a href={result.url} target="_blank" rel="noreferrer">Original NASA catalog query</a></p>
   {result.entries.length>0&&<ul>{result.entries.map(e=><li key={e.id}><a href={e.url} target="_blank" rel="noreferrer">{e.title}</a> · {e.shortName} {e.version} · coverage {e.start?.slice(0,10)||'not stated'} to {e.end?.slice(0,10)||'open or not stated'} <button type="button" disabled={variableLoading} aria-label={`View variables for ${e.shortName||e.id}`} onClick={()=>findVariables(e)}>View variables</button></li>)}</ul>}
   {variableLoading&&<p role="status">Loading NASA variable metadata…</p>}{variableError&&<p role="alert">{variableError}</p>}
   {variables&&<section aria-label="Catalog variable results"><p role="status">{variables.entries.length} explicitly associated variable records for {variables.collection.shortName||variables.collection.id}{variables.cached?' (cached)':''}. {variables.truncated?'Only the first 100 matching records were checked. ':''}<a href={variables.url} target="_blank" rel="noreferrer">Original NASA variable query</a></p>
    <p className="giovanni-note">Metadata is not a quality check or an analysis adapter. No returned records does not prove a collection has no variables. Verify units, fill values, support and methods before use.</p>
    {variables.entries.length>0&&<><label htmlFor="catalog-variable-filter">Filter returned variables</label><input id="catalog-variable-filter" type="text" value={variableFilter} onChange={e=>setVariableFilter(e.target.value)} placeholder="e.g. T2M"/><ul>{variables.entries.filter(v=>(v.name+' '+v.longName).toLowerCase().includes(variableFilter.trim().toLowerCase())).map(v=><li key={v.id}><a href={v.url} target="_blank" rel="noreferrer">{v.name}</a>{v.longName?` · ${v.longName}`:''} · unit {v.unit||'not stated'}{v.fillValues.length?` · declared fill ${v.fillValues.join(', ')}`:''}</li>)}</ul></>}
   </section>}
  </div>}
 </section>;
}
