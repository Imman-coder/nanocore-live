// Read models used by views. A value has one derived representation, so
// meters, badges, knobs and snapshots cannot disagree about the same target.
import { initialExpressionRaw } from './resolver.js';

export function selectTempoSync(state, block) {
  return state?.presets?.[String(state.activePreset)]?.tempoSync?.[block]
    ?? { enabled: false, subdivision: '1/8' };
}

export function selectExpressionValue(binding, state, snapshot) {
  return initialExpressionRaw(binding, state, snapshot);
}

export function selectAssignmentKey(target) {
  if (!target) return '';
  if (target.kind === 'volume') return 'volume';
  if (target.kind === 'tempo') return `${target.block}:tempo`;
  return `${target.block}:${target.index}`;
}
