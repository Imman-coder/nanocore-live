// Editor: FX blocks in the device's chain order, one selected block, and a
// detail container with its parameters, on/off, stomp radio and pedal badges.
import { BLOCK_BY_ID, chainBlockIds } from '../core/spec.js';
import { buildCc, buildRequestSysEx, COMMAND } from '../core/messages.js';
import { ccToEnum, enumToCc } from '../core/scaling.js';
import { openPedalPopup } from './pedal-popup.js';
import { renderKnob } from './knob.js';
import { typesFor, extraCommonParams } from '../core/versions.js';
import { sceneStored } from '../core/live.js';
import { SUBDIVISIONS } from '../core/tempo.js';

let currentCtx = null;

export function renderEditor(ctx) {
  currentCtx = ctx;
  const preset = ctx.state.activePreset;
  const header = `<div class="card">
    <div class="card-head">
      <span class="name">Preset ${preset}</span>
      <input data-editor="preset-name" value="${escapeHtml(ctx.assignments.name)}" placeholder="Preset name (max 8 characters)">
      <label class="small">NANOCORE preset</label>
      <select id="preset-select">${presetOptions(ctx, preset)}</select>
      <button data-action="save-preset-name" class="ghost" title="Write this name to the NANOCORE and save the preset">Save name to pedal</button>
      <button id="editor-read">Read snapshot</button>
      <button id="save-preset" class="primary" title="Write live RAM permanently into this NANOCORE preset">Save to pedal</button>
    </div>
    <div class="muted small">${ctx.snapshot
      ? `Loaded from the pedal: preset ${ctx.snapshot.activePreset + 1}, volume ${ctx.snapshot.volume}`
      : 'Connect and read the snapshot to edit the current preset.'}</div>
  </div>`;

  if (!ctx.snapshot) {
    return `<h2>Editor <span class="muted small">— NANOCORE preset ${preset}</span></h2>${header}
      <div class="card"><p class="muted">Connect to the NANOCORE and press <b>Read snapshot</b>.</p>
      <p class="small">If recall works but parameters stay blank, open <b>MIDI devices</b> and mark one input as "NANOCORE replies", then read again.</p></div>`;
  }

  const chain = chainBlockIds(ctx.snapshot.chainOrder);
  const byId = Object.fromEntries(ctx.snapshot.blocks.map((b) => [b.id, b]));
  const selected = chain.includes(ctx.state.selectedBlock) ? ctx.state.selectedBlock : chain[0];

  const rows = chain.map((id, position) => {
    const block = BLOCK_BY_ID[id];
    const live = byId[id];
    if (!block || !live) return '';
    const versions = typesFor(id, ctx.firmware);
    const type = versions.find((t) => t.id === live.variant) ?? versions[0];
    const active = id === 'amp' ? ctx.names.ampActive : id === 'cab' ? ctx.names.irActive : null;
    const slot = Number.isInteger(active) ? active : live.variant;
    const assetName = id === 'amp' ? ctx.names.amp?.[slot] : id === 'cab' ? ctx.names.ir?.[slot] : null;
    const stomp = ctx.assignments.blockStomps[id];
    const fsId = typeof stomp === 'string' ? stomp : stomp?.fs;
    return `<button class="chain-row ${id === selected ? 'selected' : ''}" data-action="select-block" data-block="${id}" draggable="true" title="Click to edit · drag to reorder">
      <span class="chain-pos">${position + 1}</span>
      <span class="chain-name">${escapeHtml(block.name)}</span>
      <span class="chain-type">${escapeHtml(assetName || type?.name || (id === 'amp' || id === 'cab' ? 'loading…' : '—'))}</span>
      <span class="chain-state">${live.enabled ? 'ON' : 'off'}</span>
      <span class="pill">${fsId ? escapeHtml(fsId) : 'no stomp'}</span>
    </button>`;
  });

  return `<h2>Editor <span class="muted small">— NANOCORE preset ${preset}</span></h2>
    ${header}
    <h3>Effect chain <span class="muted small">— click to edit · long drag to reorder</span></h3>
    <div class="chain-strip">${chain.map((id, i) => `${i ? '<span class="chain-arrow">→</span>' : ''}${rows[i] ?? ''}`).join('')}</div>
    <div class="detail-card card">${detail(ctx, selected, byId[selected])}</div>`;
}

function detail(ctx, blockId, live) {
  const block = BLOCK_BY_ID[blockId];
  if (!block || !live) return '<p class="muted">Select a block.</p>';
  const versions = typesFor(blockId, ctx.firmware);
  const type = versions.find((t) => t.id === live.variant) ?? versions[0];
  const assetNames = blockId === 'amp' ? ctx.names.amp : blockId === 'cab' ? ctx.names.ir : null;
  const activeSlot = blockId === 'amp' ? ctx.names.ampActive : blockId === 'cab' ? ctx.names.irActive : null;
  const selectedSlot = Number.isInteger(activeSlot) ? activeSlot : live.variant;
  const typeOptions = assetNames?.length
    ? assetNames.map((name, index) => `<option value="${index}" ${index === selectedSlot ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')
    : blockId === 'amp' || blockId === 'cab'
      ? `<option value="${live.variant}">Loading names from pedal…</option>`
      : versions.map((t) => `<option value="${t.id}" ${t.id === live.variant ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
  const params = [...block.commonParams, ...extraCommonParams(blockId, ctx.firmware), ...(type?.params ?? [])];
  const timeParams = params.some((p) => p.label === 'Time' || p.label === 'Delay');
  const sync = ctx.tempoSyncFor(blockId);
  const tempoSynced = timeParams && sync.enabled;
  const stomp = ctx.assignments.blockStomps[blockId];
  const fsId = typeof stomp === 'string' ? stomp : stomp?.fs;
  const warning = block.warning ?? type?.warning;
  const sceneOn = ctx.sceneBlockEnabled(blockId);

  return `<div class="detail-head">
      <h2 style="margin:0">${escapeHtml(block.name)}</h2>
      <select data-edit="type" data-block="${blockId}" aria-label="${block.name} type">${typeOptions}</select>
      <label class="switch"><input type="checkbox" data-edit="enabled" data-block="${blockId}" ${live.enabled ? 'checked' : ''}><span class="slider"></span> ${live.enabled ? 'On' : 'Off'}</label>
    </div>
    ${warning ? `<div class="warning">${escapeHtml(warning)}</div>` : ''}
    <div class="field">
      <label class="switch"><input type="checkbox" data-edit="scene-participate" data-block="${blockId}" ${sceneOn ? 'checked' : ''}><span class="slider"></span> Participate in scenes</label>
      <span class="muted small">Off hides the scenes here and leaves this block out of scene saves and recalls; previously saved values are kept.</span>
    </div>
    ${timeParams ? `<div class="field">
      <label class="switch"><input type="checkbox" data-edit="tempo-sync" data-block="${blockId}" ${sync.enabled ? 'checked' : ''}><span class="slider"></span> Sync with tempo</label>
      <span class="muted small">Replaces the time knob with a note subdivision. ${ctx.state.globals.tempo?.bpm ? '' : 'Tap a tempo in the top bar first.'}</span>
    </div>` : ''}
    ${tempoSynced ? `<div class="field">
      <label>Delay subdivision</label>
      <select data-tempo-subdivision="${blockId}">
        ${SUBDIVISIONS.map((s) => `<option value="${s.id}" ${s.id === sync.subdivision ? 'selected' : ''}>${s.label} (${s.id})</option>`).join('')}
      </select>
      <span class="muted small">${ctx.tempoSubdivisionMs(blockId)} ms · ${ctx.state.globals.tempo?.bpm ?? '—'} BPM · ${ctx.state.globals.tempo?.signature ?? '4/4'}</span>
    </div>` : ''}
    <h3>Expression mapping <span class="muted small">— assign by right-clicking a knob</span></h3>
    <div class="expr-map-row">
      ${(ctx.state.globals.expressionPedals ?? []).map((pedal) => {
        const entry = Object.entries(ctx.assignments.paramPedals)
          .find(([, mapping]) => mapping?.pedal === pedal.id);
        const target = entry
          ? `${BLOCK_BY_ID[entry[0].split(':')[0]]?.name ?? entry[0].split(':')[0]} · ${Number(entry[0].split(':')[1]) + 1}`
          : 'free';
        return `<span class="expr-map ${entry ? 'assigned' : ''}"><b>${escapeHtml(pedal.id)}</b> ${escapeHtml(target)}</span>`;
      }).join('')}
    </div>
    <h3>Stomp switch <span class="muted small">— one footswitch can drive this block</span></h3>
    <div class="radio-row">
      ${ctx.state.globals.footswitches.map((fs) => `<button class="radio-card ${fsId === fs.id ? 'active' : ''}"
        data-action="select-stomp" data-block="${blockId}" data-fs="${fs.id}">
        <b>${escapeHtml(fs.name)}</b><span class="muted small">${ctx.describeTrigger(fs.trigger)}</span></button>`).join('')}
      <button class="radio-card ${!fsId ? 'active' : ''}" data-action="select-stomp" data-block="${blockId}" data-fs="">
        <b>None</b><span class="muted small">unassigned</span></button>
    </div>
    ${sceneOn ? `<h3>Scenes <span class="muted small">— store the current parameter values, recall instantly</span></h3>
    <div class="radio-row scene-row">
      ${ctx.sceneKeys().map((scene) => {
        const active = ctx.state.activeScene === scene;
        const stored = sceneStored(ctx.assignments, scene);
        const detail = !stored ? 'empty — select, then Store' : scene === 'base'
          ? (ctx.baseOverridden() ? 'saved values' : 'pedal values')
          : `${Object.keys(ctx.assignments.scenes?.[scene] ?? {}).length} values · ${Object.keys(ctx.assignments.sceneEnabled?.[scene] ?? {}).length} fx`;
        return `<button class="radio-card ${active ? 'active' : ''} ${stored ? '' : 'empty'}"
          data-action="select-scene" data-scene="${scene}">
          <b>${escapeHtml(ctx.sceneName(scene))}</b>
          <span class="muted small">${escapeHtml(detail)}</span></button>`;
      }).join('')}
      <button class="radio-card" data-action="store-scene" data-scene="${ctx.state.activeScene}">
        <b>Store to ${ctx.state.activeScene === 'base' ? 'Base' : `Scene ${ctx.state.activeScene.slice(-1)}`}</b>
        <span class="muted small">save current values here</span></button>
    </div>
    <div class="field scene-names">
      ${ctx.sceneKeys().filter((scene) => scene !== 'base').map((scene) => `
        <label>${escapeHtml(ctx.sceneName(scene))}</label>
        <input data-scene-rename="${scene}" value="${escapeHtml(ctx.sceneName(scene))}" aria-label="Rename ${escapeHtml(ctx.sceneName(scene))}">`).join('')}
    </div>` : '<p class="muted small">Scenes are hidden for this block. Switch “Participate in scenes” back on to resume — saved values are not discarded.</p>'}
    <h3>Parameters <span class="muted small">— right-click a parameter to assign an expression pedal</span></h3>
    <div class="param-list">
      ${params.map((param, index) => (tempoSynced && (param.label === 'Time' || param.label === 'Delay')) ? '' : paramRow(ctx, blockId, param, live.params[index], index)).join('')
        || '<p class="muted small">No MIDI-controllable parameters for this type.</p>'}
    </div>
    ${block.note ? `<p class="muted small">${escapeHtml(block.note)}</p>` : ''}`;
}


export function presetOptions(ctx, selected) {
  const numbers = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
    33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
    49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, selected]);
  return [...numbers].sort((a, b) => a - b).map((n) =>
    `<option value="${n}" ${n === selected ? 'selected' : ''}>${n} · ${escapeHtml(ctx.presetLabel(n))}</option>`).join('');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function paramRow(ctx, blockId, param, normalized, index) {
  const n = typeof normalized === 'number' && Number.isFinite(normalized) ? normalized : 0;
  const mapping = ctx.assignments.paramPedals[`${blockId}:${index}`];
  const badge = mapping
    ? `<span class="pedal-badge">${escapeHtml(mapping.pedal)} · ${mapping.inputMin ?? 0}–${mapping.inputMax ?? 127}${mapping.invert ? ' · inv' : ''}</span>`
    : '';
  const id = `param-${blockId}-${index}`;
  const common = `data-edit="param" data-block="${blockId}" data-index="${index}" data-cc="${param.cc}"`;
  let knob;
  if (param.kind === 'enum') {
    const options = param.options ?? [];
    const selected = ccToEnum(Math.round(n * 127), options);
    knob = renderKnob({
      id, value: selected, max: Math.max(1, options.length - 1),
      label: escapeHtml(param.label), display: escapeHtml(options[selected] ?? ''),
      data: `${common} data-kind="enum" data-options="${escapeHtml(JSON.stringify(options))}" data-step-label="${escapeHtml(options.join('|'))}"`,
    });
  } else {
    const value = param.min + n * (param.max - param.min);
    const decimals = param.decimals ?? 2;
    knob = renderKnob({
      id, value: Math.round(n * 127), max: 127,
      label: escapeHtml(param.label),
      display: `${value.toFixed(decimals)}${param.unit ? ' ' + escapeHtml(param.unit) : ''}`,
      data: `${common} data-kind="range" data-min="${param.min}" data-max="${param.max}" data-decimals="${decimals}" data-unit="${escapeHtml(param.unit ?? '')}"`,
    });
  }
  return `<div class="param" data-param-block="${blockId}" data-param-index="${index}" data-param-cc="${param.cc ?? 'null'}"
    data-param-label="${escapeHtml(param.label)}" title="Right-click to assign an expression pedal">
    ${badge ? `<div class="param-assignment">${badge}</div>` : ''}
    ${knob}
  </div>`;
}

let draggedBlock = null;
let dragOrder = null;
let dragOriginal = null;
let dragRows = null;
let dragDropped = false;

function paintOrder(rows) {
  const strip = document.querySelector('.chain-strip');
  if (!strip) return;
  const arrows = [...strip.querySelectorAll('.chain-arrow')];
  const before = new Map([...strip.children].map((el) => [el, el.getBoundingClientRect().left]));
  strip.replaceChildren();
  rows.forEach((row, i) => {
    strip.append(row);
    if (i < rows.length - 1) strip.append(arrows[i]);
  });
  for (const el of strip.children) {
    const old = before.get(el);
    if (old === undefined) continue;
    const dx = old - el.getBoundingClientRect().left;
    if (Math.abs(dx) > 1) {
      el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
        { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
}

document.addEventListener('dragstart', (event) => {
  const row = event.target.closest?.('.chain-row');
  if (!row) return;
  dragRows = [...document.querySelectorAll('.chain-strip .chain-row')];
  dragOriginal = [...dragRows];
  dragOrder = dragRows.map((r) => r.dataset.block);
  dragDropped = false;
  draggedBlock = row.dataset.block;
  row.classList.add('dragging');
  event.dataTransfer?.setData('text/plain', draggedBlock);
});

document.addEventListener('dragend', () => {
  if (!dragDropped && dragOriginal) paintOrder(dragOriginal);
  draggedBlock = null;
  dragOrder = null;
  dragOriginal = null;
  dragRows = null;
  document.querySelectorAll('.chain-row.dragging, .chain-row.drag-over').forEach((el) =>
    el.classList.remove('dragging', 'drag-over'));
});

document.addEventListener('dragover', (event) => {
  const row = event.target.closest?.('.chain-row');
  if (!row || !draggedBlock || !dragOrder) return;
  event.preventDefault();
  for (const other of document.querySelectorAll('.chain-row.drag-over')) other.classList.remove('drag-over');
  row.classList.add('drag-over');
  const target = row.dataset.block;
  const next = dragOrder.filter((block) => block !== draggedBlock);
  if (!next.includes(target)) return;
  const rect = row.getBoundingClientRect();
  const after = event.clientX > rect.left + rect.width / 2;
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, draggedBlock);
  if (next.join() === dragOrder.join()) return;
  dragOrder = next;
  paintOrder(next.map((block) => dragRows.find((r) => r.dataset.block === block)));
});

document.addEventListener('dragleave', (event) => {
  const row = event.target.closest?.('.chain-row');
  if (row) row.classList.remove('drag-over');
});

document.addEventListener('drop', (event) => {
  const ctx = currentCtx;
  if (!draggedBlock || !ctx?.snapshot || !event.target.closest?.('.chain-strip')) return;
  event.preventDefault();
  const order = [...document.querySelectorAll('.chain-strip .chain-row')].map((row) => row.dataset.block);
  dragDropped = true;
  document.querySelectorAll('.chain-row.dragging, .chain-row.drag-over').forEach((el) =>
    el.classList.remove('dragging', 'drag-over'));
  ctx.setChainOrder(order);
  draggedBlock = null;
});

document.addEventListener('click', (event) => {
  const ctx = currentCtx;
  if (!ctx) return;
  const select = event.target.closest('[data-action="select-block"]');
  if (select) {
    ctx.selectBlock(select.dataset.block);
    return;
  }
  const stomp = event.target.closest('[data-action="select-stomp"]');
  if (stomp) return ctx.setBlockStomp(ctx.state.activePreset, stomp.dataset.block, stomp.dataset.fs || null);
  const scene = event.target.closest('[data-action="select-scene"]');
  if (scene) return ctx.selectScene(scene.dataset.scene);
  const store = event.target.closest('[data-action="store-scene"]');
  if (store) return ctx.storeScene(store.dataset.scene);
});

document.addEventListener('contextmenu', (event) => {
  const row = event.target.closest('[data-param-block]');
  if (!row || !currentCtx) return;
  event.preventDefault();
  openPedalPopup(currentCtx, {
    block: row.dataset.paramBlock,
    paramIndex: Number(row.dataset.paramIndex),
    label: row.dataset.paramLabel,
    cc: row.dataset.paramCc === 'null' ? null : Number(row.dataset.paramCc),
  });
});

document.addEventListener('input', (event) => {
  const el = event.target;
  if (el.dataset?.edit !== 'param' || el.dataset.kind !== 'range') return;
  const value = Number(el.value);
  if (el.dataset.cc === 'null') {
    currentCtx?.setParameter(el.dataset.block, Number(el.dataset.index), value / 127);
  } else {
    currentCtx?.send(buildCc(currentCtx.state.globals.midiChannel ?? 1, Number(el.dataset.cc), value));
  }
  const real = Number(el.dataset.min) + (value / 127) * (Number(el.dataset.max) - Number(el.dataset.min));
  currentCtx?.markEdited();
  const span = Number(el.dataset.max) - Number(el.dataset.min);
  if (span > 0) currentCtx?.noteParameter(el.dataset.block, Number(el.dataset.index), (real - Number(el.dataset.min)) / span);
  const display = el.parentElement?.querySelector('.knob-meta .value');
  if (display) display.textContent = `${real.toFixed(Number(el.dataset.decimals))}${el.dataset.unit ?? ''}`;
});

document.addEventListener('change', (event) => {
  const el = event.target;
  const ctx = currentCtx;
  if (!ctx) return;
  if (el.dataset?.editor === 'preset-name') return ctx.updatePreset(ctx.state.activePreset, { name: el.value });
  if (el.dataset?.sceneRename) return ctx.renameScene(el.dataset.sceneRename, el.value);
  if (el.dataset?.tempoSubdivision) return ctx.setTempoSync(el.dataset.tempoSubdivision, { subdivision: el.value });
  if (!el.dataset?.edit) return;
  if (el.dataset.edit === 'tempo-sync') return ctx.setTempoSync(el.dataset.block, { enabled: el.checked });
  const channel = ctx.state.globals.midiChannel ?? 1;
  if (el.dataset.edit === 'scene-participate') return ctx.setSceneBlock(el.dataset.block, el.checked);
  if (el.dataset.edit === 'enabled') {
    ctx.send(buildCc(channel, BLOCK_BY_ID[el.dataset.block].onOffCc, el.checked ? 127 : 0));
    ctx.noteEnabled(el.dataset.block, el.checked);
    ctx.markEdited();
    ctx.render();
    setTimeout(ctx.readSnapshot, 250);
  } else if (el.dataset.edit === 'type') {
    if (el.value === 'null') {
      ctx.notify('This effect type has no known ID yet — read-only until captured');
      return;
    }
    const block = BLOCK_BY_ID[el.dataset.block];
    const id = Number(el.value);
    ctx.markEdited();
    if (block.sysexTypeField) {
      // CC43/44 are ineffective on 1.10 and redundant on 1.11; SysEx is the
      // documented path on every version.
      ctx.send(buildRequestSysEx(COMMAND.SET_FIELD, [block.sysexTypeField, id]));
      // Update the label locally; slot names are only read from the device on connect.
      ctx.setAssetName(block.id === 'amp' ? 'amp' : 'ir', id, el.options[el.selectedIndex]?.textContent ?? `Slot ${id}`);
      setTimeout(ctx.readSnapshot, 350);
    } else {
      ctx.send(buildCc(channel, block.typeCc, id));
      setTimeout(ctx.readSnapshot, 250);
    }
  } else if (el.dataset.edit === 'param' && el.dataset.kind === 'enum') {
    const options = JSON.parse(el.dataset.options);
    if (el.dataset.cc === 'null') {
      const index = Number(el.value);
      ctx.setParameter(el.dataset.block, Number(el.dataset.index), options.length > 1 ? index / (options.length - 1) : 0);
    } else {
      ctx.send(buildCc(channel, Number(el.dataset.cc), enumToCc(Number(el.value), options)));
      ctx.noteParameter(el.dataset.block, Number(el.dataset.index),
        options.length > 1 ? Number(el.value) / (options.length - 1) : 0);
    }
    ctx.markEdited();
    ctx.render();
  }
});
