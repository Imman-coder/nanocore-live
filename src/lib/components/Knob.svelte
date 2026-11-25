<script>
  // Rotary knob: a hidden range input is the single source of truth. Pointer
  // drags and arrow keys move it; input/change are emitted to the parent with
  // the numeric value as `event.detail`.
  import { createEventDispatcher } from 'svelte';

  export let id = 'knob';
  export let value = 0;
  export let max = 127;
  export let label = '';
  export let display = '';
  export let stepLabels = null;
  export let labels = null;
  export let stepLabel = null;

  const dispatch = createEventDispatcher();
  let drag = null;

  $: ceiling = Math.max(1, Number(max) || 1);
  $: current = Math.max(0, Math.min(ceiling, Number(value) || 0));
  $: detents = Array.isArray(stepLabels) ? stepLabels
    : Array.isArray(labels) ? labels
      : typeof stepLabel === 'string' && stepLabel ? stepLabel.split('|') : null;
  $: angle = -135 + (current / ceiling) * 270;
  $: shown = detents && detents.length
    ? (detents[Math.round(current)] ?? String(Math.round(current)))
    : display;

  function emit(kind, next) {
    const clamped = Math.max(0, Math.min(ceiling, Math.round(Number(next) || 0)));
    value = clamped;
    dispatch(kind, clamped);
  }

  function onInput(event) { emit('input', event.currentTarget.value); }
  function onChange(event) { emit('change', event.currentTarget.value); }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    drag = { id: event.pointerId, y: event.clientY, start: current };
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (error) { /* synthetic pointer */ }
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault();
    // Stepped knobs need a slower drag so each detent is easy to hit.
    const divisor = ceiling <= 10 ? 14 : 4;
    emit('input', drag.start + (drag.y - event.clientY) / divisor);
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    emit('change', current);
    drag = null;
  }

  function onKeyDown(event) {
    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1;
    emit('input', current + direction);
  }
</script>

<div class="knob-wrap">
  <div
    class="knob"
    role="slider"
    tabindex="0"
    aria-label={label}
    aria-valuemin="0"
    aria-valuemax={ceiling}
    aria-valuenow={current}
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:pointercancel={onPointerUp}
    on:keydown={onKeyDown}
  >
    <div class="knob-dial" style="--angle: {angle}deg"><i class="knob-pointer"></i></div>
  </div>
  <div class="knob-meta"><label for={id}>{label}</label><span class="value">{shown}</span></div>
  <input
    {id}
    class="knob-input"
    type="range"
    min="0"
    max={ceiling}
    value={current}
    tabindex="-1"
    aria-hidden="true"
    on:input={onInput}
    on:change={onChange}
  >
</div>

<style>
  .knob-wrap { position: relative; display: inline-flex; flex-direction: column; align-items: center; }
  .knob { cursor: ns-resize; touch-action: none; }
  .knob-dial { transform: rotate(var(--angle)); }
  .knob-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
