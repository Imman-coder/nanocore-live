// Global click delegation shared by both views.
const $ = (sel) => document.querySelector(sel);

document.addEventListener('click', (event) => {
  const ctx = window.__nanocoreCtx;
  if (!ctx) return;
  const target = event.target.closest('button, [data-action]');
  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    const toggle = document.querySelector('#menu-toggle');
    if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = '☰'; }
  };
  if (target?.id === 'menu-toggle') {
    const open = document.body.classList.toggle('menu-open');
    target.setAttribute('aria-expanded', String(open));
    target.textContent = open ? '✕' : '☰';
    return;
  }
  if (!event.target.closest('#topbar-menu, #menu-toggle') && document.body.classList.contains('menu-open')) closeMenu();
  if (!target) return;

  const mode = target.dataset.mode;
  if (mode) return ctx.setMode(mode);
  if (target.id === 'connect') return window.__nanocoreConnect?.();
  if (target.id === 'open-devices') { closeMenu(); return window.__nanocoreOpenDevices?.(); }
  if (target.id === 'open-globals') { closeMenu(); return window.__nanocoreOpenGlobals?.(); }
  if (target.id === 'clear-log') { window.__nanocoreClearLog?.(); return; }
  if (target.id === 'editor-read') return ctx.readSnapshot();
  if (target.id === 'editor-recall') return ctx.recallPreset(Number($('#editor-preset').value));
  if (target.id === 'save-preset') return ctx.savePreset();
  if (target.id === 'fullscreen-toggle') return toggleFullscreen();
  if (target.id === 'tap-tempo' || target.dataset.action === 'tap-tempo') return ctx.tapTempo();

  const action = target.dataset.action;
  if (action === 'step-preset') return ctx.recallPreset(Math.max(1, Math.min(128, ctx.state.activePreset + Number(target.dataset.delta))));
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

document.addEventListener('change', (event) => {
  const ctx = window.__nanocoreCtx;
  if (event.target.id === 'preset-select' && ctx) return ctx.recallPreset(Number(event.target.value));
  if (event.target.id === 'preset-volume' && ctx) return ctx.setVolume(Number(event.target.value));
  if (event.target.id === 'time-signature' && ctx) return ctx.setTempo({ signature: event.target.value });
  if (event.target.id === 'transport-kind' && window.__nanocoreCtx?.state) {
    window.__nanocoreCtx.notify('Disconnect before switching transport');
  }
});
