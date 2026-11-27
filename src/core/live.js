// Pure helpers for the Live performance view.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function expressionRawToPercent(raw) {
  return Math.round((clamp(Number(raw) || 0, 0, 127) / 127) * 100);
}

export function expressionPercentToRaw(percent) {
  return Math.round((clamp(Number(percent) || 0, 0, 100) / 100) * 127);
}

export function normalizedExpression(mapping, value) {
  const lo = mapping?.inputMin ?? 0;
  const hi = mapping?.inputMax ?? 127;
  let input = hi === lo ? 0 : clamp((value - lo) / (hi - lo), 0, 1);
  if (mapping?.invert) input = 1 - input;
  const outLo = clamp((mapping?.outputMin ?? 0) / 127, 0, 1);
  const outHi = clamp((mapping?.outputMax ?? 127) / 127, 0, 1);
  return outLo + input * (outHi - outLo);
}

export function faderOrientation(width, height) {
  return Number(height) > Number(width) + 8;
}

// Relative fader travel: a gesture starts at the current value and adds the
// pointer displacement across the fader's full span. Absolute mode instead
// maps the touch position directly with setExpressionFromPointer.
export function expressionRawFromRelative(startValue, delta, span = 200) {
  const travel = Number(span) > 0 ? Number(span) : 200;
  return Math.round(clamp(Number(startValue) + (Number(delta) / travel) * 127, 0, 127));
}

// Inverse of normalizedExpression: the raw pedal position that corresponds to
// a parameter's current normalized value. Used to recall that value on Live.
export function expressionRawForNormalized(mapping, normalized) {
  const outLo = clamp((mapping?.outputMin ?? 0) / 127, 0, 1);
  const outHi = clamp((mapping?.outputMax ?? 127) / 127, 0, 1);
  const target = clamp(Number(normalized) || 0, 0, 1);
  let input = outHi === outLo ? 0.5 : clamp((target - outLo) / (outHi - outLo), 0, 1);
  if (mapping?.invert) input = 1 - input;
  const lo = clamp(Number(mapping?.inputMin) || 0, 0, 127);
  const hi = clamp(Number(mapping?.inputMax ?? 127), 0, 127);
  return Math.round(clamp(lo + input * (hi - lo), 0, 127));
}

export function sceneStored(assignments, name) {
  if (name === 'base') return true;
  return Boolean(Object.keys(assignments?.scenes?.[name] ?? {}).length
    || Object.keys(assignments?.sceneEnabled?.[name] ?? {}).length);
}

export function sceneBlockParticipates(assignments, blockId) {
  return assignments?.sceneBlocks?.[blockId] !== false;
}

export function stompActive(targets, blocksById = {}) {
  const list = targets ?? [];
  if (!list.length) return false;
  return list.every((target) => {
    const block = typeof target === 'string' ? target : target?.block;
    return Boolean(blocksById[block]?.enabled);
  });
}

export function toggleCc(active) {
  return active ? 0 : 127;
}
