// Settings popup: connection, MIDI devices and Globals in one tabbed window.
import { devicesBody, initDevices } from './devices.js';
import { globalsBody, initGlobals } from './globals.js';

let activeTab = 'connection';
let settingsCtx = null;
let devicesScanned = false;

const TABS = [
  { id: 'connection', label: 'Connection' },
  { id: 'devices', label: 'MIDI devices' },
  { id: 'globals', label: 'Globals' },
];

function connectionPanel(ctx) {
  const transport = ctx.transportKind ?? 'webmidi';
  return `<div class="transport">
    <button id="connect">${ctx.connected ? 'Disconnect' : 'Connect'}</button>
    <span id="status" class="status ${ctx.connected ? 'online' : 'offline'}">${ctx.statusText()}</span>
  </div>
  <button data-action="demo-mode" class="${ctx.demo ? '' : 'primary'}">${ctx.demo ? 'Exit demo mode' : 'Start demo mode (no pedal)'}</button>
  <p class="muted small">${ctx.demo ? 'A simulated pedal is running locally. No MIDI messages leave this browser.' : 'Demo mode loads example presets and names so the Editor and Live views can be explored without hardware.'}</p>
  ${ctx.demo ? `<label class="field demo-data-option"><input type="checkbox" data-setting="demo-use-real-data" ${ctx.demoUseRealData ? 'checked' : ''} onchange="window.__nanocoreCtx.setDemoUseRealData(this.checked)"> Use my actual saved settings and data in demo (edits will change what this browser stores)</label>
  <p class="muted small">${ctx.demoUseRealData
    ? 'Demo is using your real saved data — changes persist in this browser.'
    : 'Demo edits are sandboxed: settings, assignments and layouts you change here are discarded when you exit.'}</p>` : ''}
  <div class="field">
    <label for="transport-kind">Transport</label>
    <select id="transport-kind" aria-label="Transport" onchange="window.__nanocoreCtx.setTransportKind(this.value)">
      <option value="webmidi" ${transport === 'webmidi' ? 'selected' : ''}>USB MIDI / paired Bluetooth MIDI</option>
      <option value="webbluetooth" ${transport === 'webbluetooth' ? 'selected' : ''}>Direct Bluetooth (Web Bluetooth)</option>
      <option value="demo" ${transport === 'demo' ? 'selected' : ''}>Demo mode (no pedal)</option>
    </select>
  </div>
    <label class="field"><input type="checkbox" onchange="window.__nanocoreCtx.setGlobalSetting('showLogBar', this.checked)" ${ctx.state.globals.showLogBar !== false ? 'checked' : ''}> Show bottom MIDI message bar</label>
    <label class="field"><input type="checkbox" onchange="window.__nanocoreCtx.setGlobalSetting('hideAssignmentsButton', this.checked)" ${ctx.state.globals.hideAssignmentsButton ? 'checked' : ''}> Hide "Show parameter assignments" button</label>
    <label class="field"><input type="checkbox" onchange="window.__nanocoreCtx.setGlobalSetting('hideLivePresetLabel', this.checked)" ${ctx.state.globals.hideLivePresetLabel ? 'checked' : ''}> Hide "Live — NANOCORE preset" label</label>
    <label class="field"><input type="checkbox" onchange="window.__nanocoreCtx.setGlobalSetting('hideLivePresetSelector', this.checked)" ${ctx.state.globals.hideLivePresetSelector ? 'checked' : ''}> Hide preset selector in Live</label>
    <label class="field"><input type="checkbox" onchange="window.__nanocoreCtx.setLiveLayoutOption('fitScreen', this.checked)" ${ctx.state.globals.liveLayout?.fitScreen ? 'checked' : ''}> Fit Live board to screen (no scrolling)</label>
    <button data-action="edit-live-layout">Edit Live layout</button>
    <p class="muted small" id="capability-hint">${ctx.connectionHint()}</p>
    <p class="muted small">Last device reply: ${ctx.lastReply ?? 'none'}</p>`;
}

function panel(ctx) {
  if (activeTab === 'devices') {
    initDevices(ctx);
    return `<p class="muted small">Select the NANOCORE ports before connecting — the choice is saved in this browser.</p>
      <button data-devices-scan>Scan MIDI devices</button>
      <div data-devices-root>${devicesBody(ctx)}</div>`;
  }
  if (activeTab === 'globals') {
    initGlobals(ctx, () => renderSettings(ctx));
    return `<div data-globals-root>${globalsBody(ctx)}</div>`;
  }
  return connectionPanel(ctx);
}

export function renderSettings(ctx) {
  settingsCtx = ctx;
  const root = document.querySelector('#topbar-menu .modal-box');
  if (!root) return;
  root.innerHTML = `<div class="modal-head"><h2>Settings</h2><button class="small" data-settings-close>Close</button></div>
    <div class="settings-tabs" role="tablist">
      ${TABS.map((tab) => `<button role="tab" aria-selected="${tab.id === activeTab}" class="${tab.id === activeTab ? 'active' : ''}" data-settings-tab="${tab.id}">${tab.label}</button>`).join('')}
    </div>
    <div class="settings-panel">${panel(ctx)}</div>
    <div class="settings-footer">
      ${activeTab === 'devices' ? '<button class="primary" data-settings-save="devices">Save ports</button>' : ''}
      ${activeTab === 'globals' ? '<button class="primary" data-settings-save="globals">Save globals</button>' : ''}
      <button data-settings-close>Close</button>
    </div>`;
  if (activeTab === 'devices' && !devicesScanned && !ctx.connected
      && (ctx.state.globals.transportKind ?? 'webmidi') !== 'webbluetooth' && ctx.scanPorts) {
    devicesScanned = true;
    Promise.resolve(ctx.scanPorts()).then(() => renderSettings(ctx)).catch(() => {
      devicesScanned = false;
      renderSettings(ctx);
    });
  }
}

export function openSettingsTab(ctx, tab = 'connection') {
  activeTab = tab;
  renderSettings(ctx);
  const menu = document.querySelector('#topbar-menu');
  if (menu) menu.hidden = false;
}

document.addEventListener('click', (event) => {
  if (!settingsCtx) return;
  const tab = event.target.closest('[data-settings-tab]');
  if (tab) {
    activeTab = tab.dataset.settingsTab;
    renderSettings(settingsCtx);
    return;
  }
  if (event.target.closest('[data-action="demo-mode"]')) {
    const menu = document.querySelector('#topbar-menu');
    if (menu) menu.hidden = true;
    if (settingsCtx.demo) settingsCtx.exitDemo();
    else { settingsCtx.connect('demo'); }
    return;
  }
  const save = event.target.closest('[data-settings-save]');
  if (save) {
    const root = document.querySelector('#topbar-menu');
    if (save.dataset.settingsSave === 'devices') root?.querySelector('[data-devices-root] [data-dev="save"]')?.click();
    else root?.querySelector('[data-globals-root] [data-global="save"]')?.click();
    return;
  }
  if (event.target.closest('[data-devices-scan]')) {
    devicesScanned = true;
    Promise.resolve(settingsCtx.scanPorts?.()).finally(() => renderSettings(settingsCtx));
    return;
  }
  if (event.target.closest('[data-settings-close]')) {
    const menu = document.querySelector('#topbar-menu');
    if (menu) menu.hidden = true;
  }
});
