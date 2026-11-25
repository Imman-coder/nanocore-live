// Helpers for demo mode's sandboxed copy of the browser's saved working data.
// UI-only fields are kept when swapping data sets so the current screen stays
// where the user left it; everything else comes from whichever data set wins.

// Transient view state, not part of the saved working data.
export const UI_STATE_KEYS = [
  'mode', 'liveEditing', 'showAdvanced', 'expandedBlocks', 'activeScene', 'selectedBlock',
];

export function uiStateOf(state = {}) {
  return Object.fromEntries(UI_STATE_KEYS
    .filter((key) => key in state)
    .map((key) => [key, state[key]]));
}

export function withUiState(data = {}, ui = {}) {
  const out = { ...data };
  for (const key of UI_STATE_KEYS) {
    if (key in ui) out[key] = ui[key];
  }
  return out;
}

// Deep copy: nested preset/globals objects must not share identity with the
// saved state, otherwise demo edits would still mutate the real data.
export function sandboxState(state = {}) {
  return JSON.parse(JSON.stringify(withUiState(state, uiStateOf(state))));
}

// Stand-in for window.localStorage while demo is sandboxed.
export function createMemoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}
