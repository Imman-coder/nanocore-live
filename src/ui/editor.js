// Editor: FX blocks in the device's chain order, one selected block, and a
// detail container with its parameters, on/off, stomp radio and pedal badges.
import { BLOCK_BY_ID, chainBlockIds } from '../core/spec.js';
import { buildCc, buildRequestSysEx, COMMAND } from '../core/messages.js';
import { ccToEnum, enumToCc } from '../core/scaling.js';
import { openPedalPopup } from './pedal-popup.js';
import { typesFor } from '../core/versions.js';

let currentCtx = null;

export function renderEditor(ctx) {
  currentCtx = ctx;
  const preset = ctx.state.activePreset;
  const header = `<div class="card">
    <div class="card-head">
      <span class="name">Preset ${preset}</span>
      <input data-editor="preset-name" value="${escapeHtml(ctx.assignments.name)}" placeholder="Preset name (browser only)">
      <label class="small">NANOCORE preset</label>
      <select id="preset-select">${presetOptions(ctx, preset)}</select>
      <button id="editor-read">Read snapshot</button>
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
    return `<button class="chain-row ${id === selected ? 'selected' : ''}" data-action="select-block" data-block="${id}">
      <span class="chain-pos">${position + 1}</span>
      <span class="chain-name">${escapeHtml(block.name)}${assetName ? ` <small>${escapeHtml(assetName)}</small>` : ''}</span>
      <span class="chain-type">${escapeHtml(assetName || type?.name || '—')}</span>
      <span class="chain-state">${live.enabled ? 'ON' : 'off'}</span>
      <span class="pill">${fsId ? escapeHtml(fsId) : 'no stomp'}</span>
    </button>`;
  });

  return `<h2>Editor <span class="muted small">— NANOCORE preset ${preset}</span></h2>
    ${header}
    <h3>Effect chain <span class="muted small">— signal path</span></h3>
    <div class="chain-strip">${chain.map((id, i) => `${i ? '<span class="chain-arrow">→</span>' : ''}${rows[i] ?? ''}`).join('')}</div>
    <div class="detail-card card">${detail(ctx, selected, byId[selected])}</div>
    <div class="card"><h3>Save</h3>
      <p class="small muted">Writes the pedal's live RAM into NANOCORE preset ${preset} using SysEx opcode 0x46.</p>
      <button id="save-preset" class="primary">Save to pedal</button>
    </div>`;
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
  const params = [...block.commonParams, ...(type?.params ?? [])];
  const stomp = ctx.assignments.blockStomps[blockId];
  const fsId = typeof stomp === 'string' ? stomp : stomp?.fs;
  const warning = block.warning ?? type?.warning;

  return `<div class="detail-head">
      <h2 style="margin:0">${escapeHtml(block.name)}</h2>
      <select data-edit="type" data-block="${blockId}" aria-label="${block.name} type">${typeOptions}</select>
      <label class="switch"><input type="checkbox" data-edit="enabled" data-block="${blockId}" ${live.enabled ? 'checked' : ''}><span class="slider"></span> ${live.enabled ? 'On' : 'Off'}</label>
    </div>
    ${warning ? `<div class="warning">${escapeHtml(warning)}</div>` : ''}
    <h3>Stomp switch <span class="muted small">— one footswitch can drive this block</span></h3>
    <div class="radio-row">
      ${ctx.state.globals.footswitches.map((fs) => `<button class="radio-card ${fsId === fs.id ? 'active' : ''}"
        data-action="select-stomp" data-block="${blockId}" data-fs="${fs.id}">
        <b>${escapeHtml(fs.name)}</b><span class="muted small">${ctx.describeTrigger(fs.trigger)}</span></button>`).join('')}
      <button class="radio-card ${!fsId ? 'active' : ''}" data-action="select-stomp" data-block="${blockId}" data-fs="">
        <b>None</b><span class="muted small">unassigned</span></button>
    </div>
    <h3>Parameters <span class="muted small">— right-click a parameter to assign an expression pedal</span></h3>
    <div class="param-list">
      ${params.map((param, index) => paramRow(ctx, blockId, param, live.params[index], index)).join('')
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
    `<option value="${n}" ${n === selected ? 'selected' : ''}>${escapeHtml(ctx.presetLabel(n))}</option>`).join('');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function paramRow(ctx, blockId, param, normalized, index) {
  const n = typeof normalized === 'number' && Number.isFinite(normalized) ? normalized : 0;
  const mapping = ctx.assignments.paramPedals[`${blockId}:${index}`];
  const ccBadge = param.cc === null ? '<span class="pill">CC unknown</span>' : '';
  const badge = `${ccBadge}${mapping
    ? `<span class="pedal-badge">${escapeHtml(mapping.pedal)} · ${mapping.inputMin ?? 0}–${mapping.inputMax ?? 127}${mapping.invert ? ' · inv' : ''}</span>`
    : ''}`;
  let control;
  if (param.kind === 'enum') {
    const options = param.options ?? [];
    const selected = ccToEnum(Math.round(n * 127), options);
    control = `<select data-edit="param" data-block="${blockId}" data-index="${index}" data-kind="enum" data-cc="${param.cc}" data-options="${escapeHtml(JSON.stringify(options))}">
      ${options.map((o, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
    </select>`;
  } else {
    const value = param.min + n * (param.max - param.min);
    control = `<input type="range" min="0" max="127" value="${Math.round(n * 127)}"
      data-edit="param" data-block="${blockId}" data-index="${index}" data-kind="range"
      data-cc="${param.cc}" data-min="${param.min}" data-max="${param.max}" data-decimals="${param.decimals ?? 2}">
      <span class="value">${value.toFixed(param.decimals ?? 2)}${param.unit ? ' ' + escapeHtml(param.unit) : ''}</span>`;
  }
  return `<div class="param" data-param-block="${blockId}" data-param-index="${index}"
    data-param-label="${escapeHtml(param.label)}" title="Right-click to assign an expression pedal">
    <label>${escapeHtml(param.label)} ${badge}</label>${control}
  </div>`;
}

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
});

document.addEventListener('contextmenu', (event) => {
  const row = event.target.closest('[data-param-block]');
  if (!row || !currentCtx) return;
  event.preventDefault();
  openPedalPopup(currentCtx, {
    block: row.dataset.paramBlock,
    paramIndex: Number(row.dataset.paramIndex),
    label: row.dataset.paramLabel,
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
  el.nextElementSibling.textContent = `${real.toFixed(Number(el.dataset.decimals))}`;
});

document.addEventListener('change', (event) => {
  const el = event.target;
  const ctx = currentCtx;
  if (!ctx) return;
  if (el.dataset?.editor === 'preset-name') return ctx.updatePreset(ctx.state.activePreset, { name: el.value });
  if (!el.dataset?.edit) return;
  const channel = ctx.state.globals.midiChannel ?? 1;
  if (el.dataset.edit === 'enabled') {
    ctx.send(buildCc(channel, BLOCK_BY_ID[el.dataset.block].onOffCc, el.checked ? 127 : 0));
    setTimeout(ctx.readSnapshot, 250);
  } else if (el.dataset.edit === 'type') {
    if (el.value === 'null') {
      ctx.notify('This effect type has no known ID yet — read-only until captured');
      return;
    }
    const block = BLOCK_BY_ID[el.dataset.block];
    const id = Number(el.value);
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
    }
  }
});
