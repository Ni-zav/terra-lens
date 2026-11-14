import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as echarts from 'echarts/core';
import {LineChart} from 'echarts/charts';
import {GridComponent, TooltipComponent, DataZoomComponent, AriaComponent, MarkLineComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, AriaComponent, MarkLineComponent, CanvasRenderer]);

import {buildChartModel} from './chart-model.js';
const fmt = n => Number.isFinite(n) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(n) : '—';
const signed = n => Number.isFinite(n) ? (n > 0 ? '+' : '') + new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n) : null;

export function TimeChart({results, monthly, unit, range, setRange}) {
  const container=useRef(null), chart=useRef(null);
  const [cursor,setCursor]=useState(0);
  const model=useMemo(()=>buildChartModel(results,monthly,range),[results,monthly,range]);
  useEffect(()=>{setCursor(Math.max(0,model.dates.length-1));},[model]);
  useEffect(()=>{
    if (!container.current) return;
    const instance=echarts.init(container.current,undefined,{renderer:'canvas',devicePixelRatio:Math.min(window.devicePixelRatio||1,2)});
    chart.current=instance;
    const resize=new ResizeObserver(()=>instance.resize()); resize.observe(container.current);
    return ()=>{resize.disconnect();instance.dispose();chart.current=null;};
  },[]);
  useEffect(()=>{
    const instance=chart.current; if(!instance)return;
    const monoFont = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
    const dataSeries=model.series.flatMap(s=>[
      {id:s.id,name:`${s.id} · ${s.label}`,type:'line',data:s.values,connectNulls:false,showSymbol:!monthly,
        symbol:'circle',symbolSize:4.5,lineStyle:{width:monthly?1.35:2,color:s.color},itemStyle:{color:s.color,borderColor:'#071019',borderWidth:1},
        emphasis:{focus:'series',lineStyle:{width:monthly?2:2.6}}},
      ...(!monthly&&s.fit.some(v=>v!==null)?[{name:`${s.id} · ${s.label} OLS`,type:'line',data:s.fit,
        connectNulls:true,showSymbol:false,silent:true,lineStyle:{width:1.4,type:[5,4],color:s.color,opacity:.85}}]:[])
    ]);
    instance.setOption({animation:false,backgroundColor:'transparent',aria:{enabled:true,description:
      `${monthly?'Monthly':'Annual'} NASA POWER values in ${unit}. Use the date slider for exact values.`},
      grid:{left:46,right:14,top:20,bottom:24},
      tooltip:{trigger:'axis',axisPointer:{type:'cross',lineStyle:{color:'#4d7288',width:1,type:'dashed'},
        crossStyle:{color:'#39586b',width:1,type:'dotted'},
        label:{show:true,backgroundColor:'#0b1a27',borderColor:'#2c4a5e',borderWidth:1,color:'#e4f0f5',fontFamily:monoFont,fontSize:10,padding:[3,6]}},
        backgroundColor:'rgba(7, 17, 27, 0.96)',borderColor:'#2c4a5e',borderWidth:1,padding:[6,10],
        textStyle:{color:'#e7f1f4',fontSize:11,fontFamily:monoFont},
        valueFormatter:value=>value==null?'No record':fmt(value)+' '+unit},
      xAxis:{type:'category',data:model.dates,boundaryGap:false,axisLine:{lineStyle:{color:'#263d4f'}},
        axisTick:{show:true,lineStyle:{color:'#263d4f'},length:3},
        splitLine:{show:true,lineStyle:{color:'#0f1e2c',width:1}},
        axisLabel:{color:'#8eaab8',fontSize:10,fontFamily:monoFont,hideOverlap:true,margin:6,
          formatter:value=>monthly?(value.endsWith('-01')?value.slice(0,4):''):value}},
      yAxis:{type:'value',scale:true,axisLine:{show:true,lineStyle:{color:'#263d4f'}},
        axisLabel:{color:'#8eaab8',fontSize:10,fontFamily:monoFont,margin:6},
        splitLine:{lineStyle:{color:'#162838',width:1}},
        name:unit,nameGap:6,nameTextStyle:{color:'#8eaab8',fontSize:10,fontFamily:monoFont,align:'right'}},
      dataZoom:[{type:'inside',filterMode:'none',zoomOnMouseWheel:'ctrl',moveOnMouseMove:'shift'}],
      series:dataSeries},true);
    const onAxis=params=>{
      const value=params.axesInfo?.[0]?.value;
      const index=typeof value==='number'?Math.round(value):model.dates.indexOf(value);
      if(index>=0&&index<model.dates.length)setCursor(index);
    };
    instance.on('updateAxisPointer',onAxis);
    return ()=>instance.off('updateAxisPointer',onAxis);
  },[model,monthly,unit]);
  const position=Math.min(cursor,Math.max(0,model.dates.length-1));
  useEffect(()=>{
    const instance=chart.current;
    if(!instance||!model.series.length||!model.dates.length)return;
    instance.setOption({series:[{id:model.series[0].id,markLine:{silent:true,symbol:'none',
      lineStyle:{color:'#9ec2cf',width:1,type:'dashed'},label:{show:false},
      data:[{xAxis:model.dates[position]}]}}]});
  },[model,position]);
  const readout=model.dates.length ? model.dates[position]+' · '+model.series.map(s=>
    `${s.label}: ${s.values[position]===null?'no record':fmt(s.values[position])+' '+unit}`).join(' / ') : 'Waiting for NASA data.';
  return <>
    <div className="chart-toolbar"><div className="legend">{model.series.map(s=><span className="legend-item" key={s.id}><i className="legend-dot" style={{background:s.color}}/><strong className="legend-id" style={{color:s.color}}>{s.id}</strong><span>{s.label}</span>{!monthly&&s.slopePerDecade!==null&&<em className="legend-slope">{signed(s.slopePerDecade)} {unit}/dec</em>}</span>)}</div>
      <div className="chart-range" role="group" aria-label={`${monthly?'Monthly':'Annual'} chart displayed period`}>
        <button type="button" disabled={!results.length} aria-pressed={range==='all'} onClick={()=>setRange('all')}>All</button>
        <button type="button" disabled={!results.length} aria-pressed={range==='10'} onClick={()=>setRange('10')}>10Y</button>
      </div></div>
    <div className="echart" ref={container} role="img" aria-label={`${monthly?'Monthly':'Annual'} NASA POWER chart. Exact values are available with the date slider.`}/>
    <div className="chart-inspector"><label htmlFor={monthly?'monthly-cursor':'annual-cursor'}>{monthly?'MONTH':'YEAR'}</label>
      <input id={monthly?'monthly-cursor':'annual-cursor'} type="range" min="0" max={Math.max(0,model.dates.length-1)} value={position} disabled={!model.dates.length} aria-valuetext={readout} onChange={e=>setCursor(Number(e.target.value))}/>
      <output id={monthly?'monthly-readout':'annual-readout'}>{readout}</output></div>
    <div className="chart-foot">{monthly?'Missing months break the line':'Solid: annual mean · Dashed: full-period OLS fit'} · 10Y changes display only · Ctrl + scroll to zoom</div>
  </>;
}
