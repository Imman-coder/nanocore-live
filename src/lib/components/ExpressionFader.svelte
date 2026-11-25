<script>
  // Expression fader. Relative sliding is the default: a gesture starts at the
  // value currently on the device and adds pointer travel. Globals can opt into
  // absolute position mapping. Always interactive, even when unassigned.
  import { afterUpdate, onDestroy, onMount } from 'svelte';
  import { app, ctx as engineCtx } from '../engine.js';
  import { BLOCK_BY_ID } from '../../core/spec.js';
  import { expressionRawToPercent, expressionRawFromRelative } from '../../core/live.js';

  export let pedal;
  export let ctx = engineCtx;

  let rootEl;
  let meterEl;
  let vertical = false;
  let drag = null;

  const seeded = ctx.expressionInitialValue(pedal?.id);
  let raw = Number.isFinite(seeded) ? seeded : 0;
  let seedSnapshot = $app.snapshot;
  let seedPreset = $app.state?.activePreset;
  let lastFeedback = $app.expressionValues?.[pedal?.id];

  function seedValue() {
    const value = ctx.expressionInitialValue(pedal?.id);
    raw = Number.isFinite(value) ? value : 0;
  }

  $: snapshotNow = $app.snapshot;
  $: presetNow = $app.state?.activePreset;
  $: if (!drag && (snapshotNow !== seedSnapshot || presetNow !== seedPreset)) {
    seedSnapshot = snapshotNow;
    seedPreset = presetNow;
    seedValue();
    lastFeedback = $app.expressionValues?.[pedal?.id];
  }

  $: percent = expressionRawToPercent(raw);
  $: mappings = ($app.state, ctx.assignments?.expressions ?? []);
  $: mapping = mappings.find((entry) => entry.id === pedal?.id) ?? null;
  $: isVolume = $app.state?.globals?.volumePedal === pedal?.id;
  $: assigned = Boolean(mapping || isVolume);
  $: targetLabel = mapping
    ? `${BLOCK_BY_ID[mapping.target]?.name ?? mapping.target} param ${mapping.paramIndex ?? 0}`
    : isVolume ? 'Preset volume' : 'unassigned';
  $: feedback = $app.expressionValues?.[pedal?.id];
  // Hardware feedback wins outside a gesture; inside one the local value stays
  // authoritative so a device snapshot cannot make the fader jump mid-drag.
  $: if (!drag && Number.isFinite(feedback) && feedback !== lastFeedback) {
    lastFeedback = feedback;
    raw = Math.max(0, Math.min(127, Math.round(feedback)));
  }

  function measure() {
    if (!rootEl) return;
    const rect = rootEl.getBoundingClientRect();
    const next = rect.height > rect.width + 8;
    if (next !== vertical) vertical = next;
  }

  onMount(() => {
    measure();
    window.addEventListener('resize', measure);
  });
  onDestroy(() => {
    window.removeEventListener('resize', measure);
    endDrag();
  });
  afterUpdate(() => requestAnimationFrame(measure));

  function setRaw(value) {
    const next = Math.max(0, Math.min(127, Math.round(Number(value) || 0)));
    raw = next;
    lastFeedback = next;
    ctx.sendExpression(pedal.id, next);
  }

  function setFromPointer(clientX, clientY) {
    // Re-read the live node: a snapshot reply can re-render the grid mid-drag.
    const rect = meterEl?.getBoundingClientRect();
    if (!rect) return;
    if (vertical && !rect.height) return;
    if (!vertical && !rect.width) return;
    const value = vertical
      ? ((rect.bottom - clientY) / rect.height) * 127
      : ((clientX - rect.left) / rect.width) * 127;
    setRaw(value);
  }

  function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, value: raw, vertical };
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (error) { /* synthetic pointer */ }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    if ($app.state?.globals?.absoluteExpression) setFromPointer(event.clientX, event.clientY);
  }

  function onMove(event) {
    if (!drag) return;
    event.preventDefault();
    if ($app.state?.globals?.absoluteExpression) {
      setFromPointer(event.clientX, event.clientY);
      return;
    }
    const rect = meterEl?.getBoundingClientRect();
    const useVertical = drag.vertical || vertical;
    const span = useVertical ? rect?.height : rect?.width;
    const delta = useVertical ? drag.y - event.clientY : event.clientX - drag.x;
    setRaw(expressionRawFromRelative(drag.value, delta, span || 200));
  }

  function endDrag() {
    drag = null;
    lastFeedback = $app.expressionValues?.[pedal?.id];
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  }

  function onKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -5 : 5;
    setRaw(raw + step);
  }
</script>

<div
  class="flex h-full min-h-0 w-full flex-col"
  bind:this={rootEl}
>
  <div class="font-bold">{pedal?.name ?? pedal?.id}</div>
  <div class="overflow-hidden text-ellipsis text-[11px] text-muted">{ctx.describeTrigger(pedal?.trigger)} → {targetLabel}</div>
  <div
    class="relative block min-h-6 flex-1 cursor-ew-resize touch-none overflow-hidden rounded-md bg-[#0f1319] bg-gradient-to-r from-accent-2 to-accent {vertical ? '!mx-auto !my-0.5 !h-auto !w-6' : 'h-full w-full'} {pedal?.fullTouch ? '!min-h-11' : ''}"
    bind:this={meterEl}
    id={`expr-meter-${pedal?.id}`}
    data-expression-meter={pedal?.id}
    data-orientation={vertical ? 'vertical' : 'horizontal'}
    role="slider"
    tabindex="0"
    aria-label={`${pedal?.name ?? pedal?.id} level`}
    aria-valuemin="0"
    aria-valuemax="127"
    aria-valuenow={raw}
    on:pointerdown={startDrag}
    on:keydown={onKey}
  >
    <i id={`expr-meter-fill-${pedal?.id}`}
      class="absolute bottom-0 left-0 bg-current opacity-60 {vertical ? 'w-full' : ''}"
      style={vertical ? `height: ${percent}%; width: 100%` : `width: ${percent}%`}></i>
  </div>
  <div class="overflow-hidden text-ellipsis text-[11px] text-muted" id={`expr-value-${pedal?.id}`}>{percent}%</div>
</div>


