// In-memory NANOCORE simulator used by demo mode. It answers the same SysEx
// opcodes and CC writes as the pedal so the real app pipeline (scheduler,
// request/reply, snapshot parser, views) is exercised without hardware.
// Nothing here is a substitute for a hardware-verified mapping: the values
// are plausible examples chosen to make Editor and Live worth exploring.
import {
  COMMAND, FIELD, MANUFACTURER, DIR_DEVICE_TO_HOST, DIR_HOST_TO_DEVICE,
  buildRequestSysEx, parseSysEx, pack7bit, u16le,
} from './messages.js';
import { SNAPSHOT_BLOCKS, BLOCK_BY_ID } from './spec.js';
import { typesFor, extraCommonParams } from './versions.js';
import { COMMAND as CAT } from './catalog.js';
import { buildSnapshotReply } from './snapshot.js';

const DEMO_FIRMWARE = '1.2'; // includes the later-firmware controls in every snapshot
const DEFAULT_VARIANTS = { fx1: 2, fx2: 1, amp: 7, cab: 9, del: 0, mod: 0, rev: 1, eq: 0 };
const PRESET_NAMES = [
  'Clean', 'Warm Clean', 'Edge', 'Crunch', 'Blues', 'Rock Rhythm', 'Lead', 'Solo',
  'Hi Gain', 'Metal', 'Funk', 'Ambient', 'Slide', 'Folk', 'Jazz', 'Bloom',
];
const AMP_NAMES = BLOCK_BY_ID.amp.types.slice(0, 30).map((type) => type.name);
const IR_NAMES = BLOCK_BY_ID.cab.types.slice(0, 30).map((type) => type.name);

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const bytesN = (text, length) => {
  const chars = [...String(text ?? '').replace(/[^\x20-\x7e]/g, ' ').slice(0, length)];
  return [...chars.map((c) => c.charCodeAt(0)), ...new Array(length - chars.length).fill(0x20)];
};
const bytes8 = (text) => bytesN(text, 8);

function paramsFor(blockId, variant) {
  const block = BLOCK_BY_ID[blockId];
  if (!block) return [];
  const type = typesFor(blockId, DEMO_FIRMWARE).find((t) => t.variant === variant);
  return [...block.commonParams, ...extraCommonParams(blockId, DEMO_FIRMWARE), ...(type?.params ?? [])];
}

function replyFrame(command, payload, sequence) {
  const body = [0x02, ...u16le(sequence), ...u16le(command), 0x00, ...u16le(payload.length), ...payload];
  return [0xf0, ...MANUFACTURER, DIR_DEVICE_TO_HOST, ...pack7bit(body), 0xf7];
}

function ccNormalized(param, value) {
  if (param.kind === 'enum') {
    const count = Math.max(1, (param.options?.length ?? 1) - 1);
    return clamp(value / count, 0, 1);
  }
  const span = Number(param.max) - Number(param.min);
  return span > 0 ? clamp((value - Number(param.min)) / span, 0, 1) : 0;
}

export function createDemoDevice() {
  let seed = 0x2f6e2b1;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const presetNames = PRESET_NAMES.map((name, index) => bytes8(index < 16 ? name : `${name.slice(0, 5)}${Math.floor(index / 16) + 1}`));
  const state = {
    activePreset: 0, // zero-based, like the pedal's snapshot
    volume: 68,
    chainOrder: [0, 1, 2, 3, 4, 5, 6, 7],
    blocks: SNAPSHOT_BLOCKS.map((id) => {
      const variant = DEFAULT_VARIANTS[id] ?? 0;
      return {
        id,
        enabled: id !== 'fx1',
        variant,
        params: paramsFor(id, variant).map(() => Number((0.28 + random() * 0.44).toFixed(3))),
      };
    }),
  };
  const block = (id) => state.blocks.find((entry) => entry.id === id);

  function snapshotPayload() {
    const out = [0x03, state.activePreset & 0xff, clamp(state.volume, 0, 127) & 0xff];
    for (const entry of state.blocks) {
      out.push(entry.enabled ? 1 : 0, entry.variant & 0xff, entry.params.length);
      const view = new DataView(new ArrayBuffer(entry.params.length * 4));
      entry.params.forEach((value, index) => view.setFloat32(index * 4, value, true));
      out.push(...new Uint8Array(view.buffer));
    }
    out.push(0x08, ...state.chainOrder.map((index) => index & 0xff));
    return out;
  }

  function storagePayload(kind) {
    const list = kind === 'amp' ? AMP_NAMES : IR_NAMES;
    const active = kind === 'amp' ? block('amp').variant : block('cab').variant;
    const out = new Array(20).fill(0);
    out[0] = kind === 'amp' ? 1 : 2;
    out.splice(8, 4, ...u16le(list.length), 0, 0);
    out.splice(12, 4, ...u16le(128), 0, 0);
    out.splice(16, 2, ...u16le(clamp(active, 0, list.length - 1)));
    return out;
  }

  function slotPayload(kind, slot) {
    const list = kind === 'amp' ? AMP_NAMES : IR_NAMES;
    const out = new Array(30).fill(0);
    const name = list[slot] ?? `Slot ${slot}`;
    out[0] = slot & 0xff;
    out[1] = slot < list.length ? 1 : 0;
    out[2] = block(kind === 'amp' ? 'amp' : 'cab').variant === slot ? 1 : 0;
    out.splice(14, 16, ...bytesN(name, 16));
    return out;
  }

  function catalogPayload(start, count) {
    const out = [0x00, count & 0xff];
    for (let i = 0; i < count; i++) {
      const slot = start + i;
      out.push(slot & 0xff, 0x01, ...(presetNames[slot] ?? bytes8(`Preset ${slot + 1}`)));
    }
    return out;
  }

  function applyField(payload) {
    const [field, a, b] = payload;
    if (field === FIELD.RECALL) {
      // Snapshot presets are zero-based, like the pedal's slot numbers.
      state.activePreset = clamp(Number(a), 0, 63);
      return true;
    }
    if (field === FIELD.VOLUME) {
      state.volume = clamp(Number(a), 0, 100);
      return true;
    }
    if (field === FIELD.PARAMETER) {
      const entry = state.blocks[Number(a)];
      const index = Number(b);
      if (!entry || entry.params[index] === undefined || payload.length < 7) return false;
      const view = new DataView(new Uint8Array(payload.slice(3, 7)).buffer);
      const value = view.getFloat32(0, true);
      if (Number.isFinite(value)) entry.params[index] = clamp(value, 0, 1);
      return true;
    }
    if (field === FIELD.ENABLED) {
      const entry = state.blocks[Number(a)];
      if (!entry) return false;
      entry.enabled = Boolean(Number(b));
      return true;
    }
    if (field === FIELD.CHAIN_ORDER) {
      const order = payload.slice(2, 10);
      if (order.length === 8 && new Set(order).size === 8 && order.every((n) => n >= 0 && n < 8)) {
        state.chainOrder = [...order];
        return true;
      }
      return false;
    }
    if (field === FIELD.AMP_MODEL || field === FIELD.CAB_MODEL) {
      const entry = block(field === FIELD.AMP_MODEL ? 'amp' : 'cab');
      if (!entry) return false;
      entry.variant = clamp(Number(a), 0, 30);
      return true;
    }
    if (field === FIELD.RENAME) {
      const name = String.fromCharCode(...payload.slice(2, 2 + Number(b)));
      presetNames[state.activePreset] = bytes8(name);
      return true;
    }
    return false;
  }

  function applyCc(number, value) {
    if (number === 0 || number === 32) return false; // bank select, ignored
    for (const entry of state.blocks) {
      const definition = BLOCK_BY_ID[entry.id];
      if (number === definition.onOffCc) {
        entry.enabled = value >= 64;
        return true;
      }
      if (number === definition.typeCc) {
        const known = typesFor(entry.id, DEMO_FIRMWARE).some((type) => type.variant === value);
        if (known || entry.id === 'amp' || entry.id === 'cab') {
          entry.variant = clamp(value, 0, entry.id === 'amp' || entry.id === 'cab' ? 30 : 20);
          return true;
        }
      }
      const params = paramsFor(entry.id, entry.variant);
      const index = params.findIndex((param) => param.cc === number);
      if (index !== -1) {
        entry.params[index] = ccNormalized(params[index], value);
        return true;
      }
    }
    return false;
  }

  // Accepts raw MIDI bytes (CC / Program Change) or a NC71 SysEx request.
  // Returns { replies: [byte arrays], changed: boolean }.
  function handle(bytes) {
    const data = [...bytes];
    const replies = [];
    let changed = false;
    if (data[0] === 0xf0) {
      const request = parseSysEx(data);
      if (!request || request.direction !== DIR_HOST_TO_DEVICE) return { replies, changed };
      const seq = request.sequence;
      const payload = request.payload;
      switch (request.command) {
        case COMMAND.GET_SNAPSHOT:
          replies.push(buildSnapshotReply(snapshotPayload(), seq));
          break;
        case COMMAND.GET_GLOBALS:
          replies.push(replyFrame(COMMAND.GET_GLOBALS, [2, 0, 0, 0, 100, 100, 1], seq));
          break;
        case CAT.PRESET_CATALOG: {
          const start = clamp(Number(payload[0]) || 0, 0, 63);
          const count = Math.min(Number(payload[1]) || 6, 64 - start, 8);
          replies.push(replyFrame(CAT.PRESET_CATALOG, catalogPayload(start, count), seq));
          break;
        }
        case CAT.AMP_INFO:
          replies.push(replyFrame(CAT.AMP_INFO, storagePayload('amp'), seq));
          break;
        case CAT.IR_INFO:
          replies.push(replyFrame(CAT.IR_INFO, storagePayload('ir'), seq));
          break;
        case CAT.AMP_SLOT_INFO:
          replies.push(replyFrame(CAT.AMP_SLOT_INFO, slotPayload('amp', Number(payload[0]) || 0), seq));
          break;
        case CAT.IR_SLOT_INFO:
          replies.push(replyFrame(CAT.IR_SLOT_INFO, slotPayload('ir', Number(payload[0]) || 0), seq));
          break;
        case COMMAND.SET_FIELD:
          changed = applyField(payload);
          replies.push(replyFrame(COMMAND.SET_FIELD, [], seq));
          break;
        case COMMAND.SAVE_PRESET:
          replies.push(replyFrame(COMMAND.SAVE_PRESET, [], seq));
          break;
        case COMMAND.READ_PRESET:
          replies.push(buildSnapshotReply(snapshotPayload(), seq));
          break;
        default:
          replies.push(replyFrame(request.command, [], seq));
      }
      return { replies, changed };
    }
    const kind = data[0] & 0xf0;
    if (kind === 0xb0 && data.length >= 3) changed = applyCc(data[1], data[2]);
    if (kind === 0xc0 && data.length >= 2) {
      state.activePreset = clamp(Number(data[1]), 0, 63);
      changed = true;
    }
    return { replies, changed };
  }

  return {
    handle,
    snapshotFrame: () => buildSnapshotReply(snapshotPayload(), 0),
    get state() { return state; },
  };
}

// Exposed for tests and manual probing: a SysEx request plus its parsed reply.
export function demoRequest(device, command, payload = [], sequence = 1) {
  const { replies } = device.handle(buildRequestSysEx(command, payload, sequence));
  return replies.map((bytes) => parseSysEx(bytes)).filter(Boolean);
}
