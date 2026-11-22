// Global click delegation shared by both views.
const $ = (sel) => document.querySelector(sel);

document.addEventListener('click', (event) => {
  const ctx = window.__nanocoreCtx;
  if (!ctx) return;
  const target = event.target.closest('button, [data-action]');
  if (!target) return;

  const mode = target.dataset.mode;
  if (mode) return ctx.setMode(mode);
  if (target.id === 'connect') return window.__nanocoreConnect?.();
  if (target.id === 'open-devices') return window.__nanocoreOpenDevices?.();
  if (target.id === 'open-globals') return window.__nanocoreOpenGlobals?.();
  if (target.id === 'clear-log') { window.__nanocoreClearLog?.(); return; }
  if (target.id === 'editor-read') return ctx.readSnapshot();
  if (target.id === 'editor-recall') return ctx.recallPreset(Number($('#editor-preset').value));
  if (target.id === 'save-preset') return ctx.savePreset();

  const action = target.dataset.action;
  if (action === 'step-preset') return ctx.recallPreset(Math.max(1, Math.min(128, ctx.state.activePreset + Number(target.dataset.delta))));
  if (action === 'recall-preset') return ctx.recallPreset(Number(target.dataset.preset));
  if (action === 'toggle-advanced') return ctx.update({ showAdvanced: !ctx.state.showAdvanced });

  if (action === 'stomp') {
    const fs = ctx.state.globals.footswitches.find((f) => f.id === target.dataset.fs);
    if (!fs) return;
    const channel = fs.trigger?.channel ?? 1;
    const number = fs.trigger?.number ?? 0;
    const bytes = fs.trigger?.type === 'note'
      ? [0x90 | (channel - 1), number, 127]
      : fs.trigger?.type === 'pc'
        ? [0xc0 | (channel - 1), number]
        : [0xb0 | (channel - 1), number, 127];
    return ctx.router.handleMidi({ port: 'UI', bytes });
  }

  if (action === 'learn') {
    ctx.router.armLearn(target.dataset.learn);
    target.classList.add('learn');
    ctx.notify('Press the footswitch / move the expression pedal now');
  }
});

document.addEventListener('change', (event) => {
  const ctx = window.__nanocoreCtx;
  if (event.target.id === 'preset-select' && ctx) return ctx.recallPreset(Number(event.target.value));
  if (event.target.id === 'transport-kind' && window.__nanocoreCtx?.state) {
    window.__nanocoreCtx.notify('Disconnect before switching transport');
  }
});
