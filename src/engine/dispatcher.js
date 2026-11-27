// The single command boundary. A command either changes canonical state, asks
// the gateway for a device effect, or both. Components and MIDI callbacks only
// emit commands; they never reach into protocol helpers themselves.
import {
  setScene, setSceneBlock, setSceneEnabled, setBase, setTempoSync, setParamPedal, markPresetEdited, updatePreset,
} from '../core/store.js';
import { BLOCK_BY_ID } from '../core/spec.js';
import { resolveExpression } from './resolver.js';
import { buildParameterWriteForTarget } from './writes.js';

export function createDispatcher({ getState, setState, getSnapshot = () => null, effects = {} }) {
  function emit(effect) {
    effects[effect.type]?.(effect);
  }

  function dispatch(command) {
    if (!command?.type) return;
    if (command.type === 'expression') {
      const state = getState();
      const binding = command.binding;
      const resolved = resolveExpression(binding, command.raw, {
        channel: command.channel ?? state.globals.midiChannel ?? 1,
        variant: command.variant ?? command.context?.variant ?? 0,
      });
      return dispatch(resolved);
    }

    const state = getState();
    const preset = command.preset ?? state.activePreset;
    let next = state;
    const pending = [];

    switch (command.type) {
      case 'writeParameter': {
        const bytes = command.bytes ?? buildParameterWriteForTarget({
          target: command.target,
          normalized: command.normalized,
          state,
          snapshot: getSnapshot(),
          channel: command.channel ?? state.globals.midiChannel ?? 1,
        });
        pending.push({ type: 'writeParameter', ...command, bytes });
        break;
      }
      case 'setVolume':
        pending.push({ type: 'setVolume', ...command });
        break;
      case 'setTempoDivision':
        next = markPresetEdited(setTempoSync(state, preset, command.block, { subdivision: command.subdivision }), preset);
        pending.push({ type: 'syncDelays', block: command.block });
        break;
      case 'setTempoSync':
        next = markPresetEdited(setTempoSync(state, preset, command.block, command.patch), preset);
        pending.push({ type: 'syncDelays', block: command.block });
        break;
      case 'setTempo':
        next = { ...state, globals: { ...state.globals, tempo: { ...(state.globals.tempo ?? {}), ...command.patch } } };
        pending.push({ type: 'syncDelays' });
        break;
      case 'storeScene':
        if (command.base) {
          next = markPresetEdited(setBase(state, preset, command.values, command.enabled), preset);
        } else {
          next = markPresetEdited(setScene(state, preset, command.name, command.values), preset);
          next = setSceneEnabled(next, preset, command.name, command.enabled);
        }
        break;
      case 'selectScene':
        next = { ...state, activeScene: command.name };
        break;
      case 'setSceneBlock':
        next = markPresetEdited(setSceneBlock(state, preset, command.block, command.participates, command.options ?? {}), preset);
        pending.push({
          type: 'notify',
          message: command.participates
            ? `${BLOCK_BY_ID[command.block]?.name ?? command.block} now participates in scenes`
            : command.options?.forgetValues
              ? `${BLOCK_BY_ID[command.block]?.name ?? command.block} excluded — saved values forgotten`
              : `${BLOCK_BY_ID[command.block]?.name ?? command.block} excluded — saved values kept`,
        });
        break;
      case 'recallScene':
        pending.push({ type: 'recallScene', name: command.name });
        break;
      case 'forgetSceneBlock':
        next = setSceneBlock(state, preset, command.block, false, { forgetValues: true }, command.keepBase);
        pending.push({
          type: 'notify',
          message: `${BLOCK_BY_ID[command.block]?.name ?? command.block} forgotten from this scene's saved values`,
        });
        break;
      case 'setParamPedal':
        next = markPresetEdited(setParamPedal(state, preset, command.block, command.paramIndex, command.config), preset);
        break;
      case 'setGlobalSetting': {
        const numeric = ['midiChannel'];
        const value = numeric.includes(command.key) ? Number(command.value) : command.value;
        next = { ...state, globals: { ...state.globals, [command.key]: value } };
        pending.push({ type: 'notify', message: `${command.key} updated` });
        break;
      }
      case 'markEdited':
        next = markPresetEdited(state, preset);
        break;
      case 'updatePreset':
        next = markPresetEdited(updatePreset(state, preset, command.patch), preset);
        break;
      case 'notify':
        pending.push({ type: 'notify', message: command.message });
        break;
      default:
        pending.push({ type: 'notify', message: `Unknown command: ${command.type}` });
    }

    if (next !== state) setState(next);
    for (const effect of pending) emit(effect);
    return next;
  }

  return { dispatch };
}
