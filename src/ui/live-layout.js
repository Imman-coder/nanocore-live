// Live board layout editor: nested rows/columns of display items.
import { createDefaultState } from '../core/store.js';

let draft = null;
let layoutCtx = null;

function itemOptions(selected, ctx) {
  const choices = [{ id: 'empty', label: 'Empty slot' }];
  const label = (id, text) => choices.push({ id, label: text });
  label('tap', 'Tap tempo button');
  for (const key of ctx?.sceneKeys?.() ?? ['base', 'scene1', 'scene2']) label(`scene:${key}`, `Scene · ${ctx?.sceneName?.(key) ?? key}`);
  for (const fs of ctx?.state?.globals?.footswitches ?? []) label(`stomp:${fs.id}`, `Stomp · ${fs.name}`);
  for (const pedal of ctx?.state?.globals?.expressionPedals ?? []) label(`expression:${pedal.id}`, `Expression · ${pedal.name}`);
  label('row', 'Row component');
  label('column', 'Column component');
  return choices.map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.label}</option>`).join('');
}

const selectedValue = (node) => {
  if (!node || node.type === 'empty') return 'empty';
  if (node.type === 'row' || node.type === 'column') return node.type;
  return node.kind === 'tap' ? 'tap' : `${node.kind}:${node.id ?? ''}`;
};

const emptyNode = () => ({ type: 'empty' });
const container = (type) => ({ type, items: [emptyNode(), emptyNode()] });

function nodeAt(root, path) {
  let node = root;
  for (const index of path) node = node?.items?.[index];
  return node;
}

function setAt(root, path, value) {
  if (!path.length) return;
  let node = root;
  for (const index of path.slice(0, -1)) node = node.items[index];
  node.items[path.at(-1)] = value;
}

const parsePath = (value) => String(value ?? '').split('.').filter(Boolean).map(Number);
const trackTemplate = (items) => (items ?? []).map((item) => `minmax(0, ${Math.max(1, Number(item?.grow) || 1)}fr)`).join(' ');
const styleFor = (node) => node.type === 'row'
  ? `grid-template-columns:${trackTemplate(node.items)}`
  : `grid-template-rows:${trackTemplate(node.items)}`;

export function refreshLayoutOrientation() {
  for (const el of document.querySelectorAll('.layout-slots.row')) {
    const rect = el.getBoundingClientRect();
    const vertical = rect.height > rect.width + 8;
    el.classList.toggle('is-vertical', vertical);
    const template = [...el.children]
      .map((slot) => `minmax(0, ${Math.max(1, Number(slot.querySelector('[data-layout-grow]')?.value) || 1)}fr)`).join(' ');
    if (vertical) {
      el.style.gridTemplateRows = template;
      el.style.gridTemplateColumns = '';
    } else {
      el.style.gridTemplateColumns = template;
      el.style.gridTemplateRows = '';
    }
  }
}
const options = (selected, ctx) => itemOptions(selected, ctx);

function renderNode(node, path) {
  const grow = path.length ? `<label class="slot-grow">Stretch <input type="number" min="1" max="6" value="${Math.max(1, Number(node?.grow) || 1)}" data-layout-grow="${path.join('.')}"></label>` : '';
  if (!node || node.type === 'empty') {
    return `<div class="layout-slot"><div class="layout-empty">empty slot</div>
      <select data-layout-set="${path.join('.')}">${options('empty', layoutCtx)}</select>${grow}</div>`;
  }
  if (node.type === 'item') {
    return `<div class="layout-slot"><div class="layout-chip">${selectedValue(node)}</div>
      <select data-layout-set="${path.join('.')}">${options(selectedValue(node), layoutCtx)}</select>${grow}</div>`;
  }
  const items = node.items ?? [];
  return `<div class="layout-container">
    <div class="layout-controls">
      <select data-layout-type="${path.join('.')}">
        <option value="row" ${node.type === 'row' ? 'selected' : ''}>Row</option>
        <option value="column" ${node.type === 'column' ? 'selected' : ''}>Column</option>
      </select>
      <label>Slots <input type="number" min="1" max="8" value="${items.length}" data-layout-count="${path.join('.')}"></label>
      <select data-layout-set="${path.join('.')}">${options(node.type, layoutCtx)}</select>
      ${grow}
    </div>
    <div class="layout-slots ${node.type}" style="${styleFor(node)}">${items.map((child, i) => renderNode(child, [...path, i])).join('')}</div>
  </div>`;
}

export function openLiveLayout(ctx) {
  layoutCtx = ctx;
  draft = structuredClone(ctx.state.globals.liveLayout);
  render();
}

function render() {
  const modal = document.querySelector('#modal');
  modal.hidden = false;
  modal.innerHTML = `<div class="modal-box layout-modal-box">
    <div class="modal-head"><h2>Arrange live board</h2><button class="small" data-layout-action="close">Close</button></div>
    <p class="muted small">Rows split sideways, columns stack vertically. Every slot keeps its share of space even when empty.</p>
    <label class="field"><input type="checkbox" data-layout-fit ${draft.fitScreen ? 'checked' : ''}> Fit everything to the screen — no scrolling</label>
    <div class="layout-tree">${renderNode(draft.root, [])}</div>
    <div class="row-actions" style="margin-top:14px">
      <button class="primary" data-layout-action="save">Save layout</button>
      <button data-layout-action="reset">Reset to default</button>
    </div>
  </div>`;
  requestAnimationFrame(refreshLayoutOrientation);
}

document.addEventListener('click', (event) => {
  if (!draft) return;
  const action = event.target.closest('[data-layout-action]')?.dataset.layoutAction;
  if (!action) return;
  if (action === 'close') { draft = null; document.querySelector('#modal').hidden = true; }
  if (action === 'reset') {
    draft = structuredClone(createDefaultState().globals.liveLayout);
    render();
  }
  if (action === 'save') {
    layoutCtx?.setLiveLayout(draft);
    draft = null;
    document.querySelector('#modal').hidden = true;
    layoutCtx?.notify('Live board layout saved');
  }
});

document.addEventListener('change', (event) => {
  if (!draft) return;
  const el = event.target;
  if (el.dataset.layoutFit !== undefined) { draft.fitScreen = el.checked; return; }
  const growAttr = el.dataset.layoutGrow;
  if (growAttr !== undefined) {
    const path = growAttr === '' ? [] : parsePath(growAttr);
    const node = path.length ? nodeAt(draft.root, path) : draft.root;
    node.grow = Math.max(1, Math.min(6, Number(el.value) || 1));
    render();
    return;
  }
  const typeAttr = el.dataset.layoutType;
  if (typeAttr !== undefined) {
    const typePath = typeAttr === '' ? [] : parsePath(typeAttr);
    (typePath.length ? nodeAt(draft.root, typePath) : draft.root).type = el.value;
    render();
    return;
  }
  const countAttr = el.dataset.layoutCount;
  if (countAttr !== undefined) {
    const countPath = countAttr === '' ? [] : parsePath(countAttr);
    const node = countPath.length ? nodeAt(draft.root, countPath) : draft.root;
    const count = Math.max(1, Math.min(8, Number(el.value) || 1));
    while (node.items.length < count) node.items.push(emptyNode());
    node.items.length = count;
    render();
    return;
  }
  const setAttr = el.dataset.layoutSet;
  if (setAttr !== undefined) {
    const setPath = setAttr === '' ? [] : parsePath(setAttr);
    const value = el.value;
    const [kind, id] = value.includes(':') ? value.split(':') : [value, undefined];
    const next = value === 'row' || value === 'column' ? container(value)
      : value === 'empty' ? emptyNode() : { type: 'item', kind, ...(id !== undefined ? { id } : {}) };
    if (setPath.length) setAt(draft.root, setPath, next);
    else draft.root = next;
    render();
  }
});
