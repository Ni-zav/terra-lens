import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {analyzeGiovanniArea} from '../src/science/giovanni-case.js';
const path='data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.csv';
const bytes=await readFile(path);
if(createHash('sha256').update(bytes).digest('hex')!=='ff7cd37fd010ae16015ce22400c2cb583c975c6d9277e0235cbd674d774e54dc') throw Error('Source checksum mismatch');
console.log(JSON.stringify(analyzeGiovanniArea(bytes.toString()),null,2));
