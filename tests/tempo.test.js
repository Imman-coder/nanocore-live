import test from 'node:test';
import assert from 'node:assert/strict';
import { tapBpm, delayMs, normalizedForMs, SIGNATURES, SUBDIVISIONS } from '../src/core/tempo.js';

test('tap tempo averages recent taps into a BPM', () => {
  assert.equal(tapBpm([1000, 1500, 2000, 2500], 2600), 120);
  assert.equal(tapBpm([1000], 1100), null);
  assert.equal(tapBpm([1000, 5000], 5100), null, 'stale taps are ignored');
});

test('delay time follows BPM, time signature and subdivision', () => {
  assert.equal(delayMs(120, '4/4', '1/4'), 500);
  assert.equal(delayMs(120, '4/4', '1/8'), 250);
  assert.equal(delayMs(120, '4/4', '1/8d'), 375);
  assert.equal(delayMs(120, '6/8', '1/4'), 750);
  assert.ok(SIGNATURES.includes('4/4'));
  assert.ok(SUBDIVISIONS.some((s) => s.id === '1/8d'));
});

test('delay milliseconds map into a parameter range', () => {
  assert.equal(normalizedForMs(1000, 0, 2000), 0.5);
  assert.equal(normalizedForMs(3000, 0, 2000), 1);
  assert.equal(normalizedForMs(-5, 0, 2000), 0);
});
