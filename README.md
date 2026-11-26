# NANOCORE Live + Editor

A standalone web app for the Livtra NANOCORE that adds the "stomp / expression" layer the pedal lacks: real footswitches and expression pedals connect to the browser, and the browser translates their MIDI messages into NANOCORE CC / SysEx messages. Bindings stay in the browser; the preset itself stays on the pedal.

Unofficial and independent. Not endorsed by Livtra.

## Run

```bash
cd /home/anvi/Projects/nanocore-live
npm install
npm run dev             # Vite dev server
npm test                # node:test assertions, no test dependencies
npm run build           # Svelte bundle + generated service worker in dist/
npm start               # serves dist/ when built, otherwise the source tree
```

The UI is Svelte 4 + Vite, styled with Tailwind CSS through PostCSS. `src/app.css` contains only the three Tailwind directives; all styling is inline Tailwind utility classes in the Svelte components (no `<style>` blocks or custom CSS layers). `src/lib/engine.js` keeps the original state/transport/protocol logic and exposes an `app` store plus `ctx` actions; `src/lib/components/` contains the views. `src/core/**`, `src/data/**` and `src/transports/**` are shared unchanged. Firmware-specific FX parameters are explicit tables: one file per version in `src/data/firmware/original/`. Community patches live in `src/data/firmware/patches.js`; the `modified/` files combine an original with UniVibe (mandatory) and, for 1.12+, optional Octave. Selectors like `1.12+uv+oct` are defined in `src/core/versions.js`. Edit those files directly, not `src/core/versions.js`.

`localhost` is a secure context, so Web MIDI works without HTTPS. For a phone/tablet on the network, serve over HTTPS — Web MIDI will not work over plain HTTP from a remote host.

## Install

Open the app in Chrome/Edge, then use the browser menu's **Install app** / **Add to Home screen**. The manifest declares `display: standalone`, the 192 px and 512 px icons are in `icons/`, and `sw.js` is generated from every file in `dist/` by `npm run build` (no hand-maintained SHELL list), so online loads stay fresh and offline loads serve the cached shell. Online it fetches fresh assets and refreshes the cache; with no internet it serves the cached shell, so the installed app — including demo mode — still opens. Load it once while online before going offline. Installation requires a secure context (localhost or HTTPS). A test checks that every local import resolves and that the generated worker keeps network-first/cache-fallback behaviour.

The top bar has a fullscreen toggle (⛶ / ⤡) for an uncluttered performance view. Tap **TAP** in the top bar (or the virtual button in Live) to set BPM; the top bar shows the BPM and time signature. MOD writes use the documented CCs (or per-parameter SysEx for SysEx-only controls and when FX2 pitch/wah owns CC68-73). Extra "Level" knobs that the pedal does not store are no longer shown. Globals controls the subdivision, the delay-sync switch, and the tap-tempo MIDI trigger (default CC 87, changeable or Learn-able like the stomps and scenes). The NANOCORE has no tap-tempo feature of its own, so the browser writes the computed Time/Delay milliseconds through the normal parameter path. In the Editor, any block with a Time/Delay knob (normally Delay) has a per-preset **Sync with tempo** switch; enabling it hides that knob and shows a delay subdivision (quarter, eighth, dotted eighth, sixteenth...), and only opted-in blocks are written when the tempo changes.

If **Web MIDI not available** appears, open the menu to see detected capabilities. Web MIDI needs HTTPS/localhost and a Chromium browser (Chrome for Android works); Firefox for Android, Safari and plain HTTP do not. When Direct Bluetooth is available the app switches the transport selector to it automatically.

Browser support: Chrome/Edge/Opera have Web MIDI; Firefox desktop 108+; Safari has no native Web MIDI (a macOS Safari extension exists for 18.4+). iOS Safari is unsupported. Direct Web Bluetooth needs Chrome/Edge on desktop or Android.

## Demo mode (no pedal)

On Start, press **Try demo mode** (or choose *Demo mode (no pedal)* as the transport). An in-memory simulator answers the same SysEx requests and CC writes as the pedal, so the normal snapshot reader, catalog fetch, Editor and Live views all run without hardware or MIDI permissions. It ships with 64 example preset names, 30 amp and 30 cab names, and a plausible starting patch. Knobs, stomps, scenes, preset recall and layout editing all work locally; **Save to pedal** is disabled and **Save name to pedal** only edits the browser copy. A **DEMO** badge and green status mark the active session. **Exit demo mode** is on the Start page and in Settings → Connection; the previous transport selection is restored. Demo data is illustrative, not a hardware-verified preset.

By default demo edits are sandboxed: a deep copy of your saved settings/assignments/layout is used in memory and nothing is written to this browser's storage. Settings → Connection has a **Use my actual saved settings and data in demo** checkbox, shown only while demo is running. Turning it on reloads the saved data and lets edits persist in the browser; turning it off re-sandboxes from the saved data. Exiting demo always returns to the saved data, so sandbox experiments never change it.

## Modes

A preset is always a **NANOCORE preset** on the device. Only its MIDI assignments live in this browser, keyed by the visible preset number. On connect, and only then, the app reads the preset-name catalog (`0x40`) and the amp/IR slot names (the amp selector shows the 30 user-facing models; slot-info replies longer than 30 bytes are accepted) (`0x30`/`0x36`, `0x50`/`0x56`) — a slow AMP info reply is allowed 3 seconds; if `0x30` fails entirely the app falls back to the snapshot variant and fetches that slot's name via `0x36`; normally the active AMP/IR slot comes from `0x30`/`0x50` bytes 16–17, not from the snapshot variant. The Editor can also rename the active pedal preset: enter up to 8 printable ASCII characters and press **Save name to pedal**, which writes live field `0x08` and then commits with `0x46` after confirmation. Nothing re-fetches the *name lists* while editing or switching presets; changing an amp/IR model updates the visible label locally and only sends SysEx. When a preset recall changes the active preset, the app re-reads only the two active-slot numbers (`0x30`/`0x50`) and swaps the displayed AMP/CAB names from the list it already has. Both dropdowns show real names like "7 · TightRhy" instead of bare numbers. Slot records follow the standalone reader in `nanocore-controller/docs/fetch-amp-ir-names.py`: the reply's slot number is checked against the request, the name stops at the first `00`/`ff` byte, and replies are matched by sequence **and** opcode.

- **Start** — the default landing page, with every setup task in one place: transport selection (Web MIDI or direct Web Bluetooth), connect/disconnect, NANOCORE and controller port selection, MIDI channel / preset-recall method / firmware, and explicit buttons to fetch preset names, amp names and IR names (plus the automatic once-on-connect fetch, which then opens the Editor). Trigger configuration remains in Globals. Audit against `docs/NANOCORE-MIDI-Control-User-Guide.pdf`: every implemented base parameter already uses the guide's CC number. The guide also documents MOD Level (CC70-73) and FX2 Envelope Wah Level (CC72), but those were verified absent/non-functional on the hardware, so they stay omitted rather than generating rejected writes; CC80/81/82 (tuner, preset step) are guide-only globals that this app does not wire.
- **Editor** — reads the pedal's `0x63` runtime snapshot and shows the FX blocks as a **horizontal strip in the device's chain order**, with arrows between them. AMP/CAB have no static model list: their dropdowns are built entirely from the pedal's `0x36`/`0x56` slot names, and selecting one sends only the documented SysEx field `0x06`/`0x07` (CC43/44 are skipped — ineffective on 1.10, redundant on 1.11). FX type lists are filtered by the firmware selected in Globals. The first block is selected by default; selecting a row populates the detail container below with that block's on/off switch, type, parameters and a five-step knob for choosing one of four virtual footswitches (or None). Parameters are draggable rotary knobs (arrow keys also work) with a badge showing any assigned expression pedal; the knob grid auto-fits the available width and the layout switches to a stacked sidebar on phones and tablets. Drag a chain row over another to preview the new signal path live — the other blocks slide into place with a FLIP animation. Touch and pen work the same way: press and move a row (no HTML5 drag events needed), vertical page scrolling still works, and cancelling the gesture restores the previous order. Dropping commits it with SysEx field `0x05` and a snapshot re-read. The arrows between blocks stay static. Sliders send CC messages live; AMP/CAB model changes also send the `0x6d` SysEx fields `0x06`/`0x07`. **Right-click a parameter** to open the pedal popup: pick one of four expression pedals, set/learn its incoming MIDI message, set the input min/max window and invert, or remove the assignment. **Save to pedal** uses opcode `0x46` and asks for confirmation first — back up a preset you care about in the upstream editor.
- **Live** — a configurable performance surface built on a CSS grid of individual display items — expand rows/columns, place any single scene/stomp/expression/tap item in a cell, and drag a tile's right or bottom edge to span multiple cells like HTML `grid-column: span N` — a single scene, single stomp, tap tempo or one expression pedal bar; the editor itself mirrors the Live layout with stacked columns and side-by-side rows; press **Edit layout** in Live (or long-press the panel button) to arrange it inline on the same screen, including hiding the left sidebar. Each slot has a Stretch weight (1-6) for longer/shorter tracks along the container's active axis — width in a horizontal row, height in a column or a row that has flipped vertical, and a tall/narrow row automatically stacks vertically. **Fit everything to the screen** scales the whole board down uniformly to fit the available width and height above the log bar — nothing is clipped and nothing scrolls. Empty slots keep their fixed share of space. If the top bar runs out of width it hides the tempo cluster first, then the brand. The current NANOCORE preset: a scene row (Base / Scene 1 / Scene 2), large toggleable virtual footswitches, and all four expression pedals as cards with live meters and percentages, assigned or not. Globals has an **Interactive Live mode** switch; when enabled, an assigned pedal's meter can be dragged or arrow-keyed to send its mapped CC to the pedal. Each expression pedal can also enable **Full touch control in Live**, which replaces its thin meter with a large 72 px touch pad (touch-action disabled for reliable dragging) that works even when Interactive Live mode is off. Expression faders open at the current NANOCORE value of the parameter they control (or the preset volume when that pedal is assigned globally in Globals), including the configured pedal/parameter min-max windows and invert. Dragging is relative by default: the value slides from where you pressed without jumping; enable **Absolute expression faders** in Globals to make the touch position set the value directly. Vertical faders keep a minimum drag height in small cells. No preset editing here. "Show parameter assignments" reveals the raw IN → OUT table. Its preset dropdown recalls a NANOCORE preset by name and loads that preset's assignments.

Constraints enforced in the store: each block has at most one footswitch, each parameter has at most one pedal, and a pedal already used by another parameter is refused with a message naming its owner. A pedal assigned to preset volume in Globals is occupied globally: it appears as assigned in the Editor and cannot be selected for a parameter until Globals is cleared. Footswitch/pedal *incoming messages* are configured in Globals (the parameter popup also has a Learn button). Expression values are clamped to the configured window and linearly remapped onto the parameter's full CC range.

## Connection paths

Select one in the header:

1. **USB MIDI / paired Bluetooth MIDI** (`Web MIDI`) — `navigator.requestMIDIAccess({ sysex: true })`. Every input port is listened to at once, so several controllers can be active simultaneously. The NANOCORE output is auto-selected by name; individual inputs can be disabled. Hot-plug is handled by `onstatechange`.
2. **Direct Bluetooth** (`Web Bluetooth`) — connects to the BLE-MIDI service without OS pairing. Long SysEx is split using the BLE-MIDI timestamp/continuation scheme.

Controllers always come through Web MIDI, including when the pedal is on Direct Bluetooth; that way multiple controller ports work in either configuration. Whichever path is used, messages from the NANOCORE's own port go to the SysEx reply handler and are never fed back into the controller router.

## MIDI devices

The **MIDI devices** button opens a picker after connecting. It lists every MIDI input and output:

- **Send to NANOCORE** — choose the output port the app writes CC/SysEx to.
- **Receive from** — mark exactly one input as "NANOCORE replies" (SysEx replies and snapshot data), and mark any other inputs you want as "Controller input" (footswitches, expression pedals). Unchecked inputs are ignored.

The selection is saved in browser storage and re-applied on every connect. If a preset recalls but the editor stays blank, the reply port is usually wrong: open the picker, fix it, and press **Read snapshot now**. The header log shows the last opcode/status received, including streamed `0x10`/`0x11` chunk replies, which are reassembled before parsing.

## Globals

Footswitch and expression-pedal trigger messages are configured centrally (one incoming CC/PC/note each). **Learn** arms the router and captures the next message from a real pedal. The **firmware** selector (Auto, 1.10, 1.11, 1.12, 1.2, 1.3.5, 1.2-modified) controls which FX types are offered. 1.2 adds the new peak/parallel comp, wah and delay types; `1.2-modified` swaps FX2 pitch (id 8) for the 11-control Octave, MOD Velvet Vibrato for UniVibe, and FX2 Range (id 5) for Octave (±24 st) on 1.12+. Type IDs and ranges for the 17 new effects follow the hardware-confirmed catalogue in `docs/FIRMWARE_VERSION_HISTORY.md`. Controls whose CC is unknown are written with SysEx field `0x01` (effect index, parameter index, float32 normalized) : older firmware hides the later MOD types (10, 11, 12, 17) and FX2 Motion Wah (11). Auto uses the settings-layout byte from `0x65` as a hint (layout 2 → newer list); override it if the hint is wrong. MIDI channel, preset-recall method, and JSON import/export also live here.

## Scenes

The editor has **Base** plus up to five named scenes. Globals sets the total scene count (default 3, maximum 6); scene names are stored per NANOCORE preset and edited in the Editor. Extra scenes add matching MIDI scene switches (CC 84–89 by default). Base is captured from the pedal on the first sync of a preset, then saved in browser storage exactly like the other scenes — **Store** writes it without any override switch. Changing presets always returns the active scene to Base. Scenes also store each FX block's on/off state. Each block's Edit tab has a **Participate in scenes** switch: turn it off to hide the scenes there and exclude that block from both scene saves and recalls; previously saved values are kept and resume working when the switch is turned back on. Recalling compares against the pedal's current values and on/off states and sends only the differences. Three assignable scene switches in Globals (S1/S2/S3, default CC 84/85/86) recall Base/Scene 1/Scene 2 from a MIDI controller; each has a Learn button and a target dropdown. **All** writes to the pedal — knobs, stomps, presets and scenes — go through `src/core/scheduler.js`: no delay for CC writes (the pedal handles those best), a short 25 ms settle window for SysEx frames, and coalescing of repeated writes to the same target — including SysEx-only parameter sweeps — so a 50-step knob drag sends only the final value.


## Editor layout

The top bar keeps only the brand, Editor/Live switch, tempo controls, a connection-status chip, fullscreen and a ⚙ settings popup window (a centered modal with close button, backdrop click and Esc); its tabs are Connection (Scan MIDI devices, Connect, status, transport, Web MIDI hint and a bottom MIDI message bar toggle), MIDI devices and Globals, with each tab's Save button fixed at the bottom and only the content scrolling — the full contents of both former popups, now embedded rather than just links. Every page open starts on the setup screen; once the names are fetched it opens the Editor automatically. The Editor follows the compact layout of the reference images without copying their theme: a narrow left rail holds preset navigation, the preset list and preset volume; the main area shows the whole signal chain first, then a single contextual panel for the selected block. That panel groups expression mappings, stomp assignment, scenes and parameters into short rows. On tablets and phones the chain becomes a 4-column then 2-column grid so the full rig stays visible without horizontal scrolling.

## Protocol facts this app relies on

Taken from `docs/MIDI_MAPPING_NOTES.md` (hardware-verified) and `docs/midi-findings-and-mappings.txt` (evidence-graded, static analysis):

- On/off CCs 20/21/23/24/25/26/27/28; `0–63 = off`, `64–127 = on`, transmit 0 or 127. Type CCs 40/41/43/44/45/46/47/48 carry verbatim IDs.
- Parameter CC bases: FX1 50, FX2 drive/boost 57, FX2 pitch/wah 68, amp 60, cab 65, mod 68, delay 74, reverb 85, EQ 91. CC68–73 are shared between MOD and FX2 when FX2's type is 8–11.
- Continuous values scale linearly; enums use equal buckets; four-way LFO waves split at 0/32/64/96.
- AMP/CAB model selection and chain reorder are SysEx-only on firmware 1.10; 1.11 reportedly fixes CC43/44 (not verified here).
- Snapshot order is `fx1, fx2, amp, cab, del, mod, rev, eq` (MOD is displayed before DEL in the editor).
- SysEx: `F0 7D 4E 43 70/71 PACK(body) F7`, 7-bit packing in groups of seven; request body `02 | seq u16le | cmd u16le | len u16le | payload`.
- A Bank Select to a non-zero bank makes the pedal ignore all later Program Changes until CC0 and CC32 both return to 0; PC recall sends both zeroes first.
- Live writes are acknowledged before they appear in the snapshot; the app waits ~220 ms before reading back. Amp/IR writes need longer, which is why the editor avoids them.
- Empty presets can inherit the previous preset's amp/IR in live state; a save immediately after recall has once stored the wrong slots. Check before saving.

## Layout

```
index.html, server.js
src/main.js     Svelte entry
src/App.svelte, src/lib/components/   UI
src/lib/engine.js        gateway: transports, effects, stable ctx API
src/engine/              targets, pure resolver, dispatcher, selectors
src/core/                pure protocol, routing, snapshot, store (tested)
src/transports/          Web MIDI, BLE, demo
src/data/                effect definitions and per-version firmware tables
tests/                   node:test suites for pure logic and engine wiring
```

`npm run build` produces `dist/` and its generated service worker.
