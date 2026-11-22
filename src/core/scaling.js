// NANOCORE CC <-> real-world value conversion.
// The device convention is linear: CC 0 -> min, CC 127 -> max.

export const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function valueToCc(value, min, max) {
  if (!(max > min)) return 0;
  return Math.round(clamp01((value - min) / (max - min)) * 127);
}

export function ccToValue(cc, min, max) {
  const normalized = Math.max(0, Math.min(127, cc)) / 127;
  return min + normalized * (max - min);
}

export function enumToCc(index, options) {
  const count = Array.isArray(options) ? options.length : Number(options);
  if (!Number.isFinite(count) || count <= 0) return 0;
  const bucket = 128 / count;
  return Math.max(0, Math.min(127, Math.round(index * bucket + bucket / 2)));
}

export function ccToEnum(cc, options) {
  const count = Array.isArray(options) ? options.length : Number(options);
  if (!Number.isFinite(count) || count <= 0) return 0;
  const bucket = 128 / count;
  return Math.max(0, Math.min(count - 1, Math.floor(cc / bucket)));
}

// 0-63 = off, 64-127 = on; always transmit at the boundaries.
export function onOffToCc(on) {
  return on ? 127 : 0;
}

export function ccToOnOff(cc) {
  return cc >= 64;
}
