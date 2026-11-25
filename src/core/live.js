// Pure helpers for the Live performance view.
import { buildCc } from './messages.js';
import { paramCcFor } from './spec.js';

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

export function expressionBytes(mapping, channel, variant, value) {
  const normalized = normalizedExpression(mapping, value);
  const cc = paramCcFor(
    typeof mapping.target === 'object' ? mapping.target.block : mapping.target,
    mapping.paramIndex ?? 0,
    variant,
  );
  return buildCc(channel, cc, Math.round(normalized * 127));
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
