// Canonical binding targets. Persisted state still uses compact keys such as
// "fx1:0" / "del:tempo"; everything else in the engine speaks explicit targets.

export function targetKey(target) {
  if (!target) return '';
  if (target.kind === 'volume') return 'volume';
  if (target.kind === 'tempo') return `${target.block}:tempo`;
  if (target.kind === 'param') return `${target.block}:${target.index}`;
  return '';
}

export function parseTargetKey(key) {
  const [block, index] = String(key ?? '').split(':');
  if (!block) return null;
  if (index === 'tempo') return { kind: 'tempo', block };
  const parsed = Number(index);
  if (!Number.isInteger(parsed)) return null;
  return { kind: 'param', block, index: parsed };
}

export function targetFromBinding(binding) {
  if (!binding) return null;
  if (binding.volume || binding.kind === 'volume') return { kind: 'volume' };
  if (binding.target && typeof binding.target === 'object' && binding.target.kind) {
    return binding.target;
  }
  if (binding.tempo || binding.kind === 'tempo') {
    const block = typeof binding.target === 'object' ? binding.target.block : binding.target;
    if (!block) return null;
    return { kind: 'tempo', block };
  }
  const block = typeof binding.target === 'object' ? binding.target.block : binding.target;
  if (!block) return null;
  return { kind: 'param', block, index: Number(binding.paramIndex ?? 0) || 0 };
}

export const paramTarget = (block, index) => ({ kind: 'param', block, index: Number(index) || 0 });
export const tempoTarget = (block) => ({ kind: 'tempo', block });
export const volumeTarget = () => ({ kind: 'volume' });
