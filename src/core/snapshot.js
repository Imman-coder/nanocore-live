// Decode the 0x63 runtime snapshot. Accepts a raw payload or a full NC71 SysEx reply.
import { parseSysEx, pack7bit, MANUFACTURER, DIR_DEVICE_TO_HOST, u16le } from './messages.js';
import { SNAPSHOT_BLOCKS } from './spec.js';

function readFloats(bytes, offset, count) {
  if (offset + count * 4 > bytes.length) throw new Error('Truncated snapshot parameters');
  const view = new DataView(new Uint8Array(bytes).buffer, offset, count * 4);
  const params = [];
  for (let i = 0; i < count; i++) params.push(view.getFloat32(i * 4, true));
  return { params, offset: offset + count * 4 };
}

export function parseSnapshot(input) {
  let bytes = [...input];
  let sequence = null;
  if (input?.[0] === 0xf0) {
    const frame = parseSysEx(bytes);
    if (!frame || frame.command !== 0x63) throw new Error('Not a snapshot reply');
    bytes = frame.payload;
    sequence = frame.sequence;
  }
  if (bytes[0] !== 0x03) throw new Error('Unknown snapshot layout');
  let offset = 1;
  const activePreset = bytes[offset++];
  const volume = bytes[offset++];
  const blocks = SNAPSHOT_BLOCKS.map((id) => {
    if (offset + 3 > bytes.length) throw new Error('Truncated snapshot block');
    const enabled = bytes[offset++] === 1;
    const variant = bytes[offset++];
    const count = bytes[offset++];
    const { params, offset: next } = readFloats(bytes, offset, count);
    offset = next;
    return { id, enabled, variant, params };
  });
  let chainOrder = [0, 1, 2, 3, 4, 5, 6, 7];
  if (bytes[offset] === 0x08 && offset + 9 <= bytes.length) {
    chainOrder = bytes.slice(offset + 1, offset + 9);
  }
  return { activePreset, volume, blocks, chainOrder, sequence };
}

// Used by tests and the simulated device for end-to-end verification.
export function buildSnapshotReply(payload, sequence = 1) {
  const frame = [0x02, ...u16le(sequence), 0x63, 0x00, 0x00, ...u16le(payload.length), ...payload];
  return [0xf0, ...MANUFACTURER, DIR_DEVICE_TO_HOST, ...pack7bit(frame), 0xf7];
}
