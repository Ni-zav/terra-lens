import test from 'node:test';
import assert from 'node:assert/strict';
import {pointToVector, vectorToPoint} from '../src/globe.js';

test('globe coordinates round-trip across hemispheres and the antimeridian', () => {
  for (const [lat,lon] of [[-7.7956,110.3695],[0,0],[35,-120],[80,179.9],[-65,-179.9]]) {
    const actual=vectorToPoint(pointToVector(lat,lon));
    assert.ok(Math.abs(actual.lat-lat)<1e-9, `latitude ${lat}`);
    assert.ok(Math.abs(actual.lon-lon)<1e-9, `longitude ${lon}`);
  }
});
