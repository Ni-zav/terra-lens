import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/power.js';

const endpoint = 'https://terra-lens.example/api/power';
const valid = 'parameters=T2M&latitude=-7.7956&longitude=110.3695&start=2001&end=2024';

test('proxy never turns missing coordinates into valid zero coordinates', async () => {
  for (const query of [
    'parameters=T2M&start=2001&end=2024',
    'parameters=T2M&latitude=&longitude=1&start=2001&end=2024',
    valid.replace('T2M', 'INVALID'),
    valid.replace('latitude=-7.7956', 'latitude=99'),
    valid.replace('start=2001', 'start=1980'),
  ]) {
    const response = await onRequestGet({request: new Request(endpoint + '?' + query)});
    assert.equal(response.status, 400, 'Expected request rejection: ' + query);
  }
});

test('allowlisted upstream request is forwarded with provenance intact', async () => {
  const realFetch = globalThis.fetch;
  let requested;
  globalThis.fetch = async url => {
    requested = new URL(url);
    return new Response(JSON.stringify({properties:{parameter:{T2M:{'202401':28}}}}),
      {headers:{'content-type':'application/json'}});
  };
  try {
    const response = await onRequestGet({request:new Request(endpoint + '?' + valid)});
    assert.equal(response.status, 200);
    assert.equal(requested.hostname, 'power.larc.nasa.gov');
    assert.equal(requested.searchParams.get('latitude'), '-7.7956');
    assert.equal(requested.searchParams.get('parameters'), 'T2M');
    assert.equal((await response.json()).properties.parameter.T2M['202401'], 28);
  } finally { globalThis.fetch = realFetch; }
});
