// Byte-exact NANOCORE MIDI / SysEx builders and parsers.
// Frame: F0 7D 4E 43 <dir> PACK(body) F7
// Request body: 02 | sequence u16le | command u16le | payloadLength u16le | payload
// Reply body:   02 | sequence u16le | command u16le | status u8 | payloadLength u16le | payload

export const MANUFACTURER = [0x7d, 0x4e, 0x43];
export const DIR_HOST_TO_DEVICE = 0x70;
export const DIR_DEVICE_TO_HOST = 0x71;
export const DIR_DEVICE_PUSH = 0x72;

export function isDevicePush(bytes) {
  const data = bytes ?? [];
  return data[0] === 0xf0 && data[1] === 0x7d && data[2] === 0x4e
    && data[3] === 0x43 && data[4] === DIR_DEVICE_PUSH && data[data.length - 1] === 0xf7;
}

export const COMMAND = {
  GET_SNAPSHOT: 0x63,
  SET_FIELD: 0x6d,
  GET_GLOBALS: 0x65,
  SET_GLOBALS: 0x66,
  SAVE_PRESET: 0x46,
  PRESET_CATALOG: 0x40,
  READ_PRESET: 0x41,
};

export const FIELD = {
  PARAMETER: 0x01,
  ALL_PARAMETERS: 0x02,
  ENABLED: 0x03,
  VOLUME: 0x04,
  CHAIN_ORDER: 0x05,
  AMP_MODEL: 0x06,
  CAB_MODEL: 0x07,
  RENAME: 0x08,
  RECALL: 0x09,
};

const byte = (n) => (n & 0xff);
const u16 = (n) => [byte(n), byte(n >> 8)];
export const u16le = u16;

// Reassemble device replies streamed with statuses 0x10 (more) and 0x11 (final).
// Chunk payloads start with total:u16le and offset:u16le, then the chunk bytes.
export class ResponseAssembler {
  constructor() {
    this.streams = new Map();
  }

  feed(response) {
    if (!response || (response.status !== 0x10 && response.status !== 0x11)) return response;
    const key = `${response.sequence}:${response.command}`;
    try {
      return this.feedChunk(key, response);
    } catch (error) {
      this.streams.delete(key);
      throw error;
    }
  }

  feedChunk(key, response) {
    const payload = response.payload;
    if (payload.length < 4) throw new Error('Truncated streamed NANOCORE response');
    const total = payload[0] | (payload[1] << 8);
    const offset = payload[2] | (payload[3] << 8);
    const chunk = payload.slice(4);
    if (total === 0 || offset + chunk.length > total) throw new Error('Invalid streamed chunk range');
    if (!this.streams.has(key)) {
      this.streams.set(key, { total, data: new Uint8Array(total), received: new Uint8Array(total) });
    }
    const stream = this.streams.get(key);
    if (stream.total !== total) throw new Error('Streamed response length changed');
    const end = offset + chunk.length;
    for (let i = 0; i < chunk.length; i++) {
      if (stream.received[offset + i] && stream.data[offset + i] !== chunk[i]) {
        throw new Error('Contradictory overlapping streamed chunks');
      }
    }
    stream.data.set(chunk, offset);
    stream.received.fill(1, offset, end);
    if (response.status !== 0x11) return null;
    if (!stream.received.every(Boolean)) throw new Error('Final streamed chunk arrived before all data');
    this.streams.delete(key);
    return { ...response, status: 0, payload: [...stream.data] };
  }
}

function checkValue(name, n, max) {
  if (!Number.isInteger(n) || n < 0 || n > max) {
    throw new RangeError(`${name} must be an integer 0-${max}`);
  }
}

export function buildCc(channel, controller, value) {
  checkValue('channel', channel, 16);
  if (channel < 1) throw new RangeError('channel must be 1-16');
  checkValue('controller', controller, 127);
  checkValue('value', value, 127);
  return [0xb0 | (channel - 1), controller, value];
}

export function buildPc(channel, program) {
  checkValue('channel', channel, 16);
  if (channel < 1) throw new RangeError('channel must be 1-16');
  checkValue('program', program, 127);
  return [0xc0 | (channel - 1), program];
}

// Up to seven bytes per group: a high-bit mask followed by the seven low bits.
export function pack7bit(body) {
  const out = [];
  for (let i = 0; i < body.length; i += 7) {
    const group = body.slice(i, i + 7);
    let mask = 0;
    group.forEach((b, j) => { if (b & 0x80) mask |= 1 << j; });
    out.push(mask, ...group.map((b) => b & 0x7f));
  }
  return out;
}

export function unpack7bit(packed) {
  const out = [];
  for (let i = 0; i < packed.length; i += 8) {
    const mask = packed[i];
    for (let j = 0; j < 7 && i + 1 + j < packed.length; j++) {
      const b = packed[i + 1 + j];
      out.push(j < 7 && mask & (1 << j) ? b | 0x80 : b);
    }
  }
  return out;
}

// Rename the active preset in live RAM (field 0x08). At most 8 printable ASCII
// characters; the pedal pads with spaces and echoes the bytes back.
export function cleanPresetName(name) {
  return String(name ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, 8);
}

export function buildRenameSysEx(name, sequence = 1) {
  const clean = cleanPresetName(name);
  if (!clean) throw new RangeError('Preset name needs at least one printable ASCII character');
  return buildRequestSysEx(COMMAND.SET_FIELD,
    [FIELD.RENAME, clean.length, ...[...clean].map((c) => c.charCodeAt(0))], sequence);
}

export function buildRequestSysEx(command, payload, sequence = 1, direction = DIR_HOST_TO_DEVICE) {
  const p = payload ?? [];
  const body = [0x02, ...u16(sequence), ...u16(command), ...u16(p.length), ...p];
  return [0xf0, ...MANUFACTURER, direction, ...pack7bit(body), 0xf7];
}

export function parseSysEx(bytes) {
  const data = [...bytes];
  if (data[0] !== 0xf0 || data[data.length - 1] !== 0xf7) return null;
  const body = data.slice(1, -1);
  if (body.length < 5 || body[0] !== 0x7d || body[1] !== 0x4e || body[2] !== 0x43) return null;
  const direction = body[3];
  if (direction !== DIR_HOST_TO_DEVICE && direction !== DIR_DEVICE_TO_HOST) return null;
  const decoded = unpack7bit(body.slice(4));
  if (decoded[0] !== 0x02 || decoded.length < 7) return null;
  const sequence = decoded[1] | (decoded[2] << 8);
  const command = decoded[3] | (decoded[4] << 8);
  const index = direction === DIR_DEVICE_TO_HOST ? 5 : 4;
  const status = direction === DIR_DEVICE_TO_HOST ? decoded[index] : null;
  const length = decoded[index + 1] | (decoded[index + 2] << 8);
  const payload = decoded.slice(index + 3);
  if (payload.length !== length) return null;
  return { direction, sequence, command, status, payload };
}

// BLE-MIDI: every packet is [timestampHi|0x80, timestampLo|0x80, ...data].
// SysEx data is spread across packets, starting with F0 and ending with F7.
export function splitBleMidi(bytes, mtu = 20) {
  const data = [...bytes];
  const capacity = mtu - 2;
  const header = [0x80, 0x80];
  if (data[0] !== 0xf0) return [ [...header, ...data] ];
  const packets = [];
  for (let i = 0; i < data.length; i += capacity) {
    packets.push([...header, ...data.slice(i, i + capacity)]);
  }
  return packets;
}

export function reassembleBleMidi(packets) {
  const data = packets.flatMap((packet) => [...packet].slice(2));
  if (data[0] !== 0xf0) return data;
  const end = data.indexOf(0xf7);
  return end === -1 ? data : data.slice(0, end + 1);
}
