// Modified firmware 1.12. Imports the original and replaces only the FX blocks whose types changed.
import { VERSION as ORIGINAL } from '../original/1.12.js';

const P = (value) => value;
const T = (value) => value;

const FX2_REPLACEMENTS = {
  5: T({
    id: 5, slug: 'pitch', name: 'Octave', description: 'Modified firmware (1.12+): the Range slot carries Octave', variant: 5,
    params: [
      P({ kind: 'range', id: 'pitch', label: 'Pitch', cc: null, min: -24, max: 24, unit: 'st', decimals: 0, step: null }),
      P({ kind: 'range', id: 'fine', label: 'Fine', cc: null, min: -1, max: 1, unit: 'st', decimals: 1, step: null }),
      P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
      P({ kind: 'range', id: 'level', label: 'Level', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
    ],
  }),
  8: T({
    id: 8, slug: 'octave', name: 'Octave', description: 'Modified firmware: 11-voice octave replacement', variant: 8,
    params: [
      P({ kind: 'range', id: 'dry', label: 'Dry', min: 0, max: 100, cc: null, unit: '%', decimals: 0 }),
      P({ kind: 'range', id: '_2_oct', label: '-2 Oct', min: 0, max: 100, cc: null, unit: '%', decimals: 0 }),
      P({ kind: 'range', id: '_1_oct', label: '-1 Oct', min: 0, max: 100, cc: null, unit: '%', decimals: 0 }),
      P({ kind: 'range', id: '_1_oct', label: '+1 Oct', min: 0, max: 100, cc: null, unit: '%', decimals: 0 }),
      P({ kind: 'range', id: '_2_oct', label: '+2 Oct', min: 0, max: 100, cc: null, unit: '%', decimals: 0 }),
      P({ kind: 'range', id: 'attack', label: 'Attack', min: 0, max: 2000, cc: null, unit: 'ms', decimals: 0 }),
      P({ kind: 'range', id: 'lowpass', label: 'Lowpass', min: 150, max: 18000, cc: null, unit: 'Hz', decimals: 0 }),
      P({ kind: 'range', id: 'detune', label: 'Detune', min: 0, max: 30, cc: null, unit: 'ct', decimals: 0 }),
      P({ kind: 'enum', id: 'dry_fx', label: 'Dry FX', options: ['Smooth', 'Smooth', 'Filter', 'Detune'], cc: null }),
      P({ kind: 'enum', id: 'reson', label: 'Reson', options: ['Low', 'Medium', 'High', 'Peak'], cc: null }),
      P({ kind: 'range', id: 'level', label: 'Level', min: 0, max: 100, cc: null, unit: '%', decimals: 0 }),
    ],
  }),
};

const MOD_REPLACEMENTS = {
  10: T({
    id: 10, slug: 'univibe', name: 'UniVibe', description: 'Modified firmware: UniVibe replacement of Velvet Vibrato', variant: 10,
    params: [
      P({ kind: 'range', id: 'speed', label: 'Speed', min: 0, max: 100, cc: null, unit: '', decimals: 2 }),
      P({ kind: 'range', id: 'depth', label: 'Depth', min: 0, max: 100, cc: null, unit: '', decimals: 2 }),
      P({ kind: 'range', id: 'level', label: 'Level', min: 0, max: 100, cc: null, unit: '', decimals: 2 }),
      P({ kind: 'enum', id: 'mode', label: 'Mode', options: ['Chorus', 'Vibrato'], cc: null }),
    ],
  }),
};

const VERSION = {
  ...ORIGINAL,
  fx2: {
    ...ORIGINAL.fx2,
    types: ORIGINAL.fx2.types.map((type) => FX2_REPLACEMENTS[type.id] ?? type),
  },
  mod: {
    ...ORIGINAL.mod,
    types: ORIGINAL.mod.types.map((type) => MOD_REPLACEMENTS[type.id] ?? type),
  },
};

export { VERSION };
