// One byte builder for every parameter write. Editor knobs, expression
// pedals, scenes and tempo sync all use this so a SysEx-only control never
// gets a guessed CC from a static table.
import { buildRequestSysEx, COMMAND, FIELD } from '../core/messages.js';
import { buildParameterWrite } from '../core/parameterWrite.js';
import { BLOCK_BY_ID, FX2_SPECIAL_TYPES, SNAPSHOT_BLOCKS } from '../core/spec.js';
import { resolveFirmware, typesFor } from '../core/versions.js';

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function buildParameterWriteForTarget({ target, normalized, state, snapshot, channel = 1 }) {
  if (target?.kind !== 'param') return null;
  const blockId = target.block;
  const effectIndex = SNAPSHOT_BLOCKS.indexOf(blockId);
  if (effectIndex === -1) return null;

  const value = clamp01(normalized);
  const firmware = resolveFirmware(state);
  const current = snapshot?.blocks?.find((block) => block.id === blockId);
  const types = typesFor(blockId, firmware);
  const type = types.find((entry) => (entry.variant ?? entry.id) === current?.variant);
  const offset = BLOCK_BY_ID[blockId]?.commonParams?.length ?? 0;
  const param = type?.params[target.index - offset];

  const fx2 = snapshot?.blocks?.find((block) => block.id === 'fx2');
  const sharedCcConflict = blockId === 'mod' && fx2 && (
    firmware === '1.3.5' || FX2_SPECIAL_TYPES.includes(fx2.variant)
  );
  const ccBytes = sharedCcConflict ? null
    : buildParameterWrite({ param, normalized: value, channel: Number(channel) || 1 });
  if (ccBytes) return ccBytes;

  const sysexIndex = param?.sysexParamIndex ?? target.index;
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return buildRequestSysEx(COMMAND.SET_FIELD,
    [FIELD.PARAMETER, effectIndex, sysexIndex, ...new Uint8Array(view.buffer)]);
}
