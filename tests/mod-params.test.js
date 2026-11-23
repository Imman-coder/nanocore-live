import test from 'node:test';
import assert from 'node:assert/strict';
import { mod } from '../src/data/blocks/mod.js';
import { typesFor } from '../src/core/versions.js';

// Confirmed runtime snapshot sizes from docs/calibration/mapping.json.
const EXPECTED_PARAM_COUNTS = { 0: 2, 1: 3, 2: 3, 3: 5, 4: 4, 10: 5, 11: 4, 12: 0, 17: 2 };

test('MOD base definitions match the parameters the pedal actually stores', () => {
  for (const type of mod.types) {
    assert.equal(type.params.length, EXPECTED_PARAM_COUNTS[type.id], `${type.name} param count`);
  }
});

test('documented-but-absent Level knobs are not offered for the original MOD types', () => {
  for (const type of mod.types.filter((t) => t.id <= 4)) {
    assert.ok(!type.params.some((p) => p.id === 'level' || p.label === 'Level'), type.name);
  }
});

test('1.2 MOD types expose the runtime parameter counts', () => {
  const counts = { 12: 4, 17: 5 };
  for (const [id, count] of Object.entries(counts)) {
    assert.equal(typesFor('mod', '1.2').find((t) => t.id === Number(id)).params.length, count);
  }
});

test('1.2 Jet Flanger keeps its two working CCs and marks the rest SysEx-only', () => {
  const jet = typesFor('mod', '1.2').find((t) => t.id === 17);
  assert.deepEqual(jet.params.slice(0, 2).map((p) => p.cc), [68, 69]);
  assert.deepEqual(jet.params.slice(2).map((p) => p.cc), [null, null, null]);
});
