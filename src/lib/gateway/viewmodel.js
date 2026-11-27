// Svelte view model. Split by update frequency so a knob sweep or expression
// tick does not re-render every panel in the app.
import { derived, writable } from 'svelte/store';

export const stateView = writable({});
export const snapshotView = writable(null);
export const feedbackView = writable({});
export const uiView = writable({
  status: 'Disconnected',
  connected: false,
  demo: false,
  demoUseRealData: false,
  transportKind: 'webmidi',
  lastReply: null,
  ports: { inputs: [], outputs: [] },
  devicePorts: { inputs: [], outputs: [] },
  capabilities: { secure: false, midi: false, bluetooth: false },
  firmware: 'auto',
  logLines: [],
  toast: null,
  names: { amp: null, ir: null, ampActive: null, irActive: null },
  catalog: { busy: false, message: '', presets: 0, amp: 0, ir: 0 },
});

// Compatibility aggregate for debugging and any external consumer. Components
// use the slice stores directly.
export const app = derived(
  [stateView, snapshotView, feedbackView, uiView],
  ([state, snapshot, expressionValues, ui]) => ({ ...ui, state, snapshot, expressionValues }),
);

export function publishState(state) { stateView.set(state); }
export function publishSnapshot(snapshot) { snapshotView.set(snapshot); }
export function publishFeedback(pedalId, value) {
  feedbackView.update((values) => ({ ...values, [pedalId]: value }));
}
export function publishUi(patch) { uiView.update((ui) => ({ ...ui, ...patch })); }
export function publishLog(logLines) { uiView.update((ui) => ({ ...ui, logLines: [...logLines] })); }
export function publishToast(toast) { uiView.update((ui) => ({ ...ui, toast })); }

export function publishAll({ state, snapshot, names, catalog, ui }) {
  stateView.set(state);
  snapshotView.set(snapshot);
  uiView.set({
    ...ui,
    names: { ...names },
    catalog: { ...catalog },
    logLines: [...(ui.logLines ?? [])],
  });
}
