<script>
  // Editor: device chain, one selected block's detail card and preset controls.
  // Chain reorder works with HTML5 drag (mouse) and a pointer fallback for
  // touch/pen; re-renders never cancel a gesture via lostpointercapture.
  import { onDestroy } from 'svelte';
  import { app, ctx as engineCtx } from '../engine.js';
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

  $: state = $app.state ?? {};
  $: snapshot = $app.snapshot ?? null;
  $: names = $app.names ?? {};
  $: globals = state.globals ?? {};
  $: preset = state.activePreset ?? 1;
  $: assignments = ($app.state, ctx.assignments);
  $: firmware = $app.firmware ?? ctx.firmware;
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
  $: sync = selected ? ($app.state, ctx.tempoSyncFor(selected)) : { enabled: false, subdivision: '1/8' };
  $: tempoSynced = Boolean(timeParams && sync.enabled);
  $: visibleParams = params.map((param, index) => ({ param, index }))
    .filter(({ param }) => !(tempoSynced && (param.label === 'Time' || param.label === 'Delay')));
  $: stompRaw = assignments?.blockStomps?.[selected];
  $: stompId = typeof stompRaw === 'string' ? stompRaw : stompRaw?.fs;
  $: sceneOn = selected ? ($app.state, ctx.sceneBlockEnabled(selected)) : false;
  $: scenes = ($app.state, ctx.sceneKeys().map((key) => ({
    key,
    name: ctx.sceneName(key),
    stored: sceneStored(assignments, key),
    detail: !sceneStored(assignments, key) ? 'empty — select, then Store'
      : key === 'base' ? (ctx.baseOverridden() ? 'saved values' : 'pedal values')
        : `${Object.keys(assignments?.scenes?.[key] ?? {}).length} values · ${Object.keys(assignments?.sceneEnabled?.[key] ?? {}).length} fx`,
  })));
  $: badges = ($app.state.globals?.expressionPedals ?? []).map((pedal) => {
    const entry = Object.entries(assignments?.paramPedals ?? {}).find(([, mapping]) => mapping?.pedal === pedal.id);
    const globalVolume = globals.volumePedal === pedal.id;
    const target = entry
      ? `${BLOCK_BY_ID[entry[0].split(':')[0]]?.name ?? entry[0].split(':')[0]} · ${Number(entry[0].split(':')[1]) + 1}`
      : globalVolume ? 'Preset volume · Globals' : 'free';
    return { id: pedal.id, target, assigned: Boolean(entry || globalVolume), globalVolume };
  });
  $: presetNumbers = ($app.state, [...new Set([...Array.from({ length: 64 }, (_, i) => i + 1), preset])].sort((a, b) => a - b));
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

  function openPopup(index, param) {
    popupTarget = { block: selected, paramIndex: index, label: param.label, cc: param.cc ?? null };
  }

  onDestroy(() => detachChainTouch());
</script>

<div class="content">
<div class="editor-layout">
  <aside class="sidebar editor-sidebar">
    <div class="card">
      <h2>NANOCORE</h2>
      <h3>Preset volume</h3>
      <input id="preset-volume" class="preset-volume" type="range" min="0" max="100"
        value={snapshot?.volume ?? 60} aria-label="Preset volume"
        on:change={(event) => ctx.setVolume(Number(event.currentTarget.value))}>
      <div class="muted small">{snapshot?.volume ?? '—'} / 100</div>
      <div class="row-actions">
        <button on:click={() => ctx.recallPreset(Math.max(1, Math.min(64, preset - 1)))} aria-label="Previous preset">◀</button>
        <button on:click={() => ctx.recallPreset(preset)}>Recall preset</button>
        <button on:click={() => ctx.recallPreset(Math.max(1, Math.min(64, preset + 1)))} aria-label="Next preset">▶</button>
      </div>
      <h3>Edited presets</h3>
      <div class="edited-presets">
        {#each editedPresets as number (number)}
          <button class="pill" class:selected={number === preset} on:click={() => ctx.recallPreset(number)}>
            {ctx.presetLabel(number)} · {number}
          </button>
        {:else}
          <p class="muted small">No presets edited in this editor yet.</p>
        {/each}
      </div>
      <p class="muted small">Names come from the pedal. MIDI bindings stay in this browser.</p>
    </div>
  </aside>

  <section class="editor-main">
    <h2>Editor <span class="muted small">— NANOCORE preset {preset}</span></h2>
    <div class="card editor-header">
      <div class="card-head">
        <span class="name">Preset {preset}</span>
        <input data-editor="preset-name" aria-label="Preset name" placeholder="Preset name (max 8 characters)"
          bind:value={nameDraft} on:change={changeName}>
        <label class="small" for="editor-preset">NANOCORE preset</label>
        <select id="editor-preset" value={preset} on:change={(event) => ctx.recallPreset(Number(event.currentTarget.value))}>
          {#each presetNumbers as number (number)}
            <option value={number} selected={number === preset}>{number} · {ctx.presetLabel(number)}</option>
          {/each}
        </select>
        <button data-action="save-preset-name" class="ghost" title="Write this name to the NANOCORE and save the preset"
          on:click={() => ctx.renamePresetOnDevice(nameDraft)}>Save name to pedal</button>
        <button id="editor-read" on:click={() => ctx.readSnapshot()}>Read snapshot</button>
        <button id="save-preset" class="primary" title="Write live RAM permanently into this NANOCORE preset"
          on:click={() => ctx.savePreset()}>Save to pedal</button>
      </div>
      <div class="muted small">
        {#if snapshot}
          {$app.demo ? 'Demo snapshot' : 'Loaded from the pedal'}: preset {snapshot.activePreset + 1}, volume {snapshot.volume}
        {:else}
          Connect and read the snapshot to edit the current preset.
        {/if}
      </div>
    </div>

{#if !snapshot}
  <div class="card">
    <p class="muted">Connect to the NANOCORE and press <b>Read snapshot</b>.</p>
    <p class="small">If recall works but parameters stay blank, open <b>MIDI devices</b> and mark one input as "NANOCORE replies", then read again.</p>
  </div>
{:else}
  <h3>Effect chain <span class="muted small">— click to edit · long drag to reorder</span></h3>
  <div class="chain-strip" bind:this={stripEl} on:dragover={onStripDragOver} on:drop={onStripDrop} role="list" aria-label="Effect chain">
    {#each order as id, position (id)}
      {#if position}<span class="chain-arrow" aria-hidden="true">→</span>{/if}
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
        <button
          class="chain-row"
          class:selected={id === selected}
          class:dragging={dragId === id}
          class:drag-over={dragOver === id}
          data-chain-row
          data-block={id}
          draggable="true"
          title="Click to edit · drag to reorder"
          on:click={() => selectBlock(id)}
          on:dragstart={(event) => onDragStart(event, id)}
          on:dragend={() => endChainDrag(false)}
          on:pointerdown={onRowPointerDown}
        >
          <span class="chain-pos">{position + 1}</span>
          <span class="chain-name">{definition.name}</span>
          <span class="chain-type">{assetName || effectType?.name || (id === 'amp' || id === 'cab' ? 'loading…' : '—')}</span>
          <span class="chain-state">{item.enabled ? 'ON' : 'off'}</span>
          <span class="pill">{fs ?? 'no stomp'}</span>
        </button>
      {/if}
    {/each}
  </div>

  <div class="detail-card card">
    {#if block && live}
      <div class="detail-head">
        <h2 style="margin:0">{block.name}</h2>
        <select aria-label={`${block.name} type`} value={selectedSlot}
          on:change={changeType}>
          {#if !assetNames?.length && (selected === 'amp' || selected === 'cab')}
            <option value={live.variant}>Loading names from pedal…</option>
          {:else}
            {#each typeOptions as option (option.value)}
              <option value={option.value} selected={option.value === selectedSlot}>{option.label}</option>
            {/each}
          {/if}
        </select>
        <label class="switch">
          <input type="checkbox" checked={Boolean(live.enabled)} on:change={changeEnabled}>
          <span class="slider"></span> {live.enabled ? 'On' : 'Off'}
        </label>
      </div>
      {#if warning}<div class="warning">{warning}</div>{/if}

      <div class="field">
        <label class="switch">
          <input type="checkbox" checked={sceneOn} on:change={(event) => ctx.setSceneBlock(selected, event.currentTarget.checked)}>
          <span class="slider"></span> Participate in scenes
        </label>
        <span class="muted small">Off hides the scenes here and leaves this block out of scene saves and recalls; previously saved values are kept.</span>
      </div>

      {#if timeParams}
        <div class="field">
          <label class="switch">
            <input type="checkbox" checked={sync.enabled} on:change={(event) => ctx.setTempoSync(selected, { enabled: event.currentTarget.checked })}>
            <span class="slider"></span> Sync with tempo
          </label>
          <span class="muted small">Replaces the time knob with a note subdivision. {globals.tempo?.bpm ? '' : 'Tap a tempo in the top bar first.'}</span>
        </div>
      {/if}
      {#if tempoSynced}
        <div class="field">
          <label for="tempo-subdivision">Delay subdivision</label>
          <select id="tempo-subdivision" value={sync.subdivision}
            on:change={(event) => ctx.setTempoSync(selected, { subdivision: event.currentTarget.value })}>
            {#each SUBDIVISIONS as subdivision (subdivision.id)}
              <option value={subdivision.id} selected={subdivision.id === sync.subdivision}>{subdivision.label} ({subdivision.id})</option>
            {/each}
          </select>
          <span class="muted small">{ctx.tempoSubdivisionMs(selected)} ms · {globals.tempo?.bpm ?? '—'} BPM · {globals.tempo?.signature ?? '4/4'}</span>
        </div>
      {/if}

      <h3>Expression mapping <span class="muted small">— assign by right-clicking a knob</span></h3>
      <div class="expr-map-row">
        {#each badges as badge (badge.id)}
          <span class="expr-map" class:assigned={badge.assigned}
            title={badge.globalVolume ? 'Assigned to preset volume in Globals — clear it there to free this pedal' : undefined}>
            <b>{badge.id}</b> {badge.target}
          </span>
        {/each}
      </div>

      <h3>Stomp switch <span class="muted small">— one footswitch can drive this block</span></h3>
      <div class="radio-row">
        {#each globals.footswitches ?? [] as fs (fs.id)}
          <button class="radio-card" class:active={stompId === fs.id}
            on:click={() => ctx.setBlockStomp(preset, selected, fs.id)}>
            <b>{fs.name}</b><span class="muted small">{ctx.describeTrigger(fs.trigger)}</span>
          </button>
        {/each}
        <button class="radio-card" class:active={!stompId} on:click={() => ctx.setBlockStomp(preset, selected, null)}>
          <b>None</b><span class="muted small">unassigned</span>
        </button>
      </div>

      {#if sceneOn}
        <h3>Scenes <span class="muted small">— store the current parameter values, recall instantly</span></h3>
        <div class="radio-row scene-row">
          {#each scenes as scene (scene.key)}
            <button class="radio-card" class:active={state.activeScene === scene.key} class:empty={!scene.stored}
              on:click={() => ctx.selectScene(scene.key)}>
              <b>{scene.name}</b><span class="muted small">{scene.detail}</span>
            </button>
          {/each}
          <button class="radio-card" on:click={() => ctx.storeScene(state.activeScene)}>
            <b>Store to {state.activeScene === 'base' ? 'Base' : `Scene ${String(state.activeScene).slice(-1)}`}</b>
            <span class="muted small">save current values here</span>
          </button>
        </div>
        <div class="field scene-names">
          {#each scenes.filter((scene) => scene.key !== 'base') as scene (scene.key)}
            <label for={`scene-rename-${scene.key}`}>{scene.name}</label>
            <input id={`scene-rename-${scene.key}`} data-scene-rename={scene.key} value={scene.name}
              aria-label={`Rename ${scene.name}`}
              on:change={(event) => ctx.renameScene(scene.key, event.currentTarget.value)}>
          {/each}
        </div>
      {:else}
        <p class="muted small">Scenes are hidden for this block. Switch “Participate in scenes” back on to resume — saved values are not discarded.</p>
      {/if}

      <h3>Parameters <span class="muted small">— right-click a parameter to assign an expression pedal</span></h3>
      <div class="param-list">
        {#each visibleParams as entry (entry.index)}
          {@const normalized = live.params?.[entry.index] ?? 0}
          {@const mapping = assignments?.paramPedals?.[`${selected}:${entry.index}`]}
          {@const options = entry.param.options ?? []}
          {@const enumIndex = ccToEnum(Math.round(normalized * 127), options)}
          {@const actual = (Number(entry.param.min) || 0) + normalized * ((Number(entry.param.max) || 0) - (Number(entry.param.min) || 0))}
          <div class="param" data-param-block={selected} data-param-index={entry.index}
            data-param-cc={entry.param.cc ?? 'null'} data-param-label={entry.param.label}
            role="group" aria-label={`Assign expression pedal to ${entry.param.label}`}
            title="Right-click to assign an expression pedal"
            on:contextmenu|preventDefault={() => openPopup(entry.index, entry.param)}>
            {#if mapping}
              <div class="param-assignment">
                <span class="pedal-badge">{mapping.pedal} · {mapping.inputMin ?? 0}–{mapping.inputMax ?? 127}{mapping.invert ? ' · inv' : ''}</span>
              </div>
            {/if}
            {#if entry.param.kind === 'enum'}
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
          <p class="muted small">No MIDI-controllable parameters for this type.</p>
        {/each}
      </div>
      {#if block.note}<p class="muted small">{block.note}</p>{/if}
    {:else}
      <p class="muted">Select a block.</p>
    {/if}
  </div>

{/if}

{#if popupTarget}
  <PedalPopup target={popupTarget} onClose={() => { popupTarget = null; }} />
{/if}
  </section>
</div>
</div>

<style>
  .content { min-width: 0; }
  .editor-layout { display: flex; gap: 16px; align-items: flex-start; }
  .editor-sidebar { width: 240px; flex: none; }
  .editor-main { flex: 1; min-width: 0; }
  .editor-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; justify-content: space-between; }
  .card-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .editor-side { display: flex; flex-direction: column; gap: 6px; min-width: 200px; }
  .preset-volume { width: 100%; }
  .edited-presets { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .chain-strip { display: flex; flex-wrap: wrap; align-items: stretch; gap: 4px; }
  .chain-strip :global(.chain-row) { touch-action: pan-y; }
  @media (max-width: 640px) {
    .editor-layout { flex-direction: column; }
    .editor-sidebar { width: auto; }
  }
</style>
