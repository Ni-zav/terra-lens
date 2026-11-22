import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import * as echarts from 'echarts/core';
import {LineChart, BarChart} from 'echarts/charts';
import {GridComponent, TooltipComponent, DataZoomComponent, AriaComponent, MarkLineComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, DataZoomComponent, AriaComponent, MarkLineComponent, CanvasRenderer]);

import {buildChartModel, buildSeasonalModel} from './chart-model.js';
const fmt = n => Number.isFinite(n) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(n) : '—';
const signed = n => Number.isFinite(n) ? (n > 0 ? '+' : '') + new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n) : null;
const monoFont = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
const axisText = {color:'#52524f',fontSize:11,fontFamily:monoFont};
const tooltipBase = {backgroundColor:'rgba(255, 255, 255, 0.98)',borderColor:'#cfcec7',borderWidth:1,padding:[6,10],
  textStyle:{color:'#111111',fontSize:11,fontFamily:monoFont}};
const rgba = (hex, alpha) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})` : hex;
};

function useEChart() {
  const container=useRef(null), chart=useRef(null);
  useEffect(()=>{
    if (!container.current) return;
    const instance=echarts.init(container.current,undefined,{renderer:'canvas',devicePixelRatio:Math.min(window.devicePixelRatio||1,2)});
    chart.current=instance;
    const resize=new ResizeObserver(()=>instance.resize()); resize.observe(container.current);
    return ()=>{resize.disconnect();instance.dispose();chart.current=null;};
  },[]);
  return [container, chart];
}

function Legend({series, unit, showSlope, excluded}) {
  const markerGlyph = id => id === 'B' ? '◆' : id === 'C' ? '▲' : id === 'D' ? '■' : id === 'G' ? '○' : '●';
  return <div className="legend">{series.map(s=><span className="legend-item" key={s.id}><span className="legend-glyph" style={{color:s.color}} aria-hidden="true">{markerGlyph(s.id)}</span><strong className="legend-id" style={{color:s.color}}>{s.id}</strong><span>{s.label}</span>{showSlope&&s.slopePerDecade!==null&&<em className="legend-slope">{signed(s.slopePerDecade)} {unit}/dec</em>}</span>)}
    {excluded?.length>0&&<span className="legend-item legend-excluded" title="Inspect this series separately">{excluded.map(s=>s.id).join(', ')} separate source view</span>}</div>;
}

const symbolFor = id => id === 'B' ? 'diamond' : id === 'C' ? 'triangle' : id === 'D' ? 'rect' : id === 'G' ? 'emptyCircle' : 'circle';
const dashFor = id => id === 'B' ? [2, 3] : id === 'C' ? [7, 3, 2, 3] : [5, 4];

/** Annual, monthly-value and monthly-anomaly time series share one renderer. */
export function TimeChart({series, mode, range, setRange, setMode}) {
  const [container, chart] = useEChart();
  const [cursor,setCursor]=useState(0);
  const model=useMemo(()=>buildChartModel(series,{mode,range}),[series,mode,range]);
  const monthly=mode!=='annual', anomaly=mode==='anomaly', unit=model.unit;
  // Reset the cursor before paint when the dataset/range changes so slider interactions aren't overwritten.
  useLayoutEffect(()=>{setCursor(Math.max(0,model.dates.length-1));},[model]);
  useEffect(()=>{
    const instance=chart.current; if(!instance)return;
    const showArea = !anomaly && model.series.length <= 2;
    const dataSeries=model.series.flatMap(s=>[
      {id:s.id,name:`${s.id} · ${s.label}`,type:'line',data:s.values,connectNulls:false,showSymbol:!monthly,
        symbol:symbolFor(s.id),symbolSize:s.id==='B'?6.5:5.5,
        lineStyle:{width:monthly?1.6:2.25,color:s.color,cap:'round',join:'round'},
        itemStyle:{color:s.color,borderColor:'#ffffff',borderWidth:1.5},
        ...(showArea?{areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:rgba(s.color,0.09)},{offset:1,color:rgba(s.color,0.0)}])}}:{}),
        emphasis:{focus:'series',lineStyle:{width:monthly?2.2:2.8}}},
      ...(!monthly&&s.fit.some(v=>v!==null)?[{name:`${s.id} · ${s.label} OLS`,type:'line',data:s.fit,
        connectNulls:true,showSymbol:false,silent:true,lineStyle:{width:1.6,type:dashFor(s.id),color:s.color,opacity:.82}}]:[])
    ]);
    instance.setOption({animation:false,backgroundColor:'transparent',aria:{enabled:true,description:
      `${anomaly?'Monthly anomaly':monthly?'Monthly':'Annual'} NASA values in ${unit}. Use the date slider for exact values.`},
      grid:{left:46,right:14,top:20,bottom:24},
      tooltip:{...tooltipBase,trigger:'axis',axisPointer:{type:'cross',lineStyle:{color:'#9a9992',width:1,type:'dashed'},
        crossStyle:{color:'#9a9992',width:1,type:'dotted'},
        label:{show:true,backgroundColor:'#f8f8f6',borderColor:'#cfcec7',borderWidth:1,color:'#111111',fontFamily:monoFont,fontSize:10,padding:[3,6]}},
        valueFormatter:value=>value==null?'No record':(anomaly?signed(value)??'—':fmt(value))+' '+unit},
      xAxis:{type:'category',data:model.dates,boundaryGap:false,axisLine:{lineStyle:{color:'#cfcec7'}},
        axisTick:{show:true,lineStyle:{color:'#cfcec7'},length:3},
        splitLine:{show:true,lineStyle:{color:'#f1f0ec',width:1}},
        axisLabel:{...axisText,hideOverlap:true,margin:6,formatter:value=>monthly?(value.endsWith('-01')?value.slice(0,4):''):value}},
      yAxis:{type:'value',scale:!anomaly,axisLine:{show:true,lineStyle:{color:'#cfcec7'}},
        axisLabel:{...axisText,margin:6},splitLine:{lineStyle:{color:'#eae9e4',width:1,type:'dashed'}},
        name:anomaly?`Δ ${unit}`:unit,nameGap:6,nameTextStyle:{...axisText,align:'right'}},
      dataZoom:[{type:'inside',filterMode:'none',zoomOnMouseWheel:'ctrl',moveOnMouseMove:'shift'}],
      series:dataSeries},true);
    const onAxis=params=>{
      const value=params.axesInfo?.[0]?.value;
      const index=typeof value==='number'?Math.round(value):model.dates.indexOf(value);
      if(index>=0&&index<model.dates.length)setCursor(index);
    };
    instance.on('updateAxisPointer',onAxis);
    return ()=>instance.off('updateAxisPointer',onAxis);
  },[model,monthly,anomaly,unit]);
  const position=Math.min(cursor,Math.max(0,model.dates.length-1));
  useEffect(()=>{
    const instance=chart.current;
    if(!instance||!model.series.length||!model.dates.length)return;
    instance.setOption({series:[{id:model.series[0].id,markLine:{silent:true,symbol:'none',
      lineStyle:{color:'#2563eb',opacity:0.45,width:1.2,type:'dashed'},label:{show:false},
      data:[{xAxis:model.dates[position]},...(anomaly?[{yAxis:0,lineStyle:{color:'#9a9992',opacity:1,type:'solid'}}]:[])]}}]});
  },[model,position,anomaly]);
  const show=v=>v===null?'no record':(anomaly?signed(v):fmt(v))+' '+unit;
  const readout=model.dates.length ? model.dates[position]+' · '+model.series.map(s=>`${s.label}: ${show(s.values[position])}`).join(' / ') : 'Waiting for NASA data.';
  const idBase=monthly?'monthly':'annual';
  return <>
    <div className="chart-toolbar"><Legend series={model.series} unit={unit} showSlope={!monthly} excluded={model.excluded}/>
      <div className="chart-toolbar-groups">
        {monthly&&<div className="chart-range" role="group" aria-label="Monthly display mode">
          <button type="button" disabled={!series.length} aria-pressed={mode==='monthly'} onClick={()=>setMode('monthly')}>Values</button>
          <button type="button" id="anomaly-toggle" disabled={!series.length} aria-pressed={mode==='anomaly'} onClick={()=>setMode('anomaly')}>Anomaly</button>
        </div>}
        <div className="chart-range" role="group" aria-label={`${monthly?'Monthly':'Annual'} chart displayed period`}>
          <button type="button" disabled={!series.length} aria-pressed={range==='all'} onClick={()=>setRange('all')}>All</button>
          <button type="button" disabled={!series.length} aria-pressed={range==='10'} onClick={()=>setRange('10')}>10Y</button>
        </div>
      </div></div>
    <div className="echart" ref={container} role="img" aria-label={`${anomaly?'Monthly anomaly':monthly?'Monthly':'Annual'} NASA chart. Exact values are available with the date slider.`}/>
    <div className="chart-inspector"><label htmlFor={idBase+'-cursor'}>{monthly?'Month':'Year'}</label>
      <input id={idBase+'-cursor'} type="range" min="0" max={Math.max(0,model.dates.length-1)} value={position} disabled={!model.dates.length} aria-valuetext={readout} onChange={e=>setCursor(Number(e.target.value))}/>
      <output id={idBase+'-readout'}>{readout}</output></div>
    <div className="chart-foot">{anomaly?('Anomaly: value − that calendar month’s complete-year mean, removing the seasonal cycle'):monthly?'Missing months break the line':'Solid: annual mean · Dashed: full-period OLS fit'} · 10Y changes display only · Ctrl + scroll to zoom</div>
  </>;
}

/** Which calendar months changed most, and the mean seasonal cycle. */
export function SeasonalChart({series}) {
  const [container, chart] = useEChart();
  const [view,setView]=useState('trend'),[cursor,setCursor]=useState(0);
  const model=useMemo(()=>buildSeasonalModel(series),[series]);
  const unit=model.unit, trend=view==='trend';
  useEffect(()=>{
    const instance=chart.current; if(!instance)return;
    instance.setOption({animation:false,backgroundColor:'transparent',
      aria:{enabled:true,description:trend?`Per-calendar-month OLS trend in ${unit} per decade.`:`Mean seasonal cycle in ${unit}.`},
      grid:{left:46,right:14,top:20,bottom:24},
      tooltip:{...tooltipBase,trigger:'axis',axisPointer:{type:trend?'shadow':'line'},
        valueFormatter:v=>v==null?'Not estimated':(trend?signed(v):fmt(v))+' '+unit+(trend?'/dec':'')},
      xAxis:{type:'category',data:model.months,axisLine:{lineStyle:{color:'#cfcec7'}},axisLabel:{...axisText,margin:6},axisTick:{show:false}},
      yAxis:{type:'value',scale:!trend,axisLine:{show:true,lineStyle:{color:'#cfcec7'}},axisLabel:{...axisText,margin:6},
        splitLine:{lineStyle:{color:'#eae9e4',width:1,type:'dashed'}},name:trend?`${unit}/dec`:unit,nameGap:6,nameTextStyle:{...axisText,align:'right'}},
      series:model.series.map(s=>trend
        ?{id:s.id,name:`${s.id} · ${s.label}`,type:'bar',data:s.slopes,barMaxWidth:14,itemStyle:{color:s.color,opacity:0.9,borderRadius:[3,3,0,0]},
          emphasis:{itemStyle:{opacity:1}},
          markLine:{silent:true,symbol:'none',label:{show:false},lineStyle:{color:'#9a9992',type:'solid'},data:[{yAxis:0}]}}
        :{id:s.id,name:`${s.id} · ${s.label}`,type:'line',data:s.climatology,symbol:symbolFor(s.id),symbolSize:s.id==='B'?6.5:5.5,connectNulls:false,
          lineStyle:{width:2.25,color:s.color,cap:'round',join:'round'},itemStyle:{color:s.color,borderColor:'#ffffff',borderWidth:1.5}})},true);
    const onAxis=params=>{const value=params.axesInfo?.[0]?.value;const i=typeof value==='number'?value:model.months.indexOf(value);if(i>=0&&i<12)setCursor(i);};
    instance.on('updateAxisPointer',onAxis);
    return ()=>instance.off('updateAxisPointer',onAxis);
  },[model,trend,unit]);
  const readout=model.series.length?model.months[cursor]+' · '+model.series.map(s=>{
    const d=s.detail[cursor];
    return trend?`${s.label}: ${d.slopePerDecade===null?'not estimated':`${signed(d.slopePerDecade)} ${unit}/dec (n=${d.n})`}`
      :`${s.label}: ${s.climatology[cursor]===null?'no complete-year data':fmt(s.climatology[cursor])+' '+unit}`;
  }).join(' / '):'Waiting for NASA data.';
  return <>
    <div className="chart-toolbar"><Legend series={model.series} unit={unit} excluded={model.excluded}/>
      <div className="chart-range" role="group" aria-label="Seasonal view">
        <button type="button" aria-pressed={trend} onClick={()=>setView('trend')}>Trend by month</button>
        <button type="button" aria-pressed={!trend} onClick={()=>setView('cycle')}>Seasonal cycle</button>
      </div></div>
    <div className="echart" ref={container} role="img" aria-label="Seasonal NASA chart. Exact values are available with the month slider."/>
    <div className="chart-inspector"><label htmlFor="seasonal-cursor">Month</label>
      <input id="seasonal-cursor" type="range" min="0" max="11" value={cursor} disabled={!model.series.length} aria-valuetext={readout} onChange={e=>setCursor(Number(e.target.value))}/>
      <output id="seasonal-readout">{readout}</output></div>
    <div className="chart-foot">{trend?'Each bar: OLS slope of that calendar month across years · 12 parallel fits, descriptive only (no multiple-testing correction)':'Mean of each calendar month over complete years only'}</div>
  </>;
}
