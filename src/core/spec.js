// Authoritative block/CC map. Parameter definitions are transliterated from the
// hardware-verified upstream editor so the editor and the live router agree.
import { fx1 } from '../data/blocks/fx1.js';
import { fx2 } from '../data/blocks/fx2.js';
import { amp } from '../data/blocks/amp.js';
import { cab } from '../data/blocks/cab.js';
import { mod } from '../data/blocks/mod.js';
import { del } from '../data/blocks/del.js';
import { rev } from '../data/blocks/rev.js';
import { eq } from '../data/blocks/eq.js';

const REVERB_VARIANTS = { room: 0, plate: 1, hall: 2, concert: 3, shimmer: 5, cloud: 6, spring: 7 };

function decorate(block) {
  return {
    id: block.id,
    name: block.name,
    onOffCc: block.onOffCC,
    typeCc: block.typeCC,
    // AMP/CAB model selection only works over SysEx on firmware 1.10.
    sysexTypeField: block.sysexTypeField,
    note: block.note,
    warning: block.warning,
    commonParams: block.commonParams ?? [],
    types: block.types.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      warning: t.warning,
      params: t.params,
      variant: block.id === 'rev' ? REVERB_VARIANTS[t.slug] : t.id,
    })),
    definition: block,
  };
}

// Display order differs from the snapshot order (MOD comes before DEL here).
export const BLOCKS = [fx1, fx2, amp, cab, mod, del, rev, eq].map(decorate);

// Runtime snapshot order, confirmed by toggling each on/off CC.
export const SNAPSHOT_BLOCKS = [fx1, fx2, amp, cab, del, mod, rev, eq].map((b) => b.id);
export const chainBlockIds = (chainOrder) =>
  (chainOrder ?? [0, 1, 2, 3, 4, 5, 6, 7]).map((index) => SNAPSHOT_BLOCKS[index]).filter(Boolean);

export const BLOCK_BY_ID = Object.fromEntries(BLOCKS.map((b) => [b.id, b]));
export const blockByCc = (cc) => BLOCKS.find((b) => b.onOffCc === cc);

const PARAM_BASE = {
  fx1: 50, fx2_drive: 57, fx2_special: 68, amp: 60, cab: 65,
  mod: 68, del: 74, rev: 85, eq: 91,
};

export const FX2_SPECIAL_TYPES = [8, 9, 10, 11];

export function paramCcFor(blockId, index, variant = 0) {
  if (blockId === 'fx2') {
    return (FX2_SPECIAL_TYPES.includes(variant) ? PARAM_BASE.fx2_special : PARAM_BASE.fx2_drive) + index;
  }
  const base = PARAM_BASE[blockId];
  if (base === undefined) throw new Error(`Unknown block: ${blockId}`);
  return base + index;
}

export function paramsFor(blockId, variant) {
  const block = BLOCK_BY_ID[blockId];
  if (!block) return block?.commonParams ?? [];
  const type = block.types.find((t) => t.id === variant);
  return [...(block.commonParams ?? []), ...(type?.params ?? [])];
}

