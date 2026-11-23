// MIDI output scheduler. All pedal writes go through one queue so the device
// never sees a burst, and rapid sweeps of the same control collapse to the
// last value inside the coalescing window.
import { parseSysEx } from './messages.js';

export function midiKey(bytes) {
  const a = [...bytes];
  const channel = a[0] & 0x0f;
  const kind = a[0] & 0xf0;
  if (kind === 0xb0 && a.length >= 3) return `cc:${channel}:${a[1]}`;
  if (kind === 0xc0) return `pc:${channel}`;
  if ((kind === 0x90 || kind === 0x80) && a.length >= 3) {
    return `note:${channel}:${a[1]}:${kind === 0x90 && a[2] > 0 ? 'on' : 'off'}`;
  }
  if (a[0] === 0xf0) {
    try {
      const reply = parseSysEx(a);
      return `sysex:${reply.command}:${reply.sequence}:${reply.payload.join(',')}`;
    } catch {
      return `sysex:${a.join(',')}`;
    }
  }
  return `raw:${a.join(',')}`;
}

export function createMidiScheduler({
  writer,
  gapMs = 0,
  sysexGapMs = null,
  coalesceMs = 0,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  const queue = [];
  const cooldownFor = (bytes) => (bytes?.[0] === 0xf0 && sysexGapMs !== null ? sysexGapMs : gapMs);
  let nextFree = 0;
  let timer = null;
  let count = 0;
  let order = 0;

  function schedule() {
    if (timer !== null || queue.length === 0) return;
    const item = queue[0];
    // A message queued behind another inherits the cooldown, not just its
    // original due time; otherwise queued messages would fire in a burst.
    item.due = Math.max(item.due, nextFree);
    const wait = Math.max(0, item.due - now());
    timer = setTimer(flush, wait);
  }

  function flush() {
    timer = null;
    const item = queue.shift();
    if (!item) return;
    try {
      writer(item.bytes);
      count++;
      for (const resolve of item.promises) resolve(count);
    } catch (error) {
      for (const reject of item.rejects) reject(error);
    }
    nextFree = now() + cooldownFor(item.bytes);
    schedule();
  }

  function send(bytes, key = midiKey(bytes)) {
    return new Promise((resolve, reject) => {
      const existing = queue.find((item) => item.key === key);
      if (existing) {
        existing.bytes = [...bytes];
        existing.promises.push(resolve);
        existing.rejects.push(reject);
        return;
      }
      const item = {
        key,
        bytes: [...bytes],
        due: Math.max(nextFree, now() + coalesceMs),
        order: ++order,
        promises: [resolve],
        rejects: [reject],
      };
      queue.push(item);
      queue.sort((a, b) => a.due - b.due || a.order - b.order);
      schedule();
    });
  }

  return {
    send,
    get pending() { return queue.length; },
    get sentCount() { return count; },
    reset() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      queue.length = 0;
      nextFree = 0;
    },
  };
}
