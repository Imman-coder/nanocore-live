import test from 'node:test';
import assert from 'node:assert/strict';
import { stompActive, toggleCc, sceneStored, sceneBlockParticipates, expressionBytes, expressionRawToPercent, expressionPercentToRaw, normalizedExpression } from '../src/core/live.js';
import { captureBase, baseForPreset, overrideBase } from '../src/core/base.js';
import { connectionHint } from '../src/core/capabilities.js';



test('an overridden base replaces the captured values', () => {
  const blocks = [{ id: 'fx1', enabled: true, params: [0.2] }];
  const map = new Map([[1, captureBase(blocks)]]);
  assert.equal(baseForPreset(map, 1, blocks).overridden, false);
  overrideBase(map, 1, { 'fx1:0': 0.9 }, { fx1: false });
  const base = baseForPreset(map, 1, [{ id: 'fx1', enabled: true, params: [0.2] }]);
  assert.equal(base.values['fx1:0'], 0.9);
  assert.equal(base.enabled.fx1, false);
  assert.equal(base.overridden, true);
});

test('base captures device values and on/off states once per preset', () => {
  const blocks = [
    { id: 'fx1', enabled: true, params: [0.2, 0.4] },
    { id: 'cab', enabled: false, params: [0.7] },
  ];
  const base = captureBase(blocks);
  assert.deepEqual(base.values, { 'fx1:0': 0.2, 'fx1:1': 0.4, 'cab:0': 0.7 });
  assert.deepEqual(base.enabled, { fx1: true, cab: false });
  const map = new Map([[4, base]]);
  assert.equal(baseForPreset(map, 4, blocks), base);
  const fresh = baseForPreset(map, 5, blocks);
  assert.notEqual(fresh, base);
  assert.deepEqual(fresh.values, base.values);
});


test('expression range percentages convert to and from MIDI values', () => {
  assert.equal(expressionRawToPercent(0), 0);
  assert.equal(expressionRawToPercent(127), 100);
  assert.equal(expressionPercentToRaw(20), 25);
  assert.equal(expressionPercentToRaw(70), 89);
});

test('expression input window maps onto a selected parameter window', () => {
  const mapping = {
    inputMin: expressionPercentToRaw(5), inputMax: expressionPercentToRaw(95),
    outputMin: expressionPercentToRaw(30), outputMax: expressionPercentToRaw(80),
    invert: false,
  };
  const at = (percent) => normalizedExpression(mapping, expressionPercentToRaw(percent));
  assert.ok(Math.abs(at(5) - 0.30) < 0.02);
  assert.ok(Math.abs(at(95) - 0.80) < 0.02);
  assert.ok(Math.abs(at(50) - 0.55) < 0.02);
  const inverted = { ...mapping, invert: true };
  assert.ok(Math.abs(normalizedExpression(inverted, expressionPercentToRaw(5)) - 0.80) < 0.02);
});

test('a live expression control maps its value through the assignment window', () => {
  const mapping = { id: 'E1', target: 'fx1', paramIndex: 0, inputMin: 0, inputMax: 127, invert: false };
  assert.deepEqual(expressionBytes(mapping, 1, 0, 64), [0xb0, 50, 64]);
  const reversed = { ...mapping, inputMin: 127, inputMax: 0 };
  assert.deepEqual(expressionBytes(reversed, 1, 0, 127), [0xb0, 50, 0]);
  const inverted = { ...mapping, invert: true };
  assert.deepEqual(expressionBytes(inverted, 1, 0, 0), [0xb0, 50, 127]);
});


test('connection hints explain the missing MIDI capability', () => {
  assert.match(connectionHint({ secure: false, midi: false, bluetooth: false }), /HTTPS/i);
  assert.match(connectionHint({ secure: true, midi: false, bluetooth: true }), /Direct Bluetooth/i);
  assert.match(connectionHint({ secure: true, midi: false, bluetooth: false }), /Chrome/i);
  assert.match(connectionHint({ secure: true, midi: true, bluetooth: true }), /available/i);
});

test('a block participates in scenes unless explicitly switched off', () => {
  const assignments = { sceneBlocks: { mod: false } };
  assert.equal(sceneBlockParticipates(assignments, 'mod'), false);
  assert.equal(sceneBlockParticipates(assignments, 'del'), true);
});

test('a stomp looks active only when all of its target blocks are on', () => {
  const blocks = { fx1: { enabled: true }, fx2: { enabled: true }, mod: { enabled: false } };
  assert.equal(stompActive([{ block: 'fx1' }, { block: 'fx2' }], blocks), true);
  assert.equal(stompActive([{ block: 'fx1' }, { block: 'mod' }], blocks), false);
  assert.equal(stompActive([], blocks), false);
});


test('a scene is stored when it has either values or fx states', () => {
  const assignments = {
    scenes: { scene1: { 'fx1:0': 0.5 }, scene2: {} },
    sceneEnabled: { scene1: {}, scene2: { fx1: false } },
  };
  assert.equal(sceneStored(assignments, 'base'), true);
  assert.equal(sceneStored(assignments, 'scene1'), true);
  assert.equal(sceneStored(assignments, 'scene2'), true);
  assert.equal(sceneStored(assignments, 'scene3'), false);
});

test('toggling an active stomp sends off and an inactive one sends on', () => {
  assert.equal(toggleCc(true), 0);
  assert.equal(toggleCc(false), 127);
});
