import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ccToValue,
  valueToCc,
  enumToCc,
  ccToEnum,
  onOffToCc,
} from '../src/core/scaling.js';

test('linear continuous scaling maps the ends of the range', () => {
  assert.equal(valueToCc(0, 0, 100), 0);
  assert.equal(valueToCc(100, 0, 100), 127);
  assert.equal(ccToValue(0, -100, 0), -100);
  assert.equal(ccToValue(127, -100, 0), 0);
  assert.equal(ccToValue(64, 0, 127), 64);
});

test('continuous scaling clamps out-of-range values and handles a zero-width range', () => {
  assert.equal(valueToCc(-5, 0, 100), 0);
  assert.equal(valueToCc(500, 0, 100), 127);
  assert.equal(ccToValue(127, 5, 5), 5);
  assert.equal(valueToCc(7, 5, 5), 0);
});

test('continuous scaling rounds to the nearest CC', () => {
  assert.equal(valueToCc(50, 0, 100), 64);
  assert.equal(valueToCc(49, 0, 100), 62);
  assert.equal(Math.round(ccToValue(63, 0, 100)), 50);
});

test('enum options occupy equal buckets and decode from the bucket centre', () => {
  const opts = ['room', 'plate', 'hall', 'concert'];
  assert.deepEqual([0, 1, 2, 3].map((i) => enumToCc(i, opts)), [16, 48, 80, 112]);
  assert.equal(ccToEnum(0, opts), 0);
  assert.equal(ccToEnum(31, opts), 0);
  assert.equal(ccToEnum(32, opts), 1);
  assert.equal(ccToEnum(127, opts), 3);
  assert.equal(enumToCc(3, ['a', 'b']), 127);
});

test('four-way LFO waveform split uses the documented 0/32/64/96 boundaries', () => {
  const wave = ['sine', 'triangle', 'square', 'saw'];
  assert.equal(ccToEnum(0, wave), 0);
  assert.equal(ccToEnum(31, wave), 0);
  assert.equal(ccToEnum(32, wave), 1);
  assert.equal(ccToEnum(64, wave), 2);
  assert.equal(ccToEnum(96, wave), 3);
  assert.equal(ccToEnum(127, wave), 3);
});

test('on/off is sent as boundary values and decoded at the midpoint', () => {
  assert.equal(onOffToCc(false), 0);
  assert.equal(onOffToCc(true), 127);
  assert.equal(ccToValue(63, 0, 1) >= 0.5, false);
  assert.equal(ccToValue(64, 0, 1) >= 0.5, true);
});
