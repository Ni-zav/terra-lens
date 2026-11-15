import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeGiovanniTutorial} from '../src/science/giovanni-tutorial.js';

test('NASA tutorial snapshot retains exact bytes and descriptive seasonal results', () => {
  const bytes=readFileSync(new URL('../data/source-snapshots/nasa-giovanni-hwf-jja-tutorial.csv',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'34193c502c6417eb1163967a33dc2b19a87ea8be5518142f6196cb77b0a2b8fd');
  const a=analyzeGiovanniTutorial(bytes.toString('utf8'));
  assert.equal(a.rows.length,44);
  assert.ok(Math.abs(a.canada.slopePerDecade-0.190274841437632)<1e-12);
  assert.ok(Math.abs(a.unitedStates.slopePerDecade-0.390415785764623)<1e-12);
  assert.throws(()=>analyzeGiovanniTutorial(bytes.toString('utf8').replace('1981,2,1','1980,2,1')),/Duplicate/);
});
