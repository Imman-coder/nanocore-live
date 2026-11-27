// Transport and connection gateway. The engine owns the runtime; this module
// only orchestrates transports, demo isolation and setup.
import { COMMAND } from '../../core/messages.js';
import { parseGlobalSettings } from '../../core/catalog.js';
import { connectionHint } from '../../core/capabilities.js';
import { sandboxState, uiStateOf, withUiState } from '../../core/demoData.js';
import { createWebMidiTransport } from '../../transports/webmidi.js';
import { createWebBluetoothTransport } from '../../transports/webbluetooth.js';
import { createDemoTransport } from '../../transports/demo.js';

export function createConnectionGateway(rt) {
  function isDemo() { return rt.transport?.kind === 'demo'; }

  function workingStorage() {
    return isDemo() && !rt.demoUseRealData ? rt.demoStorage : rt.mainStorage;
  }

  function saveWorkingState() {
    rt.saveState(workingStorage(), rt.state);
  }

  function enterDemoData() {
    rt.demoState = sandboxState(rt.state);
    rt.state = rt.demoState;
    rt.demoUseRealData = false;
    rt.demoRequested = false;
    Object.assign(rt.routerGlobals, rt.state.globals);
  }

  function adoptMainState() {
    const ui = uiStateOf(rt.state);
    const real = rt.loadState(rt.mainStorage);
    if (real.globals?.transportKind === 'demo' && rt.transportBeforeDemo) {
      real.globals.transportKind = rt.transportBeforeDemo;
      rt.saveState(rt.mainStorage, real);
    }
    rt.state = withUiState(real, ui);
    Object.assign(rt.routerGlobals, rt.state.globals);
    rt.demoState = null;
    rt.demoUseRealData = false;
    rt.demoRequested = false;
    rt.transportBeforeDemo = null;
  }

  function setDemoUseRealData(enabled) {
    if (!isDemo() || Boolean(enabled) === rt.demoUseRealData) return;
    const ui = uiStateOf(rt.state);
    const real = rt.loadState(rt.mainStorage);
    rt.state = withUiState(real, ui);
    rt.demoUseRealData = Boolean(enabled);
    rt.persist();
    rt.notify(rt.demoUseRealData
      ? 'Demo now uses your saved data — edits will persist in this browser'
      : 'Demo is sandboxed again — saved settings are untouched');
    rt.render();
  }

  function applyPortSelection() {
    const selection = rt.state.globals.portSelection;
    if (selection && typeof rt.controllerTransport?.setSelection === 'function') {
      rt.controllerTransport.setSelection(selection);
    }
  }

  function finishSetup() {
    if (rt.state.mode !== 'start' || !rt.transport) return;
    rt.update({ mode: 'editor' });
    rt.notify('Setup complete — Editor is ready');
  }

  function autoFetchCatalog() {
    rt.catalog.busy = true;
    rt.catalog.message = 'Fetching names from the pedal…';
    rt.render();
    (async () => {
      try {
        const settings = parseGlobalSettings((await rt.device.sendRequest(COMMAND.GET_GLOBALS, [])).payload);
        if (rt.state.globals.settingsLayout !== settings.layout) {
          rt.state = { ...rt.state, globals: { ...rt.state.globals, settingsLayout: settings.layout } };
          rt.persist();
        }
        rt.log(`device settings layout ${settings.layout}`);
      } catch (error) { rt.log(`global settings: ${error.message}`); }
      await rt.device.loadPresetNames();
      await rt.device.loadAssetNames('amp');
      await rt.device.loadAssetNames('ir');
      rt.catalog.message = `Fetched ${rt.catalog.presets} presets, ${rt.catalog.amp} amps, ${rt.catalog.ir} IRs`;
      finishSetup();
    })().catch((error) => {
      rt.catalog.message = `Fetch failed: ${error.message}`;
      rt.log(`names: ${error.message}`);
    }).finally(() => {
      rt.catalog.busy = false;
      rt.render();
    });
  }

  function setTransportKind(kind) {
    if (!['webmidi', 'webbluetooth', 'demo'].includes(kind)) return;
    if (kind === 'demo' && !isDemo()) {
      if (!rt.transportBeforeDemo) {
        rt.transportBeforeDemo = rt.state.globals.transportKind && rt.state.globals.transportKind !== 'demo'
          ? rt.state.globals.transportKind : 'webmidi';
      }
      rt.demoRequested = true;
      rt.notify('Demo mode selected — press Connect or Try demo mode');
      rt.render();
      return;
    }
    if (kind !== 'demo' && !isDemo()) {
      rt.demoRequested = false;
      rt.transportBeforeDemo = null;
    }
    rt.update({ globals: { ...rt.state.globals, transportKind: kind } });
    if (kind !== 'demo') rt.notify(`Transport set to ${kind === 'webbluetooth' ? 'direct Bluetooth' : 'Web MIDI'}`);
  }

  function disconnect() {
    const wasDemo = isDemo();
    rt.transport?.disconnect();
    rt.controllerTransport?.disconnect();
    rt.transport = null;
    rt.controllerTransport = null;
    if (wasDemo) adoptMainState();
    rt.setStatus('Disconnected', false);
    rt.names.amp = null;
    rt.names.ir = null;
    rt.names.ampActive = null;
    rt.names.irActive = null;
    rt.catalog.presets = 0;
    rt.catalog.amp = 0;
    rt.catalog.ir = 0;
    rt.catalog.message = wasDemo
      ? 'Demo mode closed — no pedal was written to.'
      : 'Disconnected — nothing fetched in this session.';
    rt.render();
    rt.notify(wasDemo ? 'Demo mode closed' : 'Disconnected from the NANOCORE');
  }

  function exitDemo() {
    if (!isDemo()) return;
    disconnect();
    rt.update({ mode: 'start' });
    rt.notify('Back at Start — connect a pedal whenever you are ready');
  }

  async function scanPorts() {
    if ((rt.state.globals.transportKind ?? 'webmidi') === 'webbluetooth') {
      rt.notify('Direct Bluetooth ports appear only after connecting');
      return;
    }
    if (rt.controllerTransport?.kind !== 'webmidi') rt.controllerTransport = createWebMidiTransport();
    await rt.controllerTransport.scan();
    applyPortSelection();
    rt.render();
    rt.notify('MIDI devices listed — choose ports, then Connect');
  }

  async function connect(forcedKind) {
    const kind = forcedKind ?? (rt.demoRequested ? 'demo' : rt.state.globals.transportKind ?? 'webmidi');
    if (isDemo() && kind !== 'demo') adoptMainState();
    if (kind === 'demo' && !isDemo()) {
      if (!rt.transportBeforeDemo) {
        rt.transportBeforeDemo = rt.state.globals.transportKind && rt.state.globals.transportKind !== 'demo'
          ? rt.state.globals.transportKind : 'webmidi';
      }
      enterDemoData();
    } else if (kind !== 'demo') {
      rt.transportBeforeDemo = null;
    }
    const reuseScannedWebMidi = kind === 'webmidi' && rt.controllerTransport?.kind === 'webmidi' && !rt.controllerTransport.connected;
    try {
      rt.transport?.disconnect();
      if (!reuseScannedWebMidi) rt.controllerTransport?.disconnect();
      rt.names.amp = null;
      rt.names.ir = null;
      rt.names.ampActive = null;
      rt.names.irActive = null;
      if (kind === 'demo') {
        rt.transport = createDemoTransport();
        rt.controllerTransport = rt.transport;
      } else if (kind === 'webbluetooth') {
        rt.transport = createWebBluetoothTransport();
        rt.controllerTransport = createWebMidiTransport();
        try { await rt.controllerTransport.connect(); } catch (error) { rt.log(`controllers: ${error.message}`); }
      } else {
        rt.transport = rt.controllerTransport?.kind === 'webmidi' ? rt.controllerTransport : createWebMidiTransport();
        rt.controllerTransport = rt.transport;
      }
      await rt.transport.connect();
      rt.transport.onDeviceMessage(rt.device.handleDeviceMessage);
      rt.controllerTransport.onControllerMessage((m) => rt.router.handleMidi(m));
      rt.transport.onStateChange(rt.render);
      if (rt.controllerTransport !== rt.transport) rt.controllerTransport.onStateChange(rt.render);
      applyPortSelection();
      rt.setStatus(kind === 'demo' ? 'Demo mode (no pedal)' : `Connected (${rt.transport.kind})`, true);
      setTransportKind(kind);
      rt.log(kind === 'demo' ? 'demo pedal started (no hardware involved)' : `connected via ${rt.transport.kind}`);
      if (kind === 'demo') rt.notify('Demo mode — a simulated NANOCORE is ready');
      rt.render();
      await rt.device.readSnapshot();
      autoFetchCatalog();
    } catch (error) {
      rt.setStatus('Connection failed', false);
      if (/Web MIDI is not available/.test(error.message)) {
        rt.notify(connectionHint(rt.capabilities));
      } else {
        rt.notify(error.message);
      }
      rt.log(`connect: ${error.message}`);
    }
  }

  return {
    isDemo, workingStorage, saveWorkingState, enterDemoData, adoptMainState,
    setDemoUseRealData, applyPortSelection, finishSetup, autoFetchCatalog,
    setTransportKind, disconnect, exitDemo, scanPorts, connect,
  };
}
