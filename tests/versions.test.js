import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFirmware, typesFor } from '../src/core/versions.js';
import { createDefaultState } from '../src/core/store.js';

test('auto firmware follows the settings layout hint', () => {
  const state = createDefaultState();
  assert.equal(resolveFirmware(state), '1.10');
  state.globals.settingsLayout = 2;
  assert.equal(resolveFirmware(state), '1.2');
});

test('an explicit Globals selection overrides the auto hint', () => {
  const state = createDefaultState();
  state.globals.settingsLayout = 2;
  state.globals.firmware = '1.11';
  assert.equal(resolveFirmware(state), '1.11');
});

test('older firmware hides the later MOD types', () => {
  const old = typesFor('mod', '1.10').map((t) => t.id);
  const newer = typesFor('mod', '1.2').map((t) => t.id);
  assert.deepEqual(old, [0, 1, 2, 3, 4]);
  assert.ok(newer.includes(10));
  assert.ok(newer.includes(17));
  assert.deepEqual(typesFor('mod', '1.11').map((t) => t.id), old);
});

test('Motion Wah is only available on newer firmware', () => {
  assert.equal(typesFor('fx2', '1.10').some((t) => t.id === 11), false);
  assert.equal(typesFor('fx2', '1.12').some((t) => t.id === 11), true);
});

test('AMP and CAB have no static type list; their names come from the device', () => {
  assert.deepEqual(typesFor('amp', '1.10'), []);
  assert.deepEqual(typesFor('cab', '1.2'), []);
});




test('firmware 1.2 uses the real IDs for the numbered MOD variants', () => {
  const mod = typesFor('mod', '1.2');
  assert.deepEqual(mod.map((t) => t.id), [0, 1, 2, 3, 4, 10, 11, 12, 17]);
  assert.equal(mod.find((t) => t.slug === 'chorus_ii').id, 11);
  assert.equal(mod.find((t) => t.slug === 'phaser_ii').id, 12);
  assert.equal(mod.find((t) => t.slug === 'jet_flanger').id, 17);
});


test('new 1.2+ effects use the hardware-confirmed IDs', () => {
  assert.deepEqual(typesFor('fx1', '1.3.5').map((t) => t.id), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(typesFor('fx2', '1.3.5').map((t) => t.id),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
});

test('new effect ranges follow the verified 1.3.5 catalogue', () => {
  const fx1 = typesFor('fx1', '1.3.5');
  const peak = fx1.find((t) => t.id === 7);
  assert.deepEqual([peak.params[2].min, peak.params[2].max], [0, 32]);
  assert.deepEqual([peak.params[3].min, peak.params[3].max], [0, 56]);
  const classic = fx1.find((t) => t.id === 9);
  assert.deepEqual([classic.params[1].min, classic.params[1].max], [20, 500]);
  assert.deepEqual([classic.params[2].min, classic.params[2].max], [500, 5000]);
  const gate = fx1.find((t) => t.id === 0);
  const release = gate.params.find((p) => p.label === 'Gate Release');
  assert.deepEqual([release.min, release.max], [5, 100]);
});

test('modified firmware maps FX2 Range slot to Pitch on 1.12+', () => {
  const fx2 = typesFor('fx2', '1.2-modified');
  const pitch = fx2.find((t) => t.id === 5);
  assert.equal(pitch.name, 'Octave');
  assert.deepEqual([pitch.params[0].min, pitch.params[0].max], [-24, 24]);
});

test('firmware 1.2 adds the new FX1 types with the supplied ranges', () => {
  const fx1 = typesFor('fx1', '1.2');
  const peak = fx1.find((t) => t.slug === 'peak_comp');
  assert.ok(peak);
  assert.deepEqual([peak.params[0].min, peak.params[0].max], [-60, 0]);
  assert.equal(peak.params[1].step, 0.2);
  const parallel = fx1.find((t) => t.slug === 'parallel_comp');
  assert.deepEqual([parallel.params[3].min, parallel.params[3].max], [0, 200]);
});

test('firmware 1.2 additions have no CC and extend existing types', () => {
  const fx1 = typesFor('fx1', '1.2');
  assert.ok(fx1.find((t) => t.slug === 'peak_comp').params.every((p) => p.cc === null));
  const gate = fx1.find((t) => t.slug === 'gate');
  assert.ok(gate.params.some((p) => p.label === 'Gate Release'));
  const del = typesFor('del', '1.2').find((t) => t.slug === 'duck');
  assert.ok(del.params.some((p) => p.label === 'Sensitivity'));
});

test('firmware 1.2 keeps the canonical REV order 4=shimmer, 5=cloud, 6=spring', () => {
  const rev = typesFor('rev', '1.2');
  assert.deepEqual(rev.slice(0, 7).map((t) => t.slug),
    ['room', 'plate', 'hall', 'concert', 'shimmer', 'cloud', 'spring']);
  assert.deepEqual(rev.slice(0, 7).map((t) => t.id), [0, 1, 2, 3, 4, 5, 6]);
});

test('modified firmware replaces FX2 pitch with the Octave controls', () => {
  const types = typesFor('fx2', '1.2-modified');
  assert.equal(types.find((t) => t.id === 8)?.slug, 'octave');
  const octave = types.find((t) => t.slug === 'octave');
  assert.deepEqual(octave.params.map((p) => p.label), [
    'Dry', '-2 Oct', '-1 Oct', '+1 Oct', '+2 Oct', 'Attack',
    'Lowpass', 'Detune', 'Dry FX', 'Reson', 'Level',
  ]);
});


test('modified Octave uses the supplied ranges and enum options', () => {
  const octave = typesFor('fx2', '1.2-modified').find((t) => t.slug === 'octave');
  const params = octave.params;
  assert.deepEqual(params.slice(0, 5).map((p) => [p.min, p.max]),
    [[0, 100], [0, 100], [0, 100], [0, 100], [0, 100]]);
  assert.deepEqual([params[5].min, params[5].max], [0, 2000]);
  assert.deepEqual([params[6].min, params[6].max], [150, 18000]);
  assert.deepEqual([params[7].min, params[7].max], [0, 30]);
  assert.deepEqual(params[8].options, ['Smooth', 'Smooth', 'Filter', 'Detune']);
  assert.deepEqual(params[9].options, ['Low', 'Medium', 'High', 'Peak']);
  assert.deepEqual([params[10].min, params[10].max], [0, 100]);
});

test('modified firmware replaces MOD Velvet Vibrato with UniVibe', () => {
  const types = typesFor('mod', '1.2-modified');
  assert.equal(types.some((t) => t.slug === 'velvet_vibrato'), false);
  const vibe = types.find((t) => t.slug === 'univibe');
  assert.deepEqual(vibe.params.map((p) => p.label), ['Speed', 'Depth', 'Level', 'Mode']);
  assert.deepEqual(vibe.params.at(-1).options, ['Chorus', 'Vibrato']);
});

test('unknown firmware falls back to the conservative base list', () => {
  assert.deepEqual(typesFor('mod', 'unknown').map((t) => t.id), [0, 1, 2, 3, 4]);
});
