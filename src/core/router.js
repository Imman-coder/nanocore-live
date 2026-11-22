// Turns inbound controller MIDI into outbound NANOCORE MIDI.
// Pure logic: no browser APIs here, so it is fully testable in node.
import { buildCc, buildPc, buildRequestSysEx, COMMAND, FIELD } from './messages.js';
import { BLOCK_BY_ID, paramCcFor } from './spec.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function decodeMessage(bytes) {
  const data = [...bytes];
  const status = data[0];
  const channel = (status & 0x0f) + 1;
  const kind = status & 0xf0;
  if (kind === 0xb0 && data.length >= 3) {
    return { type: 'cc', channel, number: data[1], value: data[2] };
  }
  if (kind === 0xc0 && data.length >= 2) {
    return { type: 'pc', channel, number: data[1], value: null };
  }
  if ((kind === 0x90 || kind === 0x80) && data.length >= 3) {
    return { type: 'note', channel, number: data[1], value: data[2], on: kind === 0x90 && data[2] > 0 };
  }
  return null;
}

export function describeTrigger(trigger) {
  if (!trigger) return 'unassigned';
  if (trigger.type === 'pc') return `PC${trigger.channel !== 1 ? ` (ch ${trigger.channel})` : ''}`;
  if (trigger.type === 'note') return `Note ${trigger.number}`;
  return `CC ${trigger.number}`;
}

const sameTrigger = (a, b) =>
  a && b && a.type === b.type && a.channel === b.channel && a.number === b.number;

export function createRouter({ globals, getActiveRow, send, onEvent = () => {}, isDevicePort = () => false, getVariant = () => 0 }) {
  const blockStates = new Map();
  let learn = null;
  let learned = null;

  const emit = (event) => onEvent({ at: Date.now(), ...event });

  function handleMidi({ port, bytes }) {
    if (isDevicePort(port)) return;
    const message = decodeMessage(bytes);
    if (!message) return;

    if (learn) {
      learned = {
        type: message.type,
        channel: message.channel,
        ...(message.number !== undefined ? { number: message.number } : {}),
      };
      emit({ type: 'learn', target: learn, trigger: learned });
      learn = null;
      return;
    }

    if (message.type === 'note' && message.on === false) return;
    const row = getActiveRow();
    if (!row) return;

    for (const fs of globals.footswitches ?? []) {
      if (!sameTrigger(fs.trigger, message)) continue;
      const bindings = (row.stomps ?? []).filter((s) => s.fsId === fs.id);
      for (const binding of bindings) {
        for (const target of binding.targets ?? []) {
          const block = typeof target === 'string' ? target : target.block;
          let value = message.value ?? 0;
          if (binding.mode === 'toggle') {
            value = !blockStates.get(block) ? 127 : 0;
            blockStates.set(block, value === 127);
          } else if (typeof target.value === 'number') {
            value = target.value;
          }
          send(buildCc(globals.midiChannel ?? 1, BLOCK_BY_ID[block].onOffCc, value));
          emit({ type: 'stomp', footswitch: fs.id, block, value });
        }
      }
    }

    for (const expression of row.expressions ?? []) {
      if (!sameTrigger(expression.trigger, message)) continue;
      const lo = expression.inputMin ?? 0;
      const hi = expression.inputMax ?? 127;
      let normalized = hi > lo ? clamp((message.value - lo) / (hi - lo), 0, 1) : 0;
      if (expression.invert) normalized = 1 - normalized;
      const ccValue = Math.round(normalized * 127);
      const variant = typeof expression.target === 'object' ? (expression.target.variant ?? 0) : getVariant(expression.target);
      const cc = paramCcFor(
        typeof expression.target === 'object' ? expression.target.block : expression.target,
        expression.paramIndex ?? 0,
        variant,
      );
      send(buildCc(globals.midiChannel ?? 1, cc, ccValue));
      emit({ type: 'expression', expression: expression.id, cc, value: ccValue });
    }
  }

  function recallPreset(visiblePreset) {
    const slot = clamp(visiblePreset - 1, 0, 127);
    if (globals.recallMethod === 'pc') {
      // Bank must be 0 first or the pedal ignores every later Program Change.
      send(buildCc(globals.midiChannel ?? 1, 0, 0));
      send(buildCc(globals.midiChannel ?? 1, 32, 0));
      send(buildPc(globals.midiChannel ?? 1, slot));
    } else {
      send(buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.RECALL, slot]));
    }
    emit({ type: 'preset', preset: visiblePreset });
  }

  return {
    handleMidi,
    recallPreset,
    setBlockState(id, on) { blockStates.set(id, Boolean(on)); },
    armLearn(target) { learn = target; learned = null; },
    get learn() { return learn; },
    consumeLearnedTrigger() {
      const value = learned;
      learned = null;
      return value;
    },
  };
}

