// Tap tempo and delay-time syncing. The NANOCORE has no tap tempo of its own,
// but its delay Time/Delay parameters are writable, so the browser computes
// the tempo and writes the resulting milliseconds to those parameters.
export const SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '3/8'];

export const SUBDIVISIONS = [
  { id: '1/4', label: 'Quarter', multiplier: 1 },
  { id: '1/8', label: 'Eighth', multiplier: 0.5 },
  { id: '1/8d', label: 'Dotted eighth', multiplier: 0.75 },
  { id: '1/16', label: 'Sixteenth', multiplier: 0.25 },
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function tapBpm(taps, now = Date.now()) {
  const recent = (taps ?? []).filter((t) => now - t <= 4000).slice(-5);
  if (recent.length < 2) return null;
  let total = 0;
  let count = 0;
  for (let i = 1; i < recent.length; i++) {
    const gap = recent[i] - recent[i - 1];
    if (gap < 200 || gap > 2000) continue;
    total += gap;
    count++;
  }
  if (!count) return null;
  return Math.round(60000 / (total / count));
}

export function beatMs(bpm, signature = '4/4') {
  if (!bpm || bpm < 30 || bpm > 300) return 500;
  const [numerator, denominator] = String(signature).split('/').map(Number);
  let unit = 1;
  // An eighth-note signature makes the eighth the beat unit; in compound
  // time (6/8, 9/8, 12/8) the main pulse is a dotted quarter instead.
  if (denominator === 8) unit = [6, 9, 12].includes(numerator) ? 1.5 : 0.5;
  return (60000 / bpm) * unit;
}

export function delayMs(bpm, signature, subdivision) {
  const option = SUBDIVISIONS.find((s) => s.id === subdivision) ?? SUBDIVISIONS[1];
  return Math.round(beatMs(bpm, signature) * option.multiplier);
}

export function normalizedForMs(ms, min, max) {
  if (!(max > min)) return 0;
  return clamp((ms - min) / (max - min), 0, 1);
}
