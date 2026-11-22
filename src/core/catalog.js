// Preset-name catalog and amp/IR slot-name parsing (opcodes 0x40, 0x30/0x36, 0x50/0x56).
export const COMMAND = {
  PRESET_CATALOG: 0x40,
  AMP_INFO: 0x30,
  AMP_SLOT_INFO: 0x36,
  IR_INFO: 0x50,
  IR_SLOT_INFO: 0x56,
};

const u16 = (bytes, at) => bytes[at] | (bytes[at + 1] << 8);
const u32 = (bytes, at) => (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;

function label(bytes) {
  return String.fromCharCode(...bytes).replace(/[^\x20-\x7e]/g, ' ').replace(/[ \0]+$/, '');
}

export function activeSlotFor(storageActive, snapshotVariant, slotCount) {
  for (const candidate of [storageActive, snapshotVariant]) {
    if (Number.isInteger(candidate) && candidate >= 0 && candidate < slotCount) return candidate;
  }
  return null;
}

export function parseGlobalSettings(payload) {
  if (payload.length < 7) throw new Error('Global settings reply is too short');
  const rawGain = payload[3];
  return {
    layout: payload[0],
    bluetooth: Boolean(payload[1]),
    loopback: Boolean(payload[2]),
    inputGain: rawGain > 127 ? rawGain - 256 : rawGain,
    usbVolume: payload[4],
    bluetoothVolume: payload[5],
    midiChannel: payload[6],
  };
}

export function parsePresetCatalog(payload) {
  if (payload.length < 2) throw new Error('Truncated preset catalog page');
  const count = payload[1];
  if (payload.length !== 2 + count * 10) throw new Error('Preset catalog length mismatch');
  const entries = [];
  for (let offset = 2; offset < payload.length; offset += 10) {
    const slot = payload[offset];
    entries.push({ slot, flags: payload[offset + 1], name: label(payload.slice(offset + 2, offset + 10)), display: slot + 1 });
  }
  return entries;
}

export function parseStorageInfo(payload) {
  if (payload.length < 20) throw new Error('Asset storage info must be at least 20 bytes');
  const slotCount = u32(payload, 8);
  const sizeLimit = u32(payload, 12);
  const rawActive = u16(payload, 16);
  if (!slotCount || !sizeLimit) throw new Error('Asset storage info reports no slots or no capacity');
  return { slotCount, sizeLimit, activeSlot: rawActive === 0xffff ? null : rawActive };
}

export function parseSlotInfo(payload, expectedSlot = null) {
  if (payload.length !== 30) throw new Error('Asset slot metadata must be 30 bytes');
  const present = payload[1];
  const active = payload[2];
  if (present !== 0 && present !== 1) throw new Error('Invalid asset slot flags');
  if (active !== 0 && active !== 1) throw new Error('Invalid asset slot flags');
  if (expectedSlot !== null && payload[0] !== expectedSlot) {
    throw new Error(`Slot info answers for slot ${payload[0]}, not ${expectedSlot}`);
  }
  // The app stops the name at the first 00 or ff byte (FUN_00466cfc).
  const nameBytes = payload.slice(14, 30);
  const end = nameBytes.findIndex((b) => b === 0x00 || b === 0xff);
  const name = label(end === -1 ? nameBytes : nameBytes.slice(0, end)).trim();
  return {
    slot: payload[0],
    present: Boolean(present),
    active: Boolean(active),
    size: u32(payload, 3),
    checksum: u32(payload, 7),
    formatId: u16(payload, 11),
    name,
  };
}
