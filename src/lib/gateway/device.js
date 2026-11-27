// Device-facing gateway: request/reply, snapshot application, metadata reads.
// All shared mutable state lives on the runtime passed in by engine.js.
import { buildRequestSysEx, parseSysEx, isDevicePush, COMMAND } from '../../core/messages.js';
import { parseSnapshot } from '../../core/snapshot.js';
import {
  COMMAND as CAT, parsePresetCatalog, parseStorageInfo, parseSlotInfo, parseGlobalSettings, activeSlotFor,
} from '../../core/catalog.js';
import { assignmentsFor, setActivePreset, setBase, setPresetNames } from '../../core/store.js';
import { captureBase } from '../../core/base.js';

export function createDeviceGateway(rt) {
  const pendingKey = (sequence, command) => `${sequence}:${command}`;

  function send(bytes, key) {
    // The simulator does not need hardware pacing: skipping the output queue
    // keeps catalog reads instant even when the browser throttles background tabs.
    if (rt.isDemo()) {
      try {
        if (!rt.transport) throw new Error('Demo pedal is not running');
        rt.transport.send(bytes);
        return Promise.resolve(1);
      } catch (error) {
        return Promise.reject(error);
      }
    }
    return rt.scheduler.send(bytes, key);
  }

  function sendRequest(command, payload = [], timeout = 3000) {
    const seq = rt.sequence++ & 0xff;
    const bytes = buildRequestSysEx(command, payload, seq);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        rt.pending.delete(pendingKey(seq, command));
        reject(new Error(`No reply to opcode 0x${command.toString(16)} (last device reply: ${rt.lastReply ?? 'none'})`));
      }, timeout);
      rt.pending.set(pendingKey(seq, command), { resolve, reject, timer });
      Promise.resolve(send(bytes)).catch((error) => {
        clearTimeout(timer);
        rt.pending.delete(pendingKey(seq, command));
        reject(error);
      });
    });
  }

  function settle(sequence, command, frame, error) {
    const key = pendingKey(sequence, command);
    const waiter = rt.pending.get(key);
    if (!waiter) return;
    rt.pending.delete(key);
    clearTimeout(waiter.timer);
    if (error) waiter.reject(error); else waiter.resolve(frame);
  }

  function syncPresetFromDevice() {
    if (!rt.snapshot) return;
    const visible = rt.snapshot.activePreset + 1;
    if (rt.state.activePreset !== visible) {
      rt.state = setActivePreset(rt.state, visible);
      rt.saveWorkingState();
    }
  }

  function applySnapshot(parsed) {
    const presetChanged = rt.lastSnapshotPreset !== null && rt.lastSnapshotPreset !== parsed.activePreset;
    rt.lastSnapshotPreset = parsed.activePreset;
    rt.snapshot = parsed;
    const basePreset = parsed.activePreset + 1;
    if (!Object.keys(assignmentsFor(rt.state, basePreset).base?.values ?? {}).length) {
      const captured = captureBase(parsed.blocks);
      rt.state = setBase(rt.state, basePreset, captured.values, captured.enabled);
      rt.persist();
    }
    const now = Date.now();
    for (const block of rt.snapshot.blocks) {
      const override = rt.localEnabled.get(block.id);
      if (!override) continue;
      if (now - override.at < 3000) block.enabled = override.on;
      else rt.localEnabled.delete(block.id);
    }
    syncPresetFromDevice();
    for (const block of rt.snapshot.blocks) rt.router.setBlockState(block.id, block.enabled);
    rt.render();
    if (presetChanged) refreshActiveAssets();
  }

  async function refreshActiveAssets() {
    for (const kind of ['amp', 'ir']) {
      const blockId = kind === 'amp' ? 'amp' : 'cab';
      let active = null;
      try {
        const command = kind === 'amp' ? CAT.AMP_INFO : CAT.IR_INFO;
        active = parseStorageInfo((await sendRequest(command, [], 3000)).payload).activeSlot;
      } catch (error) {
        rt.log(`${kind} active slot: ${error.message}`);
        active = rt.snapshot?.blocks.find((b) => b.id === blockId)?.variant ?? null;
      }
      if (Array.isArray(rt.names[kind]) && Number.isInteger(active) && active >= 0 && active < rt.names[kind].length) {
        rt.names[`${kind}Active`] = active;
      }
    }
    rt.render();
  }

  function handleDeviceMessage(message) {
    if (isDevicePush(message.bytes)) {
      rt.onHardwarePush?.(message.bytes);
      return;
    }
    const raw = parseSysEx(message.bytes);
    if (!raw || raw.direction !== 0x71) {
      rt.log(`← ignored: ${[...message.bytes].slice(0, 8).map((b) => b.toString(16)).join(' ')}`);
      return;
    }
    rt.log('← ' + [...message.bytes].map((b) => b.toString(16).padStart(2, '0')).join(' '));
    rt.lastReply = `opcode 0x${raw.command.toString(16)} status 0x${raw.status.toString(16)} seq ${raw.sequence}`;
    let frame;
    try {
      frame = rt.assembler.feed(raw);
    } catch (error) {
      rt.log(`streamed reply: ${error.message}`);
      settle(raw.sequence, raw.command, null, error);
      return;
    }
    if (!frame) return;
    if (frame.status !== 0) {
      rt.log(`device error: opcode 0x${frame.command.toString(16)} status 0x${frame.status.toString(16)}`);
      settle(frame.sequence, frame.command, null, new Error(`Device returned status 0x${frame.status.toString(16)}`));
      return;
    }
    settle(frame.sequence, frame.command, frame);
    if (frame.command === COMMAND.GET_SNAPSHOT) {
      try { applySnapshot(parseSnapshot(frame.payload)); }
      catch (error) { rt.log(`snapshot: ${error.message}`); }
    }
  }

  async function readSnapshot() {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const reply = await sendRequest(COMMAND.GET_SNAPSHOT, []);
        applySnapshot(parseSnapshot(reply.payload));
        rt.notify(attempt > 1 ? `Snapshot read on attempt ${attempt}` : `Snapshot read: preset ${rt.snapshot.activePreset + 1}`);
        return rt.snapshot;
      } catch (error) {
        lastError = error;
        rt.log(`snapshot attempt ${attempt}: ${error.message}`);
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
    rt.notify(`Could not read parameters: ${lastError?.message ?? 'unknown error'}`);
    return null;
  }

  function presetLabel(number) {
    return assignmentsFor(rt.state, number).name || `Preset ${number}`;
  }

  async function loadPresetNames() {
    const found = new Map();
    for (let start = 0; start < 64; start += 6) {
      try {
        const reply = await sendRequest(CAT.PRESET_CATALOG, [start, 6]);
        const entries = parsePresetCatalog(reply.payload);
        entries.forEach((entry) => found.set(entry.slot, entry.name));
        if (entries.length < 6) break;
      } catch (error) {
        rt.log(`preset catalog at ${start}: ${error.message}`);
        break;
      }
    }
    rt.state = setPresetNames(rt.state, found);
    rt.saveWorkingState();
    rt.catalog.presets = found.size;
    rt.render();
  }

  async function loadAssetNames(kind) {
    if (rt.names[kind]) return rt.names[kind];
    const infoCommand = kind === 'amp' ? CAT.AMP_INFO : CAT.IR_INFO;
    const slotCommand = kind === 'amp' ? CAT.AMP_SLOT_INFO : CAT.IR_SLOT_INFO;
    const blockId = kind === 'amp' ? 'amp' : 'cab';
    let slotCount = kind === 'amp' ? 38 : 30;
    let storageActive = null;
    const snapshotVariant = rt.snapshot?.blocks.find((b) => b.id === blockId)?.variant ?? null;

    try {
      const info = parseStorageInfo((await sendRequest(infoCommand, [], 3000)).payload);
      slotCount = info.slotCount;
      if (kind === 'amp') slotCount = Math.min(slotCount, 30);
      storageActive = info.activeSlot;
    } catch (error) {
      rt.log(`${kind} info: ${error.message} (using defaults)`);
    }

    const activeSlot = activeSlotFor(storageActive, snapshotVariant, slotCount);
    rt.names[`${kind}Active`] = activeSlot;
    const list = new Array(slotCount).fill(null);
    rt.names[kind] = list;
    let lastSlotError = null;
    let failuresLogged = 0;

    async function readSlot(slot) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const reply = await sendRequest(slotCommand, [slot], 1500);
          return parseSlotInfo(reply.payload, slot).name || null;
        } catch (error) {
          lastSlotError = error.message;
        }
      }
      return null;
    }

    const first = activeSlot ?? 0;
    list[first] = (await readSlot(first)) ?? `Slot ${first}`;
    rt.render();
    for (let slot = 0; slot < slotCount; slot++) {
      if (slot === first) continue;
      list[slot] = (await readSlot(slot)) ?? `Slot ${slot}`;
      if (list[slot].startsWith('Slot ') && failuresLogged < 3) {
        rt.log(`${kind} slot ${slot}: ${lastSlotError ?? 'empty name'}`);
        failuresLogged++;
      }
      rt.render();
    }
    rt.catalog[kind] = list.filter(Boolean).length;
    rt.render();
    return list;
  }

  function refreshAssetNames(kind) {
    rt.names[kind] = null;
    return loadAssetNames(kind);
  }

  async function refreshCatalog(which = 'all') {
    if (rt.catalog.busy) return rt.notify('A name fetch is already running');
    if (!rt.transport) throw new Error('Connect to the NANOCORE first');
    rt.catalog.busy = true;
    rt.catalog.message = `Fetching ${which === 'all' ? 'all names' : which}…`;
    rt.render();
    try {
      if (which === 'all' || which === 'presets') await loadPresetNames();
      if (which === 'all' || which === 'amp') await refreshAssetNames('amp');
      if (which === 'all' || which === 'ir') await refreshAssetNames('ir');
      rt.catalog.message = `Fetched ${rt.catalog.presets} presets, ${rt.catalog.amp} amps, ${rt.catalog.ir} IRs`;
      rt.notify(rt.catalog.message);
      rt.finishSetup();
    } catch (error) {
      rt.catalog.message = `Fetch failed: ${error.message}`;
      rt.notify(rt.catalog.message);
    } finally {
      rt.catalog.busy = false;
      rt.render();
    }
  }

  return {
    send, sendRequest, settle, applySnapshot, handleDeviceMessage, readSnapshot, presetLabel,
    loadPresetNames, loadAssetNames, refreshAssetNames, refreshCatalog,
  };
}
