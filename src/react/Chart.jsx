import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as echarts from 'echarts/core';
import {LineChart, BarChart} from 'echarts/charts';
import {GridComponent, TooltipComponent, DataZoomComponent, AriaComponent, MarkLineComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, DataZoomComponent, AriaComponent, MarkLineComponent, CanvasRenderer]);

import {buildChartModel, buildSeasonalModel} from './chart-model.js';
const fmt = n => Number.isFinite(n) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(n) : '—';
const signed = n => Number.isFinite(n) ? (n > 0 ? '+' : '') + new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n) : null;
const monoFont = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
const axisText = {color:'#8eaab8',fontSize:10,fontFamily:monoFont};
const tooltipBase = {backgroundColor:'rgba(7, 17, 27, 0.96)',borderColor:'#2c4a5e',borderWidth:1,padding:[6,10],
  textStyle:{color:'#e7f1f4',fontSize:11,fontFamily:monoFont}};

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
  return <div className="legend">{series.map(s=><span className="legend-item" key={s.id}><i className="legend-dot" style={{background:s.color}}/><strong className="legend-id" style={{color:s.color}}>{s.id}</strong><span>{s.label}</span>{showSlope&&s.slopePerDecade!==null&&<em className="legend-slope">{signed(s.slopePerDecade)} {unit}/dec</em>}</span>)}
    {excluded?.length>0&&<span className="legend-item legend-excluded" title="Different unit; shown in anomaly (σ) view">{excluded.map(s=>s.id).join(', ')} hidden · different unit</span>}</div>;
}

/** Annual, monthly-value and monthly-anomaly time series share one renderer. */
export function TimeChart({series, mode, range, setRange, setMode}) {
  const [container, chart] = useEChart();
  const [cursor,setCursor]=useState(0);
  const model=useMemo(()=>buildChartModel(series,{mode,range}),[series,mode,range]);
  const monthly=mode!=='annual', anomaly=mode==='anomaly', unit=model.unit;
  useEffect(()=>{setCursor(Math.max(0,model.dates.length-1));},[model]);
  useEffect(()=>{
    const instance=chart.current; if(!instance)return;
    const dataSeries=model.series.flatMap(s=>[
      {id:s.id,name:`${s.id} · ${s.label}`,type:'line',data:s.values,connectNulls:false,showSymbol:!monthly,
        symbol:'circle',symbolSize:4.5,lineStyle:{width:monthly?1.35:2,color:s.color},itemStyle:{color:s.color,borderColor:'#071019',borderWidth:1},
        emphasis:{focus:'series',lineStyle:{width:monthly?2:2.6}}},
      ...(!monthly&&s.fit.some(v=>v!==null)?[{name:`${s.id} · ${s.label} OLS`,type:'line',data:s.fit,
        connectNulls:true,showSymbol:false,silent:true,lineStyle:{width:1.4,type:[5,4],color:s.color,opacity:.85}}]:[])
    ]);
    instance.setOption({animation:false,backgroundColor:'transparent',aria:{enabled:true,description:
      `${anomaly?'Monthly anomaly':monthly?'Monthly':'Annual'} NASA values in ${unit}. Use the date slider for exact values.`},
      grid:{left:46,right:14,top:20,bottom:24},
      tooltip:{...tooltipBase,trigger:'axis',axisPointer:{type:'cross',lineStyle:{color:'#4d7288',width:1,type:'dashed'},
        crossStyle:{color:'#39586b',width:1,type:'dotted'},
        label:{show:true,backgroundColor:'#0b1a27',borderColor:'#2c4a5e',borderWidth:1,color:'#e4f0f5',fontFamily:monoFont,fontSize:10,padding:[3,6]}},
        valueFormatter:value=>value==null?'No record':(anomaly?signed(value)??'—':fmt(value))+' '+unit},
      xAxis:{type:'category',data:model.dates,boundaryGap:false,axisLine:{lineStyle:{color:'#263d4f'}},
        axisTick:{show:true,lineStyle:{color:'#263d4f'},length:3},
        splitLine:{show:true,lineStyle:{color:'#0f1e2c',width:1}},
        axisLabel:{...axisText,hideOverlap:true,margin:6,formatter:value=>monthly?(value.endsWith('-01')?value.slice(0,4):''):value}},
      yAxis:{type:'value',scale:!anomaly,axisLine:{show:true,lineStyle:{color:'#263d4f'}},
        axisLabel:{...axisText,margin:6},splitLine:{lineStyle:{color:'#162838',width:1}},
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
      lineStyle:{color:'#9ec2cf',width:1,type:'dashed'},label:{show:false},
      data:[{xAxis:model.dates[position]},...(anomaly?[{yAxis:0,lineStyle:{color:'#5d7f90',type:'solid'}}]:[])]}}]});
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
    <div className="chart-inspector"><label htmlFor={idBase+'-cursor'}>{monthly?'MONTH':'YEAR'}</label>
      <input id={idBase+'-cursor'} type="range" min="0" max={Math.max(0,model.dates.length-1)} value={position} disabled={!model.dates.length} aria-valuetext={readout} onChange={e=>setCursor(Number(e.target.value))}/>
      <output id={idBase+'-readout'}>{readout}</output></div>
    <div className="chart-foot">{anomaly?(model.standardized?'Standardized anomaly: (value − month mean) ÷ month s.d., because units differ':'Anomaly: value − that calendar month’s complete-year mean, removing the seasonal cycle'):monthly?'Missing months break the line':'Solid: annual mean · Dashed: full-period OLS fit'} · 10Y changes display only · Ctrl + scroll to zoom</div>
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
      xAxis:{type:'category',data:model.months,axisLine:{lineStyle:{color:'#263d4f'}},axisLabel:{...axisText,margin:6},axisTick:{show:false}},
      yAxis:{type:'value',scale:!trend,axisLine:{show:true,lineStyle:{color:'#263d4f'}},axisLabel:{...axisText,margin:6},
        splitLine:{lineStyle:{color:'#162838',width:1}},name:trend?`${unit}/dec`:unit,nameGap:6,nameTextStyle:{...axisText,align:'right'}},
      series:model.series.map(s=>trend
        ?{id:s.id,name:`${s.id} · ${s.label}`,type:'bar',data:s.slopes,barMaxWidth:12,itemStyle:{color:s.color,borderRadius:[2,2,0,0]},
          markLine:{silent:true,symbol:'none',label:{show:false},lineStyle:{color:'#5d7f90',type:'solid'},data:[{yAxis:0}]}}
        :{id:s.id,name:`${s.id} · ${s.label}`,type:'line',data:s.climatology,symbol:'circle',symbolSize:5,connectNulls:false,
          lineStyle:{width:2,color:s.color},itemStyle:{color:s.color,borderColor:'#071019',borderWidth:1}})},true);
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
    <div className="chart-inspector"><label htmlFor="seasonal-cursor">MONTH</label>
      <input id="seasonal-cursor" type="range" min="0" max="11" value={cursor} disabled={!model.series.length} aria-valuetext={readout} onChange={e=>setCursor(Number(e.target.value))}/>
      <output id="seasonal-readout">{readout}</output></div>
    <div className="chart-foot">{trend?'Each bar: OLS slope of that calendar month across years · 12 parallel fits, descriptive only (no multiple-testing correction)':'Mean of each calendar month over complete years only'}</div>
  </>;
}
