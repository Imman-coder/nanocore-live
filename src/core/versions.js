// Firmware-aware effect type lists. AMP/CAB have no static list: their names
// are read from the pedal's amp/IR slot metadata.
import { BLOCK_BY_ID } from './spec.js';
import { EXTRA_TYPES_12, REPLACE_PARAMS_12, MODIFIED_PITCH_PARAMS } from './firmwareSpec.js';

export const FIRMWARE_OPTIONS = ['auto', '1.10', '1.11', '1.12', '1.2', '1.3.5', '1.2-modified'];
const LATER_FIRMWARES = new Set(['1.12', '1.2', '1.3.5', '1.2-modified']);
const LATER_MOD_TYPES = new Set([10, 11, 12, 17]);
const MODIFIED = '1.2-modified';

// A CC of null means the control is known by name but its MIDI controller has
// not been captured yet. The editor must not send a CC for it.
const range = (label, min, max, cc = null, unit = '', decimals = 2) => ({
  kind: 'range', id: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label, min, max, cc, unit, decimals,
});
const enumP = (label, options, cc = null) => ({
  kind: 'enum', id: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label, options, cc,
});

const OCTAVE_PARAMS = [
  range('Dry', 0, 100, null, '%', 0),
  range('-2 Oct', 0, 100, null, '%', 0),
  range('-1 Oct', 0, 100, null, '%', 0),
  range('+1 Oct', 0, 100, null, '%', 0),
  range('+2 Oct', 0, 100, null, '%', 0),
  range('Attack', 0, 2000, null, 'ms', 0),
  range('Lowpass', 150, 18000, null, 'Hz', 0),
  range('Detune', 0, 30, null, 'ct', 0),
  enumP('Dry FX', ['Smooth', 'Smooth', 'Filter', 'Detune']),
  enumP('Reson', ['Low', 'Medium', 'High', 'Peak']),
  range('Level', 0, 100, null, '%', 0),
];

const UNIVIBE_PARAMS = [
  range('Speed', 0, 100),
  range('Depth', 0, 100),
  range('Level', 0, 100),
  enumP('Mode', ['Chorus', 'Vibrato']),
];

export function resolveFirmware(state) {
  const chosen = state?.globals?.firmware;
  if (chosen && chosen !== 'auto') return chosen;
  return state?.globals?.settingsLayout === 2 ? '1.2' : '1.10';
}

function modifiedTypes(blockId, types) {
  return types.map((type) => {
    if (blockId === 'fx2' && type.id === 5) {
      return { ...type, slug: 'pitch', name: 'Pitch', description: 'Modified firmware (1.12+): the Range slot carries Pitch', params: MODIFIED_PITCH_PARAMS };
    }
    if (blockId === 'fx2' && type.slug === 'pitch') {
      return { ...type, slug: 'octave', name: 'Octave', description: 'Modified firmware: 11-voice octave replacement', params: OCTAVE_PARAMS };
    }
    if (blockId === 'mod' && type.slug === 'velvet_vibrato') {
      return { ...type, slug: 'univibe', name: 'UniVibe', description: 'Modified firmware: UniVibe replacement of Velvet Vibrato', params: UNIVIBE_PARAMS };
    }
    return type;
  });
}

function reverb12(types) {
  const order = ['room', 'plate', 'hall', 'concert', 'spring', 'shimmer', 'cloud'];
  const bySlug = new Map(types.map((type) => [type.slug, type]));
  const reordered = order.flatMap((slug, id) => {
    const type = bySlug.get(slug);
    return type ? [{ ...type, id, variant: id }] : [];
  });
  return [...reordered, ...types.filter((type) => !order.includes(type.slug))];
}

export function typesFor(blockId, firmware) {
  if (blockId === 'amp' || blockId === 'cab') return [];
  const block = BLOCK_BY_ID[blockId];
  if (!block) return [];
  const newer = LATER_FIRMWARES.has(firmware);
  let types = block.types.filter((type) => {
    if (!newer && blockId === 'mod' && LATER_MOD_TYPES.has(type.id)) return false;
    if (!newer && blockId === 'fx2' && type.id === 11) return false;
    return true;
  });
  if (newer) {
    types = types.map((type) => {
      const replacement = REPLACE_PARAMS_12[blockId]?.[type.slug];
      return replacement ? { ...type, params: replacement } : type;
    });
    types = [...types, ...(EXTRA_TYPES_12[blockId] ?? [])];
  }
  if (firmware === MODIFIED) types = modifiedTypes(blockId, types);
  return types;
}
