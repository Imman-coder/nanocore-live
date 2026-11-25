// Start page: every connection and device-side fetch lives in one place.
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let startCtx = null;

export function renderStart(ctx) {
  startCtx = ctx;
  const globals = ctx.state.globals;
  const selection = globals.portSelection ?? {};
  const ports = ctx.ports ?? { inputs: [], outputs: [] };
  const devicePorts = ctx.devicePorts ?? { inputs: [], outputs: [] };
  const deviceInputId = selection.deviceInputId ?? ports.inputs.find((p) => p.role === 'device')?.id ?? '';
  const deviceOutputId = selection.deviceOutputId ?? ports.outputId ?? '';
  const controllers = new Set(selection.enabledInputIds ?? ports.inputs.filter((p) => p.role === 'controller').map((p) => p.id));
  const catalog = ctx.catalogStatus();
  const transport = ctx.transportKind ?? 'webmidi';
  const isWebMidi = devicePorts.outputs.some((p) => p.type === 'output');

  return `<h2>Start <span class="muted small">${ctx.demo ? '— demo pedal is running' : '— set up the pedal before editing'}</span></h2>
    ${ctx.demo ? `
      <div class="card demo-card active">
        <h3>Demo mode is running</h3>
        <p class="muted small">A simulated NANOCORE is loaded with example presets, amp and cab names. Every control works locally; nothing is sent to hardware. Demo edits stay in this session unless you opt in to your saved data in Settings.</p>
        <div class="row-actions"><button class="primary" data-start="editor">Continue to Editor</button><button data-start="live">Open Live view</button><button data-start="exit-demo">Exit demo mode</button></div>
      </div>` : `
      <div class="card demo-card">
        <h3>No pedal connected? Try the demo</h3>
        <p class="muted small">Explore the Editor and Live views with a simulated pedal and example names. One click, no hardware or permissions needed.</p>
        <button class="primary" data-start="demo">Try demo mode</button>
      </div>`}
    <div class="start-grid">
      <section class="card start-step">
        <h3>1. Connection</h3>
        <div class="field">
          <label for="start-transport">Transport</label>
          <select id="start-transport" onchange="window.__nanocoreCtx.setTransportKind(this.value)">
            <option value="webmidi" ${transport === 'webmidi' ? 'selected' : ''}>USB MIDI / paired Bluetooth MIDI</option>
            <option value="webbluetooth" ${transport === 'webbluetooth' ? 'selected' : ''}>Direct Bluetooth (Web Bluetooth)</option>
            <option value="demo" ${transport === 'demo' ? 'selected' : ''}>Demo mode (no pedal)</option>
          </select>
        </div>
        <p class="muted small">${ctx.demo ? 'Demo mode uses a simulated pedal in this browser — no MIDI permissions or hardware are used.' : escapeHtml(ctx.connectionHint())}</p>
        <div class="row-actions">
          <button class="primary" data-start="connect">${ctx.connected ? 'Disconnect' : 'Connect'}</button>
          <button data-start="scan">Scan MIDI devices</button>
          <button data-start="read">Read snapshot</button>
        </div>
        <p class="muted small">Status: <b>${ctx.connected ? 'connected' : 'disconnected'}</b> · ${escapeHtml(ctx.statusText())}</p>
      </section>

      <section class="card start-step">
        <h3>2. MIDI ports</h3>
        ${ctx.ports.inputs.length || ctx.connected ? `
          <div class="field">
            <label>Send to NANOCORE</label>
            ${isWebMidi
              ? `<select data-port-output>${devicePorts.outputs.map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === deviceOutputId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select>`
              : `<span class="muted small">Direct Bluetooth: ${escapeHtml(devicePorts.outputs[0]?.name ?? 'NANOCORE')}</span>`}
          </div>
          <p class="muted small">Mark one input as the NANOCORE reply port; every other enabled input is a controller.</p>
          ${ports.inputs.length ? ports.inputs.map((p) => `<div class="port-row">
            <div class="port-id" title="${escapeHtml(p.name)} · ${escapeHtml(p.id)}">
              <b>${escapeHtml(p.name)}</b><span class="muted small">${escapeHtml(p.id)}</span>
            </div>
            <div class="port-roles">
              <label><input type="radio" name="start-device-input" value="${escapeHtml(p.id)}" ${p.id === deviceInputId ? 'checked' : ''}> NANOCORE replies</label>
              <label><input type="checkbox" data-port-controller="${escapeHtml(p.id)}" ${controllers.has(p.id) && p.id !== deviceInputId ? 'checked' : ''}> Controller</label>
            </div>
          </div>`).join('') : '<p class="muted small">No MIDI inputs found.</p>'}
          <div class="row-actions"><button class="primary" data-start="save-ports">Save ports</button><button data-start="refresh-ports">Refresh ports</button></div>
        ` : '<p class="muted small">Scan MIDI devices (or connect) to see the available ports.</p>'}
        <p class="muted small">Last device reply: ${escapeHtml(ctx.lastReply ?? 'none')}</p>
      </section>

      <section class="card start-step">
        <h3>3. MIDI settings</h3>
        <div class="field"><label>MIDI channel</label><input data-setting="midiChannel" onchange="window.__nanocoreCtx.setGlobalSetting('midiChannel', this.value)" type="number" min="1" max="16" value="${globals.midiChannel ?? 1}"></div>
        <div class="field"><label>Preset recall</label><select data-setting="recallMethod" onchange="window.__nanocoreCtx.setGlobalSetting('recallMethod', this.value)">
          <option value="cc" ${globals.recallMethod !== 'pc' ? 'selected' : ''}>CC 0 / CC 32 / Program Change</option>
          <option value="sysEx" ${globals.recallMethod === 'sysEx' ? 'selected' : ''}>SysEx field 09</option>
        </select></div>
        <div class="field"><label>Firmware</label><select data-setting="firmware" onchange="window.__nanocoreCtx.setGlobalSetting('firmware', this.value)">
          ${['auto', '1.10', '1.11', '1.12', '1.2', '1.3.5', '1.2-modified'].map((v) => `<option value="${v}" ${globals.firmware === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select></div>
        <p class="muted small">Footswitch, scene, expression and tap-tempo triggers are configured in Globals.</p>
        <button data-start="globals">Open Globals</button>
      </section>

      <section class="card start-step">
        <h3>4. Names from the pedal</h3>
        <p class="muted small">Fetched once on connect so the pedal is not flooded. When the names are in, the Editor opens automatically.</p>
        <div class="row-actions">
          <button class="primary" data-start="fetch-all" ${ctx.connected && !catalog.busy ? '' : 'disabled'}>${catalog.busy ? 'Fetching…' : 'Fetch all'}</button>
          <button data-start="fetch-presets" ${ctx.connected && !catalog.busy ? '' : 'disabled'}>Preset names</button>
          <button data-start="fetch-amp" ${ctx.connected && !catalog.busy ? '' : 'disabled'}>Amp names</button>
          <button data-start="fetch-ir" ${ctx.connected && !catalog.busy ? '' : 'disabled'}>Cab names</button>
        </div>
        <p class="muted small">Presets: <b>${catalog.presets}</b> · Amp models: <b>${catalog.amp}</b> · IR models: <b>${catalog.ir}</b></p>
        <p class="muted small">${escapeHtml(catalog.message || 'No fetch has been run yet in this session.')}</p>
      </section>
    </div>
    ${ctx.connected ? `<div class="row-actions" style="margin-top:14px">
      <button class="primary" data-start="editor">Continue to Editor</button>
      <button data-start="live">Open Live view</button>
      ${ctx.demo ? '<button data-start="exit-demo">Exit demo mode</button>' : ''}
    </div>` : ''}`;
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-start]');
  const ctx = startCtx ?? window.__nanocoreCtx;
  if (!button || !ctx) return;
  switch (button.dataset.start) {
    case 'demo': return ctx.connect('demo');
    case 'exit-demo': return ctx.exitDemo();
    case 'connect': return ctx.connected ? ctx.disconnect() : ctx.connect();
    case 'scan': return ctx.scanPorts();
    case 'read': return ctx.readSnapshot();
    case 'save-ports': {
      const deviceInputId = document.querySelector('input[name="start-device-input"]:checked')?.value ?? null;
      const enabledInputIds = [...document.querySelectorAll('[data-port-controller]:checked')]
        .map((el) => el.dataset.portController).filter((id) => id !== deviceInputId);
      ctx.setPortSelection({
        deviceInputId,
        deviceOutputId: document.querySelector('[data-port-output]')?.value ?? ctx.ports.outputId ?? null,
        enabledInputIds,
      });
      ctx.notify('MIDI port selection saved in this browser');
      return;
    }
    case 'refresh-ports': return ctx.render();
    case 'fetch-all': return ctx.refreshCatalog('all');
    case 'fetch-presets': return ctx.refreshCatalog('presets');
    case 'fetch-amp': return ctx.refreshCatalog('amp');
    case 'fetch-ir': return ctx.refreshCatalog('ir');
    case 'editor': return ctx.setMode('editor');
    case 'live': return ctx.setMode('live');
    case 'globals': return document.querySelector('#open-globals')?.click();
    default: return undefined;
  }
});
