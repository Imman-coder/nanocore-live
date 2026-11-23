// Firmware 1.2 / 1.3.5 effect additions. IDs and ranges come from the
// hardware-confirmed catalogue in docs/FIRMWARE_VERSION_HISTORY.md §5.
// CC numbers are unknown for these SysEx-only controls.
const slug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_');

const r = (label, min, max, unit = '', decimals = 2, step = null) => ({
  kind: 'range', id: slug(label), label, cc: null, min, max, unit, decimals, step,
});
const e = (label, options) => ({ kind: 'enum', id: slug(label), label, cc: null, options });

const THRESHOLD = r('Threshold', -60, 0, 'dB', 1);
const RATIO = r('Ratio', 1, 20, ':1', 1, 0.2);
const MAKEUP = r('Makeup', -24, 24, 'dB', 1);
const MIX = r('Mix', 0, 100, '', 0);
const WAH_LEVEL = r('Level', -60, 6, 'dB', 1);

const wahCommon = () => [r('Position', 0, 100, '', 0), r('Low Freq', 20, 500, 'Hz', 0),
  r('High Freq', 500, 5000, 'Hz', 0), MIX, WAH_LEVEL];
const bassWah = () => [r('Position', 0, 100, '', 0), r('Q Trim', 0, 100, '', 0),
  r('Volume Trim', 0, 100, '', 0), MIX, WAH_LEVEL];

const type = (id, name, params) => ({ id, slug: slug(name), name, params, cc: null });

export const EXTRA_TYPES_12 = {
  fx1: [
    type(4, 'Env Wah', [r('Freq', 10, 20000, 'Hz', 0), r('Env', 0, 20000, '', 0), r('Q', 0.1, 20, '', 1), MIX]),
    type(5, 'Wah', [r('Freq', 163, 3500, 'Hz', 0), r('Sweep', 0, 100, '', 0), r('Rate', 0, 8, 'Hz', 1), r('Shape', 0, 100, '', 0), MIX]),
    type(6, 'Motion Wah', [r('Rate', 0, 15, 'Hz', 0), r('Voice', 0, 100, '', 0), r('Sweep', 0, 100, '', 0), MIX]),
    type(7, 'Peak Comp', [THRESHOLD, RATIO, r('Attack', 0, 32, 'ms', 1), r('Release', 0, 56, 'ms', 1), MAKEUP]),
    type(8, 'Parallel Comp', [THRESHOLD, r('Attack', 0.01, 250, 'ms', 2), r('Release', 10, 2500, 'ms', 0), r('Mix', 0, 200, '', 0), MAKEUP]),
    type(9, 'Classic Wah', wahCommon()),
    type(10, 'Retro Wah', wahCommon()),
    type(11, 'Bass Wah', bassWah()),
  ],
  fx2: [
    type(12, 'Gate', [r('Threshold', -100, 0, 'dB', 1), r('Release', 5, 100, 'ms', 0)]),
    type(13, 'Auto Gate', [r('Sensitivity', -6, 60, 'dB', 1), r('Release', 20, 300, 'ms', 1)]),
    type(14, 'Gate + Compressor', [r('Gate Thresh', -100, 0, 'dB', 1), r('Comp Thresh', -60, 0, 'dB', 1), RATIO,
      r('Knee', 0, 24, 'dB', 0), r('Attack', 0, 200, 'ms', 0), r('Release', 0, 1000, 'ms', 0), MAKEUP]),
    type(15, 'Compressor', [THRESHOLD, RATIO, r('Knee', 0, 24, 'dB', 0), r('Attack', 0, 200, 'ms', 0), r('Release', 0, 1000, 'ms', 0), MAKEUP]),
    type(16, 'Peak Comp', [THRESHOLD, RATIO, r('Attack', 0, 32, 'ms', 1), r('Release', 0, 56, 'ms', 1), MAKEUP]),
    type(17, 'Parallel Comp', [THRESHOLD, r('Attack', 0.01, 250, 'ms', 2), r('Release', 10, 2500, 'ms', 0), r('Mix', 0, 200, '', 0), MAKEUP]),
    type(18, 'Classic Wah', wahCommon()),
    type(19, 'Retro Wah', wahCommon()),
    type(20, 'Bass Wah', bassWah()),
  ],
  del: [],
  mod: [],
};

export const REPLACE_PARAMS_12 = {
  fx1: {
    gate: [r('Gate Release', 5, 100, 'ms', 0)],
    auto_gate: [r('Sensitivity', -6, 60, 'dB', 1), r('Release', 20, 300, 'ms', 1)],
  },
  fx2: {
    pitch: [r('Pitch', -24, 24, 'st', 0), r('Fine', -1, 1, 'st', 1), MIX],
  },
  del: {
    duck: [r('Time', 0.1, 3000, 'ms', 1), r('Feedback', 0, 95, '', 0),
      r('Sensitivity', 0, 100, '', 0), r('Depth', 0, 100, '', 0),
      r('Attack', 0.1, 100, 'ms', 1), r('Release', 10, 2000, 'ms', 0),
      r('Filter', 0, 100, '', 0), MIX],
  },
  mod: {
    phaser_ii: [r('Depth', 0, 100, '', 0), r('Rate', 0.05, 5, 'Hz', 2), r('Feedback', -95, 95, '', 0), MIX],
    jet_flanger: [{ ...r('Rate', 0.05, 5, 'Hz', 2), cc: 68 },
      { ...r('Depth', 0, 100, '', 0), cc: 69 },
      r('Feedback', -95, 95, '', 0), r('Phase', 0, 360, '°', 0), MIX],
  },
};

export const MODIFIED_PITCH_PARAMS = [r('Pitch', -24, 24, 'st', 0), r('Fine', -1, 1, 'st', 1), MIX,
  r('Level', 0, 100, '', 0)];
