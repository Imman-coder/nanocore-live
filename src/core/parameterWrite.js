// Choose the transport for a single parameter write. The verified editor uses
// CCs for every controller the pedal documents; only SysEx-only controls fall
// back to live field 0x01. Sending an out-of-range or unknown CC is rejected.
import { buildCc } from './messages.js';
import { enumToCc } from './scaling.js';

export function buildParameterWrite({ param, normalized, channel = 1 }) {
  if (!param || param.cc === null || param.cc === undefined) return null;
  const value = Math.max(0, Math.min(1, Number(normalized) || 0));
  const raw = param.kind === 'enum' && Array.isArray(param.options) && param.options.length
    ? enumToCc(Math.round(value * (param.options.length - 1)), param.options)
    : Math.round(value * 127);
  return buildCc(channel, param.cc, raw);
}
