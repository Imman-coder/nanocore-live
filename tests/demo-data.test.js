import test from 'node:test';
import assert from 'node:assert/strict';
import { sandboxState, uiStateOf, withUiState, createMemoryStorage, UI_STATE_KEYS } from '../src/core/demoData.js';
import { createDefaultState, loadState, saveState } from '../src/core/store.js';

function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}

test('a demo sandbox is a deep copy that keeps only transient view fields', () => {
  const saved = createDefaultState();
  saved.globals.midiChannel = 5;
  saved.presets['1'].name = 'Real name';
  saved.mode = 'live';
  saved.liveEditing = true;

  const demo = sandboxState(saved);
  assert.equal(demo.globals.midiChannel, 5);
  assert.equal(demo.presets['1'].name, 'Real name');
  assert.equal(demo.mode, 'live');
  assert.equal(demo.liveEditing, true);
  assert.notEqual(demo.globals, saved.globals);
  assert.notEqual(demo.presets['1'], saved.presets['1']);

  demo.globals.midiChannel = 12;
  demo.presets['1'].name = 'Demo name';
  assert.equal(saved.globals.midiChannel, 5);
  assert.equal(saved.presets['1'].name, 'Real name');
});

test('demo saves land in memory storage and never in the main browser store', () => {
  const main = makeStorage();
  const demo = createMemoryStorage();
  const saved = createDefaultState();
  saved.globals.midiChannel = 3;
  saveState(main, saved);

  const scratch = sandboxState(loadState(main));
  scratch.globals.midiChannel = 9;
  scratch.globals.showLogBar = false;
  saveState(demo, scratch);

  assert.equal(loadState(main).globals.midiChannel, 3);
  assert.equal(loadState(demo).globals.midiChannel, 9);
  assert.equal(loadState(demo).globals.showLogBar, false);
});

test('returning to main data restores saved values but keeps the current view', () => {
  const main = makeStorage();
  const saved = createDefaultState();
  saved.globals.midiChannel = 4;
  saveState(main, saved);

  const demo = sandboxState(loadState(main));
  demo.globals.midiChannel = 11;
  demo.mode = 'editor';
  demo.activeScene = 'scene1';
  const ui = uiStateOf(demo);
  assert.ok(UI_STATE_KEYS.includes('activeScene'));

  const mainAgain = withUiState(loadState(main), ui);
  assert.equal(mainAgain.globals.midiChannel, 4);
  assert.equal(mainAgain.mode, 'editor');
  assert.equal(mainAgain.activeScene, 'scene1');
});
