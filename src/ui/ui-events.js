import { renderSettings } from './settings.js';

// Global click delegation shared by both views.
const $ = (sel) => document.querySelector(sel);
let suppressPanelClick = false;

document.addEventListener('click', (event) => {
  const ctx = window.__nanocoreCtx;
  if (!ctx) return;
  const target = event.target.closest('button, [data-action]');
  const menu = document.querySelector('#topbar-menu');
  const closeMenu = () => {
    if (menu) menu.hidden = true;
    const toggle = document.querySelector('#settings-toggle');
    if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = '⚙'; }
  };
  if (target?.id === 'settings-toggle') {
    const open = menu.hidden;
    if (open) renderSettings(ctx);
    menu.hidden = !open;
    target.setAttribute('aria-expanded', String(open));
    target.textContent = open ? '✕' : '⚙';
    return;
  }
  if (target?.id === 'settings-close' || event.target === menu) return closeMenu();
  // A tab re-render detaches the clicked node, so closest() alone would see it
  // as outside the popup. composedPath keeps the original ancestors.
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const insideSettings = path.some((node) => node === menu || node?.id === 'topbar-menu' || node?.id === 'settings-toggle');
  if (menu && !menu.hidden && !insideSettings) closeMenu();
  if (!target) return;

  if (target?.id === 'panel-toggle') {
    if (suppressPanelClick) { suppressPanelClick = false; return; }
    return ctx.setMode(ctx.state.mode === 'live' ? 'editor' : 'live');
  }
  if (target?.dataset.action === 'toggle-live-edit') return ctx.toggleLiveEdit();
  if (target?.dataset.action === 'edit-live-layout') { closeMenu(); return ctx.startLiveEdit(); }

  const mode = target.dataset.mode;
  if (mode) return ctx.setMode(mode);
  if (target.id === 'connect') { closeMenu(); return window.__nanocoreConnect?.(); }
  if (target.id === 'open-devices') return window.__nanocoreSettingsTab?.('devices');
  if (target.id === 'open-globals') return window.__nanocoreSettingsTab?.('globals');
  if (target.id === 'clear-log') { window.__nanocoreClearLog?.(); return; }
  if (target.id === 'editor-read') return ctx.readSnapshot();
  if (target.id === 'editor-recall') return ctx.recallPreset(Number($('#editor-preset').value));
  if (target.id === 'save-preset') return ctx.savePreset();
  if (target.dataset.action === 'save-preset-name') {
    return ctx.renamePresetOnDevice($('[data-editor="preset-name"]')?.value ?? '');
  }
  if (target.id === 'fullscreen-toggle') return toggleFullscreen();
  if (target.id === 'tap-tempo' || target.dataset.action === 'tap-tempo') return ctx.tapTempo();

  const action = target.dataset.action;
  if (action === 'step-preset') return ctx.recallPreset(Math.max(1, Math.min(64, ctx.state.activePreset + Number(target.dataset.delta))));
  if (action === 'recall-preset') return ctx.recallPreset(Number(target.dataset.preset));
  if (action === 'toggle-advanced') return ctx.update({ showAdvanced: !ctx.state.showAdvanced });

  if (action === 'stomp') return ctx.toggleStomp(target.dataset.fs);
  if (action === 'scene') return ctx.recallScene(target.dataset.scene);

  if (action === 'learn') {
    ctx.router.armLearn(target.dataset.learn);
    target.classList.add('learn');
    ctx.notify('Press the footswitch / move the expression pedal now');
  }
});

function toggleFullscreen() {
  const root = document.documentElement;
  const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  try {
    if (active) {
      const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
      return exit?.call(document);
    }
    const enter = root.requestFullscreen ?? root.webkitRequestFullscreen;
    if (!enter) throw new Error('Fullscreen is not available in this browser');
    return enter.call(root);
  } catch (error) {
    window.__nanocoreCtx?.notify('Fullscreen is not available in this browser');
  }
}

document.addEventListener('fullscreenchange', () => {
  const button = document.querySelector('#fullscreen-toggle');
  if (!button) return;
  const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  button.textContent = active ? '⤡' : '⛶';
  button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const menu = document.querySelector('#topbar-menu');
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  const toggle = document.querySelector('#settings-toggle');
  if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = '⚙'; }
});

let panelPress = null;
document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest?.('#panel-toggle')) return;
  const ctx = window.__nanocoreCtx;
  if (!ctx || ctx.state.mode !== 'live') return;
  panelPress = setTimeout(() => {
    suppressPanelClick = true;
    panelPress = null;
    ctx.openLiveLayout();
  }, 600);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => document.addEventListener(type, () => {
  if (panelPress) clearTimeout(panelPress);
  panelPress = null;
}));
document.addEventListener('contextmenu', (event) => {
  if (!event.target.closest?.('#panel-toggle')) return;
  const ctx = window.__nanocoreCtx;
  if (!ctx || ctx.state.mode !== 'live') return;
  event.preventDefault();
  ctx.openLiveLayout();
});

document.addEventListener('change', (event) => {
  const ctx = window.__nanocoreCtx;
  if (event.target.dataset.gridSize && ctx) {
    const key = event.target.dataset.gridSize;
    return ctx.setLiveGrid({ [key]: Math.max(1, Math.min(64, Number(event.target.value) || 1)) });
  }
  if (event.target.dataset.gridCell && ctx) {
    return ctx.setLiveGridCell(event.target.dataset.gridCell, event.target.value);
  }
  if (event.target.dataset.gridCellItem && ctx) {
    const value = event.target.value;
    const [kind, ref] = value.includes(':') ? value.split(':') : [value, undefined];
    return ctx.setLiveGridItem(event.target.dataset.gridCellItem, { kind, ...(ref !== undefined ? { ref } : {}) });
  }
  if (event.target.id === 'preset-select' && ctx) return ctx.recallPreset(Number(event.target.value));
  if (event.target.dataset.presetSelect && ctx) return ctx.recallPreset(Number(event.target.value));
  if (event.target.id === 'preset-volume' && ctx) return ctx.setVolume(Number(event.target.value));
  if (event.target.id === 'time-signature' && ctx) return ctx.setTempo({ signature: event.target.value });
  if (event.target.id === 'transport-kind' && window.__nanocoreCtx?.state) {
    window.__nanocoreCtx.setTransportKind(event.target.value);
  }
});
