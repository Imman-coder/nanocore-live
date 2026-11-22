# NANOCORE Live + Editor

A standalone web app for the Livtra NANOCORE that adds the "stomp / expression" layer the pedal lacks: real footswitches and expression pedals connect to the browser, and the browser translates their MIDI messages into NANOCORE CC / SysEx messages. Bindings stay in the browser; the preset itself stays on the pedal.

Unofficial and independent. Not endorsed by Livtra.

## Run

```bash
cd /home/anvi/Projects/nanocore-live
node server.js          # http://localhost:8123
npm test                # 93 node:test assertions, no dependencies
```

`localhost` is a secure context, so Web MIDI works without HTTPS. For a phone/tablet on the network, serve over HTTPS — Web MIDI will not work over plain HTTP from a remote host.

Browser support: Chrome/Edge/Opera have Web MIDI; Firefox desktop 108+; Safari has no native Web MIDI (a macOS Safari extension exists for 18.4+). iOS Safari is unsupported. Direct Web Bluetooth needs Chrome/Edge on desktop or Android.

## Modes

A preset is always a **NANOCORE preset** on the device. Only its MIDI assignments live in this browser, keyed by the visible preset number. On connect, and only then, the app reads the preset-name catalog (`0x40`) and the amp/IR slot names (`0x30`/`0x36`, `0x50`/`0x56`) — a slow AMP info reply is allowed 3 seconds; if `0x30` fails entirely the app falls back to the snapshot variant and fetches that slot's name via `0x36`; normally the active AMP/IR slot comes from `0x30`/`0x50` bytes 16–17, not from the snapshot variant. Nothing re-fetches the *name lists* while editing or switching presets; changing an amp/IR model updates the visible label locally and only sends SysEx. When a preset recall changes the active preset, the app re-reads only the two active-slot numbers (`0x30`/`0x50`) and swaps the displayed AMP/CAB names from the list it already has. Both dropdowns show real names like "7 · TightRhy" instead of bare numbers. Slot records follow the standalone reader in `nanocore-controller/docs/fetch-amp-ir-names.py`: the reply's slot number is checked against the request, the name stops at the first `00`/`ff` byte, and replies are matched by sequence **and** opcode.

- **Editor** — reads the pedal's `0x63` runtime snapshot and shows the FX blocks as a **horizontal strip in the device's chain order**, with arrows between them. AMP/CAB have no static model list: their dropdowns are built entirely from the pedal's `0x36`/`0x56` slot names, and selecting one sends only the documented SysEx field `0x06`/`0x07` (CC43/44 are skipped — ineffective on 1.10, redundant on 1.11). FX type lists are filtered by the firmware selected in Globals. The first block is selected by default; selecting a row populates the detail container below with that block's on/off switch, type, parameters, a radio choice of one of four virtual footswitches (or none), and a badge on each parameter that has a pedal assigned. Sliders send CC messages live; AMP/CAB model changes also send the `0x6d` SysEx fields `0x06`/`0x07`. **Right-click a parameter** to open the pedal popup: pick one of four expression pedals, set/learn its incoming MIDI message, set the input min/max window and invert, or remove the assignment. **Save to pedal** uses opcode `0x46` and asks for confirmation first — back up a preset you care about in the upstream editor.
- **Live** — a focused performance view of the current NANOCORE preset: large virtual footswitches and expression meters only. No editing here. "Show parameter assignments" reveals the raw IN → OUT table. Its preset dropdown recalls a NANOCORE preset by name and loads that preset's assignments.

Constraints enforced in the store: each block has at most one footswitch, each parameter has at most one pedal, and a pedal already used by another parameter is refused with a message naming its owner. Footswitch/pedal *incoming messages* are configured in Globals (the parameter popup also has a Learn button). Expression values are clamped to the configured window and linearly remapped onto the parameter's full CC range.

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

Footswitch and expression-pedal trigger messages are configured centrally (one incoming CC/PC/note each). **Learn** arms the router and captures the next message from a real pedal. The **firmware** selector (Auto, 1.10, 1.11, 1.12, 1.2, 1.3.5, 1.2-modified) controls which FX types are offered. 1.2 adds the new peak/parallel comp, wah and delay types; `1.2-modified` swaps FX2 pitch (id 8) for the 11-control Octave, MOD Velvet Vibrato for UniVibe, and FX2 Range (id 5) for Pitch (±24 st) on 1.12+. Type IDs and ranges for the 17 new effects follow the hardware-confirmed catalogue in `docs/FIRMWARE_VERSION_HISTORY.md`. Controls whose CC is unknown are written with SysEx field `0x01` (effect index, parameter index, float32 normalized) and marked "CC unknown": older firmware hides the later MOD types (10, 11, 12, 17) and FX2 Motion Wah (11). Auto uses the settings-layout byte from `0x65` as a hint (layout 2 → newer list); override it if the hint is wrong. MIDI channel, preset-recall method, and JSON import/export also live here.

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
index.html, styles.css, server.js
src/core/      scaling, messages, spec, snapshot, router, store  (pure, tested)
src/transports/webmidi.js, webbluetooth.js
src/ui/        app.js, editor.js, live.js, globals.js
tests/         node:test suites for all pure logic + both transports
src/data/      effect parameter definitions transliterated from the upstream editor
docs/          the two source documents
```

No build step, no dependencies.
