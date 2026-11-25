// Firmware-aware effect type lookup. Version tables live in
// src/data/firmware/original/<version>.js; modified variants are assembled from
// the patch registry in src/data/firmware/patches.js. This module only maps a
// firmware name to a table.
import { VERSION as V1_10 } from '../data/firmware/original/1.10.js';
import { VERSION as V1_11 } from '../data/firmware/original/1.11.js';
import { VERSION as V1_12 } from '../data/firmware/original/1.12.js';
import { VERSION as V1_2 } from '../data/firmware/original/1.2.js';
import { VERSION as M1_10 } from '../data/firmware/modified/1.10.js';
import { VERSION as M1_11 } from '../data/firmware/modified/1.11.js';
import { VERSION as M1_12, VERSION_OCTAVE as M1_12_OCT } from '../data/firmware/modified/1.12.js';
import { VERSION as M1_2, VERSION_OCTAVE as M1_2_OCT } from '../data/firmware/modified/1.2.js';

export const FIRMWARE_OPTIONS = [
  'auto',
  '1.10', '1.11', '1.12', '1.2', '1.3.5',
  '1.10+uv', '1.11+uv', '1.12+uv', '1.12+uv+oct', '1.2+uv', '1.2+uv+oct',
];

export const FIRMWARE_LABELS = {
  auto: 'Auto (settings-layout hint)',
  '1.10': '1.10 — original',
  '1.11': '1.11 — original',
  '1.12': '1.12 — original',
  '1.2': '1.2 — original',
  '1.3.5': '1.3.5 — original',
  '1.10+uv': '1.10 modified — UniVibe',
  '1.11+uv': '1.11 modified — UniVibe',
  '1.12+uv': '1.12 modified — UniVibe',
  '1.12+uv+oct': '1.12 modified — UniVibe + Octave',
  '1.2+uv': '1.2 modified — UniVibe',
  '1.2+uv+oct': '1.2 modified — UniVibe + Octave',
};

const TABLES = {
  '1.10': V1_10,
  '1.11': V1_11,
  '1.12': V1_12,
  '1.2': V1_2,
  '1.3.5': V1_2,
  '1.10+uv': M1_10,
  '1.11+uv': M1_11,
  '1.12+uv': M1_12,
  '1.12+uv+oct': M1_12_OCT,
  '1.2+uv': M1_2,
  '1.2+uv+oct': M1_2_OCT,
  // Legacy names from before the variant selector; keep old saved settings valid.
  '1.10-modified': M1_10,
  '1.11-modified': M1_11,
  '1.12-modified': M1_12_OCT,
  '1.2-modified': M1_2_OCT,
};
const DEFAULT_TABLE = V1_10;

export function resolveFirmware(state) {
  const chosen = state?.globals?.firmware;
  if (chosen && chosen !== 'auto') return chosen;
  return state?.globals?.settingsLayout === 2 ? '1.2' : '1.10';
}

function tableFor(firmware) {
  return TABLES[firmware] ?? DEFAULT_TABLE;
}

export function typesFor(blockId, firmware) {
  const entry = tableFor(firmware)[blockId];
  return entry ? structuredClone(entry.types) : [];
}

export function extraCommonParams(blockId, firmware) {
  const entry = tableFor(firmware)[blockId];
  return entry ? structuredClone(entry.common) : [];
}
