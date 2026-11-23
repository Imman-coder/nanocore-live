// Device picker: choose which MIDI port is the NANOCORE and which are controllers.
let ctxRef = null;

const devicesRoot = () => document.querySelector('[data-devices-root]');
export const initDevices = (ctx) => { ctxRef = ctx; };
export const devicesBody = (ctx) => body(ctx);

function refreshDevices() {
  const root = devicesRoot();
  if (root && ctxRef) root.innerHTML = body(ctxRef);
  else openDevices(ctxRef);
}

export function openDevices(ctx) {
  ctxRef = ctx;
  const modal = document.querySelector('#modal');
  modal.hidden = false;
  modal.innerHTML = `<div class="modal-box" data-devices-root>
    <div class="modal-head"><h2>MIDI devices</h2><button class="small" data-dev="close">Close</button></div>
    ${body(ctx)}
  </div>`;
}

function body(ctx) {
  const ports = ctx.ports;
  const devicePorts = ctx.devicePorts;
  const selection = ctx.state.globals.portSelection ?? {};
  const deviceInputId = selection.deviceInputId ?? ports.inputs.find((p) => p.role === 'device')?.id ?? '';
  const deviceOutputId = selection.deviceOutputId ?? ports.outputId ?? '';
  const enabled = new Set(selection.enabledInputIds ?? ports.inputs.filter((p) => p.role === 'controller').map((p) => p.id));
  const isWebMidi = ctx.devicePorts.outputs.some((p) => p.type === 'output');

  return `${!(ctx.ports.inputs.length || ctx.connected) ? '<p class="muted">Scan MIDI devices or connect first to see the available ports.</p>' : `
      <h3>Send to NANOCORE</h3>
      ${isWebMidi
        ? devicePorts.outputs.map((p) => `<label class="field">
            <input type="radio" name="dev-output" value="${p.id}" ${p.id === deviceOutputId ? 'checked' : ''}>
            ${escapeHtml(p.name)} <span class="muted small">${p.id}</span></label>`).join('')
        : `<p class="muted small">Direct Bluetooth output (${escapeHtml(devicePorts.outputs[0]?.name ?? 'BLE NANOCORE')}) — fixed.</p>`}
      <h3>Receive from</h3>
      <p class="muted small">Exactly one input should be the NANOCORE's reply port. Every other port you enable is treated as a footswitch / expression controller.</p>
      ${ports.inputs.length ? ports.inputs.map((p) => `<div class="port-row">
        <div class="port-id" title="${escapeHtml(p.name)} · ${escapeHtml(p.id)}">
          <b>${escapeHtml(p.name)}</b><span class="muted small">${escapeHtml(p.id)}</span>
        </div>
        <div class="port-roles">
          <label><input type="radio" name="dev-input" value="${p.id}" ${p.id === deviceInputId ? 'checked' : ''}> NANOCORE replies</label>
          <label><input type="checkbox" data-dev-role="${p.id}" ${enabled.has(p.id) && p.id !== deviceInputId ? 'checked' : ''}> Controller input</label>
        </div>
      </div>`).join('') : '<p class="muted small">No MIDI inputs found.</p>'}
      <div class="field" style="margin-top:14px">
        <button class="primary" data-dev="save">Save device selection</button>
        <button data-dev="refresh">Refresh ports</button>
        <button data-dev="read">Read snapshot now</button>
      </div>
      <p class="muted small">Last device reply: ${escapeHtml(ctx.lastReply ?? 'none')}</p>
      <p class="muted small">If the editor is blank after a recall, check that the NANOCORE input is set to "NANOCORE replies" and press Read snapshot now.</p>
    `}`;
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-dev]');
  if (!button || !ctxRef) return;
  const root = devicesRoot() ?? document;
  switch (button.dataset.dev) {
    case 'close':
      document.querySelector('#modal').hidden = true;
      document.querySelector('#topbar-menu').hidden = true;
      break;
    case 'save': {
      const radio = root.querySelector('input[name="dev-input"]:checked');
      const output = root.querySelector('input[name="dev-output"]:checked');
      const deviceInputId = radio?.value ?? null;
      const enabledInputIds = [...root.querySelectorAll('[data-dev-role]:checked')]
        .map((el) => el.dataset.devRole)
        .filter((id) => id !== deviceInputId);
      const selection = {
        deviceInputId,
        deviceOutputId: output?.value ?? ctxRef.ports.outputId ?? null,
        enabledInputIds,
      };
      ctxRef.setPortSelection(selection);
      refreshDevices();
      ctxRef.notify('Device selection saved in this browser');
      break;
    }
    case 'refresh':
      refreshDevices();
      break;
    case 'read':
      ctxRef.readSnapshot();
      break;
  }
});
