// In-memory baseline of what the pedal had when a preset was first read.
// Never persisted: scenes and bindings live in browser storage, the pedal's
// own values live here only for the lifetime of the page.
export function captureBase(blocks = []) {
  const values = {};
  const enabled = {};
  for (const block of blocks) {
    block.params.forEach((value, index) => { values[`${block.id}:${index}`] = value; });
    enabled[block.id] = Boolean(block.enabled);
  }
  return { values, enabled, overridden: false };
}

export function overrideBase(map, preset, values, enabled) {
  const base = map.get(preset) ?? captureBase([]);
  base.values = { ...values };
  base.enabled = { ...enabled };
  base.overridden = true;
  map.set(preset, base);
  return base;
}

export function baseForPreset(map, preset, blocks) {
  if (!map.has(preset)) map.set(preset, captureBase(blocks));
  return map.get(preset);
}
