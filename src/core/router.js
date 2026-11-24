// Turns inbound controller MIDI into outbound NANOCORE MIDI.
// Pure logic: no browser APIs here, so it is fully testable in node.
import { buildCc, buildPc, buildRequestSysEx, COMMAND, FIELD } from './messages.js';
import { BLOCK_BY_ID } from './spec.js';
import { expressionBytes } from './live.js';

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

export function createRouter({ globals, getActiveRow, send, onEvent = () => {}, isDevicePort = () => false, getVariant = () => 0, onScene = () => {}, onTapTempo = () => {} }) {
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

    for (const sw of globals.sceneSwitches ?? []) {
      if (!sameTrigger(sw.trigger, message)) continue;
      if (message.value !== undefined && message.value < 1) continue;
      onScene(sw.scene);
      emit({ type: 'scene', switch: sw.id, scene: sw.scene });
    }

    const tap = globals.tapTempoSwitch;
    if (tap && sameTrigger(tap.trigger, message)) {
      if (message.value !== undefined && message.value < 1) return;
      onTapTempo();
      emit({ type: 'tap-tempo', switch: tap.id });
    }

    for (const expression of row.expressions ?? []) {
      if (!sameTrigger(expression.trigger, message)) continue;
      const variant = typeof expression.target === 'object' ? (expression.target.variant ?? 0) : getVariant(expression.target);
      const bytes = expressionBytes(expression, globals.midiChannel ?? 1, variant, message.value);
      send(bytes, `expression:${expression.id}`);
      emit({ type: 'expression', expression: expression.id, cc: bytes[1], value: bytes[2] });
    }

    const volumePedal = (globals.expressionPedals ?? []).find((pedal) => pedal.id === globals.volumePedal);
    if (volumePedal && message.value !== null && sameTrigger(volumePedal.trigger, message)) {
      emit({ type: 'expression-volume', expression: volumePedal.id, volume: Math.round((message.value / 127) * 100) });
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

