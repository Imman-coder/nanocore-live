// One pure resolver for every expression source: controller CC, Live fader,
// Editor badge and popup. No caller does its own window/inversion math.
import { buildCc } from '../core/messages.js';
import { paramCcFor } from '../core/spec.js';
import { normalizedExpression, expressionRawForNormalized } from '../core/live.js';
import { SUBDIVISIONS } from '../core/tempo.js';
import { targetFromBinding } from './targets.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function subdivisionIndexForRaw(raw) {
  return clamp(Math.floor((Number(raw) / 127) * SUBDIVISIONS.length), 0, SUBDIVISIONS.length - 1);
}

export function subdivisionForRaw(raw) {
  return SUBDIVISIONS[subdivisionIndexForRaw(raw)].id;
}

export function rawForSubdivision(id) {
  const index = Math.max(0, SUBDIVISIONS.findIndex((entry) => entry.id === id));
  return Math.round((index / Math.max(1, SUBDIVISIONS.length - 1)) * 127);
}

export function resolveExpression(binding, raw, context = {}) {
  const value = clamp(Number(raw) || 0, 0, 127);
  const target = targetFromBinding(binding);
  if (!target) return { type: 'notify', message: `${binding?.id ?? 'Pedal'} has no assignment` };

  if (target.kind === 'volume') {
    return { type: 'setVolume', value: Math.round((value / 127) * 100), pedalId: binding?.id };
  }
  if (target.kind === 'tempo') {
    return { type: 'setTempoDivision', block: target.block, subdivision: subdivisionForRaw(value), pedalId: binding?.id };
  }

  const normalized = normalizedExpression(binding, value);
  const cc = paramCcFor(target.block, target.index, context.variant ?? 0);
  return {
    type: 'writeParameter',
    target,
    normalized,
    raw: value,
    bytes: buildCc(context.channel ?? 1, cc, Math.round(normalized * 127)),
    pedalId: binding?.id,
  };
}

export function initialExpressionRaw(binding, state, snapshot) {
  if (!binding) return 0;
  if (binding.volume || binding.kind === 'volume') {
    return Math.round((clamp(Number(snapshot?.volume) || 0, 0, 100) / 100) * 127);
  }
  const target = targetFromBinding(binding);
  if (!target) return 0;
  if (target.kind === 'tempo') {
    const config = state?.presets?.[String(state.activePreset)]?.tempoSync?.[target.block];
    return rawForSubdivision(config?.subdivision ?? '1/8');
  }
  const value = snapshot?.blocks?.find((block) => block.id === target.block)?.params?.[target.index];
  return Number.isFinite(value) ? expressionRawForNormalized(binding, value) : 0;
}
