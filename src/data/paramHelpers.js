// Converted from the upstream editor's paramHelpers.ts (types stripped).
function titleize(id) {
  return id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function range(id, cc, min, max, opts = {}) {
  return {
    kind: 'range', id, cc, min, max,
    label: opts.label ?? titleize(id),
    unit: opts.unit, decimals: opts.decimals, format: opts.format,
    default: opts.default, note: opts.note,
  };
}

export function enumP(id, cc, options, opts = {}) {
  return {
    kind: 'enum', id, cc, options,
    label: opts.label ?? titleize(id),
    default: opts.default, note: opts.note,
  };
}
