<script>
  // Editor: device chain, one selected block's detail card and preset controls.
  // Chain reorder works with HTML5 drag (mouse) and a pointer fallback for
  // touch/pen; re-renders never cancel a gesture via lostpointercapture.
  import { onDestroy } from 'svelte';
  import { stateView, snapshotView, feedbackView, uiView, ctx as engineCtx } from '../engine.js';
  import Knob from './Knob.svelte';
  import PedalPopup from './PedalPopup.svelte';
  import { BLOCK_BY_ID, chainBlockIds } from '../../core/spec.js';
  import { typesFor, extraCommonParams } from '../../core/versions.js';
  import { ccToEnum, enumToCc } from '../../core/scaling.js';
  import { buildCc, buildRequestSysEx, COMMAND } from '../../core/messages.js';
  import { sceneStored } from '../../core/live.js';
  import { SUBDIVISIONS } from '../../core/tempo.js';

  export let ctx = engineCtx;

  let stripEl;
  let popupTarget = null;
  let sceneOffBlock = null;
  let nameDraft = '';
  let namePreset = null;

  let order = [];
  let lastChain = '';
  let pendingCommit = false;
  let drag = null;
  let dragId = null;
  let dragOver = null;
  let chainTouch = null;
  let suppressChainClick = false;

  $: state = $stateView ?? {};
  $: snapshot = $snapshotView ?? null;
  $: names = $uiView.names ?? {};
  $: globals = state.globals ?? {};
  $: preset = state.activePreset ?? 1;
  $: assignments = ($stateView, ctx.assignments);
  $: forgetCount = sceneOffBlock
    ? Object.values(assignments?.scenes ?? {}).reduce((sum, scene) =>
        sum + Object.keys(scene ?? {}).filter((key) => key.startsWith(`${sceneOffBlock}:`)).length, 0)
      + Object.keys(assignments?.base?.values ?? {}).filter((key) => key.startsWith(`${sceneOffBlock}:`)).length
    : 0;
  $: firmware = $uiView.firmware ?? ctx.firmware;
  $: chain = chainBlockIds(snapshot?.chainOrder);
  $: byId = Object.fromEntries((snapshot?.blocks ?? []).map((block) => [block.id, block]));
  $: selected = chain.includes(state.selectedBlock) ? state.selectedBlock : chain[0];
  $: live = byId[selected];
  $: block = selected ? BLOCK_BY_ID[selected] : null;
  $: versions = selected ? typesFor(selected, firmware) : [];
  $: type = versions.find((entry) => entry.id === live?.variant) ?? versions[0];
  $: assetNames = selected === 'amp' ? names.amp : selected === 'cab' ? names.ir : null;
  $: activeSlot = selected === 'amp' ? names.ampActive : selected === 'cab' ? names.irActive : null;
  $: selectedSlot = Number.isInteger(activeSlot) ? activeSlot : live?.variant;
  $: typeOptions = assetNames?.length
    ? assetNames.map((name, index) => ({ value: index, label: name }))
    : selected === 'amp' || selected === 'cab'
      ? [{ value: live?.variant ?? 0, label: 'Loading names from pedal…' }]
      : versions.map((entry) => ({ value: entry.id, label: entry.name }));
  $: params = block
    ? [...(block.commonParams ?? []), ...extraCommonParams(selected, firmware), ...(type?.params ?? [])]
    : [];
  $: timeParams = params.some((param) => param.label === 'Time' || param.label === 'Delay');
  $: sync = selected ? ($stateView, ctx.tempoSyncFor(selected)) : { enabled: false, subdivision: '1/8' };
  $: tempoSynced = Boolean(timeParams && sync.enabled);
  $: subdivisionIndex = Math.max(0, SUBDIVISIONS.findIndex((entry) => entry.id === sync.subdivision));
  $: visibleParams = params.map((param, index) => ({
    param,
    index,
    synced: tempoSynced && (param.label === 'Time' || param.label === 'Delay'),
  }));
  $: stompRaw = assignments?.blockStomps?.[selected];
  $: stompId = typeof stompRaw === 'string' ? stompRaw : stompRaw?.fs;
  $: sceneOn = selected ? ($stateView, ctx.sceneBlockEnabled(selected)) : false;
  $: scenes = ($stateView, ctx.sceneKeys().map((key) => ({
    key,
    name: ctx.sceneName(key),
    stored: sceneStored(assignments, key),
    detail: !sceneStored(assignments, key) ? 'empty — select, then Store'
      : key === 'base' ? (ctx.baseOverridden() ? 'saved values' : 'pedal values')
        : `${Object.keys(assignments?.scenes?.[key] ?? {}).length} values · ${Object.keys(assignments?.sceneEnabled?.[key] ?? {}).length} fx`,
  })));
  $: badges = ($stateView.globals?.expressionPedals ?? []).map((pedal) => {
    const entry = Object.entries(assignments?.paramPedals ?? {}).find(([, mapping]) => mapping?.pedal === pedal.id);
    const globalVolume = globals.volumePedal === pedal.id;
    const [block, index] = entry ? entry[0].split(':') : [null, null];
    const detail = index === 'tempo' ? 'tempo division' : `param ${Number(index) + 1}`;
    const target = entry
      ? `${BLOCK_BY_ID[block]?.name ?? block} · ${detail}`
      : globalVolume ? 'Preset volume · Globals' : 'free';
    return { id: pedal.id, target, assigned: Boolean(entry || globalVolume), globalVolume };
  });
  $: presetNumbers = ($stateView, [...new Set([...Array.from({ length: 64 }, (_, i) => i + 1), preset])].sort((a, b) => a - b));
  $: editedPresets = Object.keys(state.presets ?? {}).map(Number).sort((a, b) => a - b)
    .filter((number) => ctx.isPresetEdited(number));
  $: warning = block?.warning ?? type?.warning ?? null;

  $: if (preset !== namePreset) {
    namePreset = preset;
    nameDraft = assignments?.name ?? '';
  }
  $: chainKey = chain.join(',');
  $: if (chainKey !== lastChain) {
    lastChain = chainKey;
    if (!drag && !pendingCommit) order = [...chain];
  }

  function chainRowAt(x, y) {
    if (!stripEl) return null;
    const direct = document.elementFromPoint(x, y)?.closest?.('[data-chain-row]');
    if (direct && stripEl.contains(direct)) return direct;
    const bounds = stripEl.getBoundingClientRect();
    if (x < bounds.left - 24 || x > bounds.right + 24 || y < bounds.top - 24 || y > bounds.bottom + 24) return null;
    let nearest = null;
    let best = Infinity;
    for (const row of stripEl.querySelectorAll('[data-chain-row]')) {
      const rect = row.getBoundingClientRect();
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      const distance = dx * dx + dy * dy;
      if (distance < best) { best = distance; nearest = row; }
    }
    return nearest;
  }

  function beginChainDrag(id) {
    if (drag) return false;
    drag = { block: id, order: [...order], original: [...order] };
    dragId = id;
    return true;
  }

  function previewChainDrag(row, clientX) {
    if (!drag) return;
    dragOver = row?.dataset.block ?? null;
    if (!row || row.dataset.block === drag.block) return;
    const target = row.dataset.block;
    const next = drag.order.filter((id) => id !== drag.block);
    if (!next.includes(target)) return;
    const rect = row.getBoundingClientRect();
    const after = clientX > rect.left + rect.width / 2;
    next.splice(next.indexOf(target) + (after ? 1 : 0), 0, drag.block);
    if (next.join() === drag.order.join()) return;
    drag.order = next;
    order = next;
  }

  function endChainDrag(commit = false) {
    if (!drag) return;
    const current = drag.order;
    const changed = current.join() !== drag.original.join();
    if (commit && changed && snapshot) {
      suppressChainClick = true;
      setTimeout(() => { suppressChainClick = false; }, 0);
      ctx.setChainOrder([...current]);
      pendingCommit = true;
      setTimeout(() => { pendingCommit = false; order = [...chain]; }, 800);
    } else if (!changed) {
      order = [...drag.original];
    }
    drag = null;
    dragId = null;
    dragOver = null;
  }

  function onDragStart(event, id) {
    if (!beginChainDrag(id)) return;
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function onStripDragOver(event) {
    if (!drag) return;
    const row = event.target.closest?.('[data-chain-row]');
    if (!row) return;
    event.preventDefault();
    previewChainDrag(row, event.clientX);
  }

  function onStripDrop(event) {
    if (!drag) return;
    event.preventDefault();
    endChainDrag(true);
  }

  function onRowPointerDown(event) {
    if (event.pointerType === 'mouse') return;
    if (event.target.closest?.('input, select')) return;
    chainTouch = { id: event.pointerId, block: event.currentTarget.dataset.block, x: event.clientX, y: event.clientY, started: false };
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (error) { /* synthetic pointer */ }
    window.addEventListener('pointermove', onChainTouchMove);
    window.addEventListener('pointerup', onChainTouchUp);
    window.addEventListener('pointercancel', onChainTouchCancel);
  }

  function onChainTouchMove(event) {
    const move = chainTouch;
    if (!move || event.pointerId !== move.id) return;
    if (!move.started) {
      if (Math.hypot(event.clientX - move.x, event.clientY - move.y) < 10) return;
      if (!beginChainDrag(move.block)) return;
      move.started = true;
    }
    event.preventDefault();
    previewChainDrag(chainRowAt(event.clientX, event.clientY), event.clientX);
  }

  function detachChainTouch() {
    window.removeEventListener('pointermove', onChainTouchMove);
    window.removeEventListener('pointerup', onChainTouchUp);
    window.removeEventListener('pointercancel', onChainTouchCancel);
  }

  function onChainTouchUp(event) {
    const move = chainTouch;
    if (!move || event.pointerId !== move.id) return;
    chainTouch = null;
    detachChainTouch();
    if (move.started) endChainDrag(true);
  }

  function onChainTouchCancel(event) {
    const move = chainTouch;
    if (!move || event.pointerId !== move.id) return;
    chainTouch = null;
    detachChainTouch();
    if (move.started) endChainDrag(false);
  }

  function selectBlock(id) {
    if (suppressChainClick) { suppressChainClick = false; return; }
    ctx.selectBlock(id);
  }

  function changeName() { ctx.updatePreset(preset, { name: nameDraft }); }

  function changeType(event) {
    const select = event.currentTarget;
    const value = select.value;
    if (value === 'null') {
      ctx.notify('This effect type has no known ID yet — read-only until captured');
      return;
    }
    const id = Number(value);
    ctx.markEdited();
    if (block?.sysexTypeField) {
      ctx.send(buildRequestSysEx(COMMAND.SET_FIELD, [block.sysexTypeField, id]));
      ctx.setAssetName(selected === 'amp' ? 'amp' : 'ir', id, select.options[select.selectedIndex]?.textContent ?? `Slot ${id}`);
      setTimeout(ctx.readSnapshot, 350);
    } else {
      ctx.send(buildCc(globals.midiChannel ?? 1, block.typeCc, id));
      setTimeout(ctx.readSnapshot, 250);
    }
  }

  function changeEnabled(event) {
    const on = event.currentTarget.checked;
    ctx.send(buildCc(globals.midiChannel ?? 1, block.onOffCc, on ? 127 : 0));
    ctx.noteEnabled(selected, on);
    ctx.markEdited();
    ctx.render();
    setTimeout(ctx.readSnapshot, 250);
  }

  function onRangeInput(index, param, raw) {
    if (param.cc == null) ctx.setParameter(selected, index, raw / 127);
    else ctx.send(buildCc(globals.midiChannel ?? 1, param.cc, raw));
    const min = Number(param.min) || 0;
    const span = (Number(param.max) || 0) - min;
    ctx.markEdited();
    if (span > 0) ctx.noteParameter(selected, index, ((min + (raw / 127) * span) - min) / span);
    ctx.render();
  }

  function onEnumChange(index, param, selection) {
    const options = param.options ?? [];
    const normalized = options.length > 1 ? selection / (options.length - 1) : 0;
    if (param.cc == null) {
      ctx.setParameter(selected, index, normalized);
    } else {
      ctx.send(buildCc(globals.midiChannel ?? 1, param.cc, enumToCc(selection, options)));
      ctx.noteParameter(selected, index, normalized);
    }
    ctx.markEdited();
    ctx.render();
  }

  function setSubdivision(index) {
    const option = SUBDIVISIONS[index];
    if (option) ctx.setTempoSync(selected, { subdivision: option.id });
  }

  function openPopup(index, param, tempo = false) {
    popupTarget = { block: selected, paramIndex: index, label: param.label, cc: param.cc ?? null, tempo };
  }

  function requestSceneBlock(event) {
    if (event.currentTarget.checked) {
      ctx.setSceneBlock(selected, true);
      return;
    }
    event.currentTarget.checked = true;
    sceneOffBlock = selected;
  }

  function confirmSceneBlockOff() {
    const block = sceneOffBlock;
    sceneOffBlock = null;
    if (block) ctx.setSceneBlock(block, false, { forgetValues: true });
  }

  onDestroy(() => detachChainTouch());
</script>

<div class="flex min-h-0 min-w-0 flex-1 flex-col [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-line">
<div class="flex items-start gap-4 max-[640px]:flex-col">
  <aside class="w-60 flex-none overflow-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-line max-[900px]:w-auto max-[640px]:w-auto">
    <div class="card mb-3 border border-base-300 bg-base-200 p-3.5">
      <h2 class="m-0 mb-3 text-lg">NANOCORE</h2>
      <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-base-content/60">Preset volume</h3>
      <input id="preset-volume" class="w-full range range-primary" type="range" min="0" max="100"
        value={snapshot?.volume ?? 60} aria-label="Preset volume"
        on:change={(event) => ctx.setVolume(Number(event.currentTarget.value))}>
      <div class="text-base-content/60 text-xs">{snapshot?.volume ?? '—'} / 100</div>
      <div class="mb-2.5 flex items-center gap-2">
        <button class="btn btn-sm" on:click={() => ctx.recallPreset(Math.max(1, Math.min(64, preset - 1)))} aria-label="Previous preset">◀</button>
        <button class="btn btn-sm" on:click={() => ctx.recallPreset(preset)}>Recall preset</button>
        <button class="btn btn-sm" on:click={() => ctx.recallPreset(Math.max(1, Math.min(64, preset + 1)))} aria-label="Next preset">▶</button>
      </div>
      <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-base-content/60">Edited presets</h3>
      <div class="flex flex-wrap items-center gap-1">
        {#each editedPresets as number (number)}
          <button class="cursor-pointer rounded-full border border-base-300 bg-neutral px-2 py-0.5 text-[11px] font-[inherit] text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={() => ctx.recallPreset(number)}>
            {ctx.presetLabel(number)} · {number}
          </button>
        {:else}
          <p class="text-base-content/60 text-xs">No presets edited in this editor yet.</p>
        {/each}
      </div>
      <p class="text-base-content/60 text-xs">Names come from the pedal. MIDI bindings stay in this browser.</p>
    </div>
  </aside>

  <section class="min-w-0 flex-1">
    <h2 class="m-0 mb-3 text-lg">Editor <span class="text-base-content/60 text-xs">— NANOCORE preset {preset}</span></h2>
    <div class="card mb-3 border border-base-300 bg-base-200 p-3.5 flex flex-wrap justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-semibold">Preset {preset}</span>
        <input data-editor="preset-name" class="input input-bordered input-sm" aria-label="Preset name" placeholder="Preset name (max 8 characters)"
          bind:value={nameDraft} on:change={changeName}>
        <label class="text-xs text-base-content/60" for="editor-preset">NANOCORE preset</label>
        <select id="editor-preset" class="select select-bordered select-sm" value={preset} on:change={(event) => ctx.recallPreset(Number(event.currentTarget.value))}>
          {#each presetNumbers as number (number)}
            <option value={number} selected={number === preset}>{number} · {ctx.presetLabel(number)}</option>
          {/each}
        </select>
        <div class="ml-auto">
          <button data-action="save-preset-name" class="btn btn-ghost btn-sm" title="Write this name to the NANOCORE and save the preset"
            on:click={() => ctx.renamePresetOnDevice(nameDraft)}>Save name to pedal</button>
          <button id="editor-read" class="btn btn-sm" on:click={() => ctx.readSnapshot()}>Read snapshot</button>
          <button id="save-preset" class="btn btn-primary btn-sm" title="Write live RAM permanently into this NANOCORE preset"
            on:click={() => ctx.savePreset()}>Save to pedal</button>
        </div>
      </div>
    </div>

{#if !snapshot}
  <div class="card mb-3 border border-base-300 bg-base-200 p-3.5">
    <p class="text-base-content/60">Connect to the NANOCORE and press <b>Read snapshot</b>.</p>
    <p class="text-xs">If recall works but parameters stay blank, open <b>MIDI devices</b> and mark one input as "NANOCORE replies", then read again.</p>
  </div>
{:else}
  <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-base-content/60">Effect chain <span class="text-base-content/60 text-xs">— click to edit · long drag to reorder</span></h3>
  <div class="mb-3 flex flex-wrap items-stretch gap-1" bind:this={stripEl} on:dragover={onStripDragOver} on:drop={onStripDrop} role="list" aria-label="Effect chain">
    {#each order as id, position (id)}
      {#if position}<span class="self-center text-base-content/60" aria-hidden="true">→</span>{/if}
      {@const item = byId[id]}
      {@const definition = BLOCK_BY_ID[id]}
      {#if definition && item}
        {@const versionsForBlock = typesFor(id, firmware)}
        {@const effectType = versionsForBlock.find((entry) => entry.id === item.variant) ?? versionsForBlock[0]}
        {@const slot = id === 'amp' ? (Number.isInteger(names.ampActive) ? names.ampActive : item.variant)
          : id === 'cab' ? (Number.isInteger(names.irActive) ? names.irActive : item.variant) : item.variant}
        {@const assetName = id === 'amp' ? names.amp?.[slot] : id === 'cab' ? names.ir?.[slot] : null}
        {@const fs = typeof assignments?.blockStomps?.[id] === 'string'
          ? assignments.blockStomps[id] : assignments?.blockStomps?.[id]?.fs}
          <div class="indicator">
            {#if fs}
              <span class="indicator-item top-[20%] right-[5%] badge badge-secondary">{fs}</span>
            {/if}
            <button class="flex min-w-[128px] touch-pan-y flex-col gap-[3px] rounded-box border border-base-300 bg-base-200 p-2.5 cursor-pointer font-[inherit] text-inherit text-left hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 {id === selected ? 'border-accent ring-2 ring-accent' : ''} {dragId === id ? 'scale-[0.96] opacity-50' : ''} {dragOver === id ? 'border-secondary ring-[3px] ring-[#64d2a433]' : ''}"
            data-chain-row
            data-block={id}
            draggable="true"
            title="Click to edit · drag to reorder"
            on:click={() => selectBlock(id)}
            on:dragstart={(event) => onDragStart(event, id)}
            on:dragend={() => endChainDrag(false)}
            on:pointerdown={onRowPointerDown}
          >
            <span class="font-extrabold">{definition.name}</span>
            <span class="text-[11px] text-base-content/60">{assetName || effectType?.shortName || effectType?.name || (id === 'amp' || id === 'cab' ? 'loading…' : '—')}</span>

            <div >
              <input type="checkbox" class="hidden" id="fx-switch" on:change={changeEnabled}>
              <label for="fx-switch">
                <div class="btn btn-outline button-neutral btn-square btn-sm { item.enabled==true ? 'btn-accent' : '' } ">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                  </svg>
                </div>
              </label>
            </div>
        </button>
      </div>
      {/if}
    {/each}
  </div>

  <div class="card mb-3 border border-base-300 bg-base-200 p-3.5">
    {#if block && live}
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <h2 style="margin:0" class="m-0 mb-3 text-lg">{block.name}</h2>
          <label class="label text-sm text-base-content/60 flex items-center">
            ON/OFF 
            <input type="checkbox" class="toggle toggle-sm" checked={Boolean(live.enabled)} on:change={changeEnabled}>
          </label>
        </div>
        <select aria-label={`${block.name} type`} class="select select-bordered select-sm" value={selectedSlot}
          on:change={changeType}>
          {#if !assetNames?.length && (selected === 'amp' || selected === 'cab')}
            <option value={live.variant}>Loading names from pedal…</option>
          {:else}
            {#each typeOptions as option (option.value)}
              <option value={option.value} selected={option.value === selectedSlot}>{option.label}</option>
            {/each}
          {/if}
        </select>
        <div class="flex items-center">
          <div class="join border h-fit">
          <div class="btn btn-xs btn-disabled">Stomp</div>
            {#each globals.footswitches ?? [] as fs (fs.id)}
              <input type="radio" class="join-item btn btn-soft btn-xs" name="options" checked={stompId === fs.id} aria-label={fs.id} on:click={() => ctx.setBlockStomp(preset, selected, fs.id)}>
            {/each}
            <input type="radio" class="join-item btn btn-soft btn-xs" name="options" aria-label="None" checked={!stompId} on:click={() => ctx.setBlockStomp(preset, selected, null)}>
          </div>
          <label class="label text-sm text-base-content/60 min-w-[90px]">
            Scene
            <input type="checkbox" class="toggle toggle-sm toggle-primary" checked={sceneOn} on:change={requestSceneBlock}>
          </label>
        </div>
      </div>
      {#if warning}<div class="border-accent text-accent">{warning}</div>{/if}

      {#if timeParams}
        <div class="mb-2.5 flex flex-wrap items-center gap-2">
          <label class="text-xs text-base-content/60 min-w-[90px]">
            <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" checked={sync.enabled} on:change={(event) => ctx.setTempoSync(selected, { enabled: event.currentTarget.checked })}>
            <span></span> Sync with tempo
          </label>
          <span class="text-base-content/60 text-xs">Turns the time knob into a subdivision selector. {globals.tempo?.bpm ? '' : 'Tap a tempo in the top bar first.'}</span>
        </div>
      {/if}
      {#if tempoSynced}
        <p class="mb-2.5 text-xs text-base-content/60">{ctx.tempoSubdivisionMs(selected)} ms · {globals.tempo?.bpm ?? '—'} BPM · {globals.tempo?.signature ?? '4/4'}</p>
      {/if}

      {#if sceneOn}
        <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-base-content/60">Scenes <span class="text-base-content/60 text-xs">— store the current parameter values, recall instantly</span></h3>
        <div class="my-2 flex flex-wrap gap-2">
          {#each scenes as scene (scene.key)}
            <button class="flex min-w-[120px] flex-col gap-1 rounded-box border border-base-300 bg-neutral p-2.5 cursor-pointer font-[inherit] text-inherit text-left hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 {state.activeScene === scene.key ? 'border-accent bg-accent/10' : ''}"
              on:click={() => ctx.selectScene(scene.key)}>
              <b>{scene.name}</b><span class="text-base-content/60 text-xs">{scene.detail}</span>
            </button>
          {/each}
          <button class="flex min-w-[120px] flex-col gap-1 rounded-box border border-base-300 bg-neutral p-2.5 cursor-pointer font-[inherit] text-inherit text-left hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={() => ctx.storeScene(state.activeScene)}>
            <b>Store to {state.activeScene === 'base' ? 'Base' : `Scene ${String(state.activeScene).slice(-1)}`}</b>
            <span class="text-base-content/60 text-xs">save current values here</span>
          </button>
        </div>
        <div class="mb-2.5 flex flex-wrap items-center gap-1">
          {#each scenes.filter((scene) => scene.key !== 'base') as scene (scene.key)}
            <label for={`scene-rename-${scene.key}`} class="text-xs text-base-content/60 min-w-[90px]">{scene.name}</label>
            <input id={`scene-rename-${scene.key}`} class="input input-bordered input-sm" data-scene-rename={scene.key} value={scene.name}
              aria-label={`Rename ${scene.name}`}
              on:change={(event) => ctx.renameScene(scene.key, event.currentTarget.value)}>
          {/each}
        </div>
      {/if}

      <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-base-content/60">Parameters <span class="text-base-content/60 text-xs">— right-click a parameter to assign an expression pedal</span></h3>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))]  gap-4">
        {#each visibleParams as entry (entry.index)}
          {@const normalized = live.params?.[entry.index] ?? 0}
          {@const mapping = assignments?.paramPedals?.[`${selected}:${entry.synced ? 'tempo' : entry.index}`]}
          {@const options = entry.param.options ?? []}
          {@const enumIndex = ccToEnum(Math.round(normalized * 127), options)}
          {@const actual = (Number(entry.param.min) || 0) + normalized * ((Number(entry.param.max) || 0) - (Number(entry.param.min) || 0))}
          <div class="cursor-context-menu flex justify-center rounded-box p-2.5  {mapping ? 'border-accent' : ''}" data-param-block={selected} data-param-index={entry.index}
            data-param-cc={entry.param.cc ?? 'null'} data-param-label={entry.param.label}
            role="group" aria-label={`Assign expression pedal to ${entry.param.label}`}
            title="Right-click to assign an expression pedal"
            on:contextmenu|preventDefault={() => openPopup(entry.index, entry.param, entry.synced)}>
            {#if mapping}
              <div class="mb-1">
                <span class="rounded-full border border-accent px-2 py-0.5 text-[11px]">{mapping.pedal} · {mapping.inputMin ?? 0}–{mapping.inputMax ?? 127}{mapping.invert ? ' · inv' : ''}</span>
              </div>
            {/if}
            {#if entry.synced}
              <Knob
                id={`tempo-${selected}-${entry.index}`}
                value={subdivisionIndex}
                max={SUBDIVISIONS.length - 1}
                label={entry.param.label}
                stepLabels={SUBDIVISIONS.map((entry) => entry.id)}
                display={sync.subdivision}
                on:input={(event) => setSubdivision(event.detail)}
              />
            {:else if entry.param.kind === 'enum'}
              <Knob
                id={`param-${selected}-${entry.index}`}
                value={enumIndex}
                max={Math.max(1, options.length - 1)}
                label={entry.param.label}
                display={options[enumIndex] ?? ''}
                stepLabels={options}
                on:change={(event) => onEnumChange(entry.index, entry.param, event.detail)}
              />
            {:else}
              <Knob
                id={`param-${selected}-${entry.index}`}
                value={Math.round(normalized * 127)}
                max={127}
                label={entry.param.label}
                display={`${actual.toFixed(entry.param.decimals ?? 2)}${entry.param.unit ? ' ' + entry.param.unit : ''}`}
                on:input={(event) => onRangeInput(entry.index, entry.param, event.detail)}
              />
            {/if}
          </div>
        {:else}
          <p class="text-base-content/60 text-xs">No MIDI-controllable parameters for this type.</p>
        {/each}
      </div>
      <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-base-content/60">Expression mapping <span class="text-base-content/60 text-xs">— assign by right-clicking a knob</span></h3>
      <div class="my-2 flex flex-wrap gap-2">
        {#each badges as badge (badge.id)}
          <span class="badge badge-outline badge-sm text-base-content/60 {badge.assigned ? 'border-accent text-base-content' : ''}"
            title={badge.globalVolume ? 'Assigned to preset volume in Globals — clear it there to free this pedal' : undefined}>
            <b>{badge.id}</b> {badge.target}
          </span>
        {/each}
      </div>
      {#if block.note}<p class="text-base-content/60 text-xs">{block.note}</p>{/if}
    {:else}
      <p class="text-base-content/60">Select a block.</p>
    {/if}
  </div>

{/if}

{#if popupTarget}
  <PedalPopup target={popupTarget} onClose={() => { popupTarget = null; }} />
{/if}

{#if sceneOffBlock}
  <div class="modal modal-open z-[90]" role="presentation">
    <button class="modal-backdrop" aria-label="Cancel" on:click={() => { sceneOffBlock = null; }}></button>
    <div class="modal-box w-[min(440px,94vw)] max-w-none" role="dialog" aria-modal="true" aria-label="Forget scene values">
      <h2 class="m-0 mb-3 text-lg">Remove {BLOCK_BY_ID[sceneOffBlock]?.name ?? sceneOffBlock} from scenes?</h2>
      <p class="text-base-content/60 text-xs">
        This forgets {forgetCount} saved {forgetCount === 1 ? 'value' : 'values'} for this block in this preset's scenes and base snapshot. Turning participation back on will not restore them.
      </p>
      <div class="mt-4 flex justify-end gap-2">
        <button class="btn" on:click={() => { sceneOffBlock = null; }}>Cancel</button>
        <button class="btn btn-error" on:click={confirmSceneBlockOff}>Forget values</button>
      </div>
    </div>
  </div>
{/if}
  </section>
</div>
</div>


