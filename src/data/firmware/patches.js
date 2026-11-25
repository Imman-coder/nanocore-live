// Firmware patches shipped by the community modifier. UniVibe is mandatory for
// every modified build; Octave is optional and only exists on 1.12+ bases.
// Keep the type definitions here — modified/*.js only selects which patches apply.
const P = (value) => value;
const T = (value) => value;

// 1.10/1.11 four-control UniVibe revision (Level is SysEx slot 2).
const UNIVIBE_BASE = T({
  id: 10, variant: 10, slug: 'univibe', name: 'UniVibe',
  description: 'Modified firmware: UniVibe replacement of Velvet Vibrato',
  note: 'Four controls only — no Wave/Voice/Mix. Displayed 0-100 is UI scaling: Speed = 0.2 + 5.8*x² Hz, Depth 0..1 excursion, Level 0..2 (50 = unity, 100 = +6.02 dB), Mode 0/1 = Chorus/Vibrato.',
  params: [
    P({ kind: 'range', id: 'speed', label: 'Speed', cc: null, sysexParamIndex: 0, min: 0, max: 100, decimals: 2 }),
    P({ kind: 'range', id: 'depth', label: 'Depth', cc: null, sysexParamIndex: 1, min: 0, max: 100, decimals: 2 }),
    P({ kind: 'range', id: 'level', label: 'Level', cc: null, sysexParamIndex: 2, min: 0, max: 100, decimals: 2 }),
    P({ kind: 'enum', id: 'mode', label: 'Mode', cc: null, sysexParamIndex: 3, options: ['Chorus', 'Vibrato'] }),
  ],
});

// 1.12/1.2 UniVibe revision (Level is SysEx slot 10).
const UNIVIBE_MODERN = T({
  id: 10, variant: 10, slug: 'univibe', name: 'UniVibe',
  description: 'Modified firmware: UniVibe replacement of Velvet Vibrato',
  note: 'Four controls only — no Wave/Voice/Mix. Displayed 0-100 is UI scaling: Speed = 0.2 + 5.8*x² Hz, Depth 0..1 excursion, Level 0..2 (50 = unity, 100 = +6.02 dB), Mode 0/1 = Chorus/Vibrato.',
  params: [
    P({ kind: 'range', id: 'speed', label: 'Speed', cc: null, sysexParamIndex: 0, min: 0, max: 100, decimals: 2 }),
    P({ kind: 'range', id: 'depth', label: 'Depth', cc: null, sysexParamIndex: 1, min: 0, max: 100, decimals: 2 }),
    P({ kind: 'range', id: 'level', label: 'Level', cc: null, sysexParamIndex: 10, min: 0, max: 100, decimals: 2 }),
    P({ kind: 'enum', id: 'mode', label: 'Mode', cc: null, sysexParamIndex: 3, options: ['Chorus', 'Vibrato'] }),
  ],
});

const UNIVIBE_BY_BASE = {
  '1.10': UNIVIBE_BASE,
  '1.11': UNIVIBE_BASE,
  '1.12': UNIVIBE_MODERN,
  '1.2': UNIVIBE_MODERN,
};

// Optional Octave patch — replaces FX2 Pitch (id 8), never FX2 Range (id 5).
const OCTAVE = T({
  id: 8, variant: 8, slug: 'octave', name: 'Octave',
  description: 'Modified firmware: 11-control octave replacement of FX2 Pitch',
  note: 'Displayed percentages are UI scaling, not DSP values: Dry and the four octave voices are 0..1, Attack 0..2000 ms, Lowpass 150..18000 Hz, Detune 0..30 ct, and Level 0..2 with a fixed -9 dB output offset (50% = unity). All controls are SysEx-only.',
  params: [
    P({ kind: 'range', id: 'dry', label: 'Dry', cc: null, sysexParamIndex: 0, min: 0, max: 100, unit: '%', decimals: 0 }),
    P({ kind: 'range', id: 'minus_2_oct', label: '-2 Oct', cc: null, sysexParamIndex: 1, min: 0, max: 100, unit: '%', decimals: 0 }),
    P({ kind: 'range', id: 'minus_1_oct', label: '-1 Oct', cc: null, sysexParamIndex: 2, min: 0, max: 100, unit: '%', decimals: 0 }),
    P({ kind: 'range', id: 'plus_1_oct', label: '+1 Oct', cc: null, sysexParamIndex: 3, min: 0, max: 100, unit: '%', decimals: 0 }),
    P({ kind: 'range', id: 'plus_2_oct', label: '+2 Oct', cc: null, sysexParamIndex: 4, min: 0, max: 100, unit: '%', decimals: 0 }),
    P({ kind: 'range', id: 'attack', label: 'Attack', cc: null, sysexParamIndex: 5, min: 0, max: 2000, unit: 'ms', decimals: 0 }),
    P({ kind: 'range', id: 'lowpass', label: 'Lowpass', cc: null, sysexParamIndex: 6, min: 150, max: 18000, unit: 'Hz', decimals: 0 }),
    P({ kind: 'range', id: 'detune', label: 'Detune', cc: null, sysexParamIndex: 7, min: 0, max: 30, unit: 'ct', decimals: 0 }),
    P({ kind: 'enum', id: 'dry_fx', label: 'Dry FX', cc: null, sysexParamIndex: 8, options: ['Smooth', 'Smooth', 'Filter', 'Detune'] }),
    P({ kind: 'enum', id: 'reson', label: 'Reson', cc: null, sysexParamIndex: 9, options: ['Low', 'Medium', 'High', 'Peak'] }),
    P({ kind: 'range', id: 'level', label: 'Level', cc: null, sysexParamIndex: 10, min: 0, max: 100, unit: '%', decimals: 0 }),
  ],
});

export function patchesFor(base, { octave = false } = {}) {
  const univibe = UNIVIBE_BY_BASE[base];
  if (!univibe) throw new Error(`No UniVibe patch defined for firmware ${base}`);
  const patches = [{ block: 'mod', replace: { 10: univibe } }];
  if (octave && (base === '1.12' || base === '1.2')) {
    patches.push({ block: 'fx2', replace: { 8: OCTAVE } });
  }
  return patches;
}

// Replace by type id; append when the base firmware has no such slot (1.10/1.11 MOD).
export function applyPatches(original, patches) {
  const result = structuredClone(original);
  for (const patch of patches) {
    const block = result[patch.block];
    if (!block) continue;
    const types = [...block.types];
    for (const [id, replacement] of Object.entries(patch.replace)) {
      const typeId = Number(id);
      const index = types.findIndex((type) => type.id === typeId);
      if (index >= 0) types[index] = structuredClone(replacement);
      else types.push(structuredClone(replacement));
    }
    result[patch.block] = { ...block, types };
  }
  return result;
}
