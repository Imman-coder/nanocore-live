# NANOCORE MIDI mapping notes — findings, MIDI messages and SysEx messages

This is the single consolidated reference for everything this project has learned about the
NANOCORE's MIDI and SysEx behaviour: the documented channel-voice messages, the reverse-engineered
SysEx protocol, the measured/corrected parameter map, and the findings from hardware testing.
It replaces the standalone write-up of the upstream *NanoCore Editor*
(<https://github.com/lucanenni/livtra-nanocore-editor>, commit `fe742e2`), which this repository's
`web/` tree was copied from and which the web sources still reference.

Scope and conventions:

- **Documented** — from Livtra's `NANOCORE-User-Manual.pdf` / `NANOCORE-MIDI-Control-User-Guide.pdf`
  (firmware 1.04+, archived upstream in `docs/`; the originals are at
  <https://openparcelbox.com/manuals/>).
- **Verified** — checked on a real pedal. The developer's pedal reported firmware **1.10** on
  2026-10-08 (read from its settings screen); earlier sessions described it as 1.04 and the
  firmware-dependent notes below identify which behaviour belongs to which. Livtra's release notes
  (<https://livtramusic.com/downloads?device=NANOCORE>) list **1.11** as the latest: it fixes CC43/CC44
  for amp and IR switching, Pitch latency, a click when switching the FX2 drive, and Bluetooth
  advertising while powered off. Firmware updates are deliberately not installed or implemented.
- **Code** — read from the official ToneCommand app's native library (`liblivtra.so`) or firmware,
  not tested on hardware here.
- **Unknown** — not resolved. Open questions are collected in section 5.

Underlying primary sources in this repository: `docs/protocol.md` (SysEx protocol and measured
live-state behaviour), `docs/HARDWARE_VERIFICATION.md` (what was actually run on the pedal),
`docs/amp-ir-protocol.md` (amp/IR SysEx, from the app's library plus pedal verification),
`docs/calibration/` (raw measurements and the derived controller map),
`contrib/midi-router/README.md` (BOSS GT-10), and the implementations
`src/nanocore_controller/{midi,nanocore_protocol,mappings,ble_midi,usb_midi,sysex_query,assets_protocol}.py`,
`web/src/midi/{sysex,scaling,types}.ts`, `web/src/data/blocks/*.ts`, `web/src/store/routing.ts`.

---

## 1. Device and transports

### 1.1 USB MIDI

- The attached device enumerates as `Ember Nanocore` (`33c3:1301`) and exposes `Nanocore MIDI 1`.
- Reads, backups, saves and restores work over USB with the **same SysEx frames** as over Bluetooth
  (a raw status request `F0 7D 4E 43 70 ... 63 ... F7` returned the full runtime snapshot;
  `nanocore --transport usb status` read preset 7 "TightRhy", volume 83, amp slot 12 "MesR2",
  IR slot 2 "Eng412A" in 0.1 s).
- The control endpoint uses the ALSA raw MIDI device node (`/dev/snd/midiC<card>D<device>`;
  `amidi -l` only discovers the port). `preset` over USB sends a plain MIDI Program Change.
- The pedal's USB-C port is a **USB device** and its Bluetooth is a **peripheral**. A controller
  cannot be plugged into or paired with the pedal; a host must forward its messages
  (`contrib/midi-router/`; see 1.3).

### 1.2 BLE-MIDI

- Service: `03b80e5a-ede8-4b33-a751-6ce34ec4c700`
- MIDI data characteristic: `7772e5db-3868-4112-a1a9-f2669d106bf3`
- CCC descriptor observed at handle `0x0014`.
- Requires normal BLE pairing. With the pedal paired, subscribing *before* writing works reliably
  through Bleak on `hci1`; no empty handshake write is needed.
- The peripheral stops advertising after a while: it becomes discoverable again only after
  toggling Bluetooth off/on **on the pedal itself**. The official phone app force-pairs with the
  device and re-claims the connection, which made macOS pairing appear to fail; with the app
  closed, OS Bluetooth MIDI pairing works and the pedal appears as a normal MIDI port.
- `Nanocore Midi` is the control endpoint; `Nanocore Audio` (speakers) is a different thing.
- BLE-MIDI's default 20-byte packet is too short for the ~26-byte chain-order SysEx; the web
  transport splits long SysEx across packets using the BLE-MIDI continuation scheme
  (`web/src/midi/bleMidiPacket.ts`).
- The web editor also has a direct Web Bluetooth transport (`navigator.bluetooth.requestDevice()`
  filtered to the BLE-MIDI service UUID) that skips OS pairing; the "toggle on the device,
  nothing else holding the connection" caveats still apply.
- `dir` byte `0x72` is a third SysEx direction used for **unsolicited notifications** from the
  pedal (not otherwise decoded).

### 1.3 Routing a controller to the pedal

`contrib/midi-router/nanocore_midi_router.py` (standard library only) reads the controller through
the ALSA sequencer (`aseqdump`) and writes raw MIDI to the pedal; `--input-mode raw` opens the
controller's raw node instead. It waits for both ports and reconnects after an unplug.

| Controller sends | Pedal gets |
|---|---|
| Program Change `n` (bank 0) | Program Change `n`: preset `n + 1` |
| Bank Select (CC0 / CC32) | nothing — a non-zero bank makes the pedal ignore every later Program Change until bank 0 returns (measured) |
| a controller listed in `cc` | `pass`, `momentary`, `toggle` or `map` (expression pedal) |
| anything else | nothing |

`program_change.banks` offsets program numbers per bank; `program_change.max` (63) drops anything
past the last preset.

**BOSS GT-10, measured with `aseqdump`:** CTL1 = CC80 (tuner), CTL2 = CC81 (previous preset),
EXP SW = CC82 (127 on press, 0 on release; next preset), expression pedal = CC7, each patch change
sends CC0, CC32 and a Program Change numbered along the whole list (first page's number buttons 0-3,
next page 4-7); the bank buttons move the numbers by 4 and send nothing by themselves. The GT-10
lights CTL1's LED on its own; a router cannot read it, so a `toggle` follows the effect rather
than the LED (`reset_toggles_on_program_change` makes the first press after a patch change switch
on). The example mapping drives amp gain (CC60) from the expression pedal.

---

## 2. MIDI channel-voice messages

### 2.1 Encoding rules

`src/nanocore_controller/midi.py`:

- Control Change: status `0xB0 | (channel - 1)`, then `controller`, `value`.
- Program Change: status `0xC0 | (channel - 1)`, then `program`.
- Channels are 1-16; controller, program and value are integers 0-127.
- The pedal's documented controls are on channel 1 (the MIDI channel itself is settable with
  global SysEx field `0x66`, 0 = omni).

The web editor sends the same three message kinds (`cc`, `pc`, `sysex`) through a transport
(`web/src/midi/types.ts`); SysEx is channel-less and must include `F0`/`F7`.

### 2.2 Block on/off and type controllers

| Block | On/off CC | Type CC |
|---|---:|---:|
| FX1 | 20 | 40 |
| FX2 | 21 | 41 |
| Amp | 23 | 43 |
| Cab | 24 | 44 |
| Mod | 25 | 45 |
| Delay | 26 | 46 |
| Reverb | 27 | 47 |
| EQ | 28 | 48 |

- On/off: **0-63 = off, 64-127 = on**; send 0 or 127. On/off works for all eight blocks.
- Type values are **exact IDs, not scaled knob values**.
- **CC43 (amp type) and CC44 (cab type) have no effect on real hardware** — the messages are sent
  correctly and the model never changes. Model selection is SysEx-only (fields `0x06`/`0x07`,
  section 3.4). Firmware 1.11 reportedly fixes this; it has not been tried.
- CC22/42 and CC29/49 are documented as unused/ignored — likely reserved for a ninth block
  (the spec sheet says "max 8+1 effect modules").

### 2.3 Global controls

| Control | Message | Verified behaviour |
|---|---|---|
| Tuner | CC80, 0 = off / 127 = on | Opens/closes the tuner (seen on the pedal's screen); the reference pitch 400-480 Hz, default 440, has no known CC |
| Previous preset | CC81 | Steps back, ~100 ms |
| Next preset | CC82 | Steps forward, ~100 ms |
| Direct preset recall | Program Change 0-127 | `PC n` recalls display preset `n + 1`; 64 presets on this unit, so 0-63 are meaningful. ~100 ms to show in the snapshot |
| Channel volume | CC7 | **No effect**: nothing readable changed, and nothing audible while sweeping 0-96 with a guitar playing. The pedal's MASTER knob and input/output meters are likewise absent from the app's protocol |

### 2.4 Bank Select — important trap

After a Bank Select (CC0 or CC32) to a bank other than 0, the pedal **ignores every further Program
Change**, including a plain one, until it receives `CC0 = 0` **and** `CC32 = 0`. A GT-10 sends
Bank Select with each patch change, so its messages must be filtered (that is what the router's
`program_change.banks` and the bank filter do). Bank buttons alone send nothing to the pedal.

### 2.5 Direct parameter controllers

| CC range | Target |
|---|---|
| 50-56 | FX1 gate/compressor (compressor type starts at 51) |
| 57-59 | FX2 drive/boost |
| 60-64 | Amp gain, bass, mid, treble, level |
| 65-67 | Cab low cut, high cut, level — **CC67 does nothing on real hardware** |
| 68-73 | Modulation **or** FX2 pitch/wah, depending on FX2's selected type |
| 74-79 | Delay, depending on type |
| 85-90 | Reverb, depending on type |
| 91-97 and CC33 | EQ bands (CC33 = parameter 7 on the 8-band EQ) |

Named mappings used by the CLI are in `src/nanocore_controller/mappings.py` (`PARAMETERS`), and
the authoritative per-block/per-type table is `docs/calibration/mapping.json` (measured with
`scripts/calibrate_mapping.py`: 693 documented controllers applied to the active preset, live
state only, original state restored and verified byte for byte; raw data in
`docs/calibration/measurements.json`).

- Parameter `j` of a snapshot entry is changed by `base + j` with bases: FX1 50, FX2 drive/boost
  57, FX2 pitch/wah 68, amp 60, cab 65, modulation 68, delay 74, reverb 85, EQ 91.
- Values are linear: `normalized = controller / 127`; stepped parameters quantize to
  `index / (steps - 1)`. Linearity was confirmed for dB, ms, ratio, index, semitones and Hz.
- Some snapshot parameters have no documented controller (Gate and Auto Gate have two such, the
  8-band EQ has a ninth), and some controllers have no snapshot parameter — hence the editor lists
  more parameters than the pedal stores for delay, modulation, reverb and cab.
- Controllers 68-73 are **shared**: they drive FX2 when its type is Pitch (8), Envelope Wah (9),
  Wah (10) or Motion Wah (11), and modulation otherwise.

### 2.6 Value conventions and scaling

From `web/src/midi/scaling.ts`:

- Continuous parameters: `cc = round(clamp01((value - min) / (max - min)) * 127)`; the reverse is
  `min + (cc / 127) * (max - min)`. Linear scaling is the documented convention and was confirmed
  on hardware across every parameter shape checked.
- Enum options occupy equal buckets (`bucket = 128 / optionCount`, value = centre of bucket).
  The four-way LFO waveform split (0-31 Sine, 32-63 Triangle, 64-95 Square, 96-127 Saw) was
  confirmed on hardware for Tremolo and Vibrato.
- On/off is 0-63 / 64-127, transmitted as 0 or 127.
- Type IDs are sent verbatim (not scaled).

### 2.7 Type IDs (including the later firmware additions)

| Block | IDs |
|---|---|
| FX1 | gate 0, auto_gate 1, gate_compressor 2, compressor 3. Later firmware added Gate Release (5.0-100.0 ms) and Auto Gate Sensitivity (-6.0~6.0 dB) and Release (20.0-300.0 ms) — all **SysEx-only**, no CC moves them (confirmed from the official app, which sends SysEx). Omitted from the editor rather than shown as dead sliders. |
| FX2 | drives 0-4, boosts 5-7, pitch 8, envelope_wah 9, wah 10, **motion_wah 11** (added later, contiguous). |
| Mod | chorus 0, phaser 1, flanger 2, tremolo 3, vibrato 4; later firmware added **Velvet Vibrato 10, Chorus II 11, Phaser II 12, Jet Flanger 17** — **non-contiguous**; CC45 values 5-9 and 13-16 select nothing (tested up to 30). |
| Delay | bbd 0, digital 1, duck 2, ice 3, reverse 4, lofi 5, smear 6, mod_delay 7 |
| Reverb | room 0, plate 1, hall 2, concert 3, **shimmer 4, cloud 5, spring 6** — the user manual's prose order (Spring, Shimmer, Cloud) was wrong; the MIDI guide's explicit table was confirmed on hardware. Correspondingly the hardware reports `variant` 0,1,2,3,5,6,7 for type ids 0-6 (Shimmer 5, Cloud 6, Spring 7; variant 4 does not exist). |
| EQ | eq3 0, eq6 1, eq8 2 |

Later-firmware functional gaps, all confirmed on real hardware **and from the official app** (so a
firmware limitation, not an editor bug):

- MOD Phaser II (12): none of Depth/Rate/Feedback/Mix respond to MIDI.
- MOD Jet Flanger (17): only Rate (CC68) and Depth (CC69) work; Feedback/Phase/Mix do not.
- FX2 Motion Wah (11): only Rate (CC68) and Voice (CC69) work; Sweep/Mix do not.
- FX2 Envelope Wah CC72 ("Level") does nothing; Freq/Env/Q/Mix (CC68-71) all work.
- Modulation new types Velvet Vibrato (CC68-72) and Chorus II (CC68-71) are fully functional.
- Wah (CC68, 163 Hz-3.5 kHz) and Envelope Wah (CC68, 10 Hz-20 kHz) frequency ranges were
  confirmed by audible sweeps — the manual's odd numbers are real, not typos.
- The type controllers of the amp and cab change nothing; their models use SysEx fields `06`/`07`.

### 2.8 Empty-preset live state

Recalling a preset with no effects leaves the previously recalled preset's amp and IR slots in the
live state (they are loaded only for presets that use them). A backup of an empty preset therefore
shows inherited slots, and a rename of such a preset can store the wrong amp/IR. Set amp and IR
explicitly on a new preset; restoring a backup of an empty preset writes only those inherited
numbers. Also, on one occasion a preset recall left the old amp/IR live; before saving immediately
after a recall, check that the amp and IR are the ones the preset should have. Not reproduced since.

---

## 3. SysEx protocol

### 3.1 Frame format

Two descriptions in this repository cover the same protocol: the Python library's general
7-bit-packed encoder and the web editor's hand-built "set field" frame. They produce the same
bytes for the small scalar fields (AMP/CAB model), but the hand-built chain-order frame is
**not** byte-identical to the packed frame — see 3.9.

General form (verified on both USB and BLE):

```text
F0 7D 4E 43 <dir> <packed body> F7
```

- `7D` = MIDI non-commercial/educational manufacturer ID; `4E 43` = ASCII "NC" (NanoCore).
- `dir`: `0x70` host→device, `0x71` device→host acknowledgement, `0x72` unsolicited device push.
- The body is arbitrary bytes encoded in **groups of seven**: one high-bit mask byte followed by
  seven data bytes with their high bits cleared (`pack_7bit` / `unpack_7bit` in
  `src/nanocore_controller/nanocore_protocol.py`). The web builder inserts a single `0x00` byte
  (which it calls the "connection tag") where the packed form has its first high-bit mask, then
  appends the remaining bytes literally. For a payload that fits in one 7-byte group the two forms
  are byte-for-byte the same; for the longer chain-order payload they are not (3.9).

Decoded host→device body:

```text
02 | sequence:u16le | command:u16le | payload_length:u16le | payload
```

Decoded device→host body inserts `status:u8` before `payload_length`:

```text
02 | sequence:u16le | command:u16le | status:u8 | payload_length:u16le | payload
```

The device echoes the sequence and command in its answer. The web editor uses a one-byte
incrementing sequence with a zero high byte; the Python `QueryEngine` uses a random 16-bit
starting sequence incremented per query, serialises requests, and matches responses by
`(sequence, command)`. The captured `<conn>` byte varied between `0x00` and `0x02` across sessions
with no apparent effect; the project always sends `0`.

Web MIDI requires `{ sysex: true }` on `requestMIDIAccess()`, a separate browser permission.

### 3.2 Command catalogue

Commands used or identified (all little-endian integers; an unknown command is answered with
status `0x7e`):

| Command | Meaning | Payload / notes |
|---|---|---|
| `0x01` | used by the official app | not decoded |
| `0x30` / `0x50` | amplifier / IR storage info | empty; reply ≥ 20 bytes: slot count (u32 @8), size limit (u32 @12), active slot (u16 @16) |
| `0x31` / `0x51` | begin write | `u32 (length \| slot<<24)` |
| `0x32` / `0x52` | acknowledged chunk | `u32 (offset \| slot<<24)` + data |
| `0x3a` / `0x5b` | streamed chunk (no per-chunk reply) | same as the chunk |
| `0x38` / `0x5a` | write cursor | empty; answers `u32` bytes received |
| `0x33` / `0x53` | commit | `u32 (length \| slot<<24)`, `u32 crc32` |
| `0x34` / `0x54` | abort | empty |
| `0x35` / `0x55` | set slot name | `slot`, name bytes |
| `0x36` / `0x56` | slot info | `slot`; 30-byte reply (byte 2 = active) |
| `0x39` / `0x59` | read slot data | `slot, u16 offset, u8 length` |
| `0x57` | IR only, after the name | `slot`; purpose unknown |
| `0x40` | preset-name catalog page | `[start, count]`; this firmware returns at most six entries |
| `0x41` / `0x42` | modern 128-byte `RSP1` preset records (hold the name) | this firmware rejects `0x41`; not implemented |
| `0x45` | preset-storage capabilities | this unit returns the legacy marker `00` |
| `0x46` | permanent preset save | one zero-based slot byte |
| `0x63` | active runtime snapshot | no payload |
| `0x65` | get global settings | empty payload |
| `0x66` | set global settings | one-byte field mask + values; answers with the new settings |
| `0x6d` | set live field | field byte + field data (see 3.4) |
| `0x76` | preset recall in newer firmware / official app | payload `09 slot`; this 1.04-era pedal rejects it with status `0x7e`, so `0x6d 09 slot` is used instead |
| `0x6e`, `0x75`, `0x78`, `0x79`, `0x81` | used by the official app | not decoded |
| `0x30`-`0x38`, `0x3b`, `0x50`-`0x5a` | chunked amp/IR upload | see `docs/amp-ir-protocol.md` and 3.10 |

### 3.3 Status codes and streamed replies

| Status | Meaning |
|---|---|
| `0x00` | success |
| `0x01` | bad payload (including wrong length) |
| `0x02` | no active write session |
| `0x03` | slot out of range (also seen when an out-of-range `effectId` was used as a live index) |
| `0x04` | flash read/write failed |
| `0x05` | CRC mismatch |
| `0x06` | device not ready |
| `0x10` | intermediate chunk of a streamed response |
| `0x11` | final chunk of a streamed response |
| `0x7e` | command not implemented |

For `0x10`/`0x11`, the payload begins with `total:u16le` and `offset:u16le`, then the chunk data;
`ResponseAssembler` reassembles chunks, rejects overlapping/contradictory data and requires the
final chunk to complete the declared total.

### 3.4 Live fields of command `0x6d`

All writes here affect **live RAM state only**; a permanent store uses `0x46`. A write is
acknowledged before it appears in the snapshot: a read taken immediately can return the previous
value; a ~20 ms wait was enough every time (max delay seen 0.02 s with a 0.02 s polling step), and
code comparing a read-back with what it wrote must poll until two consecutive reads agree.

| Field byte | Data | Effect |
|---|---|---|
| `01` | `effect_index parameter_index float32le` | one normalized parameter |
| `02` | `effect_index variant count float32le[count]` | variant and complete parameter array |
| `03` | `effect_index enabled` | block enabled state |
| `04` | `volume` | preset volume, 0-100 |
| `05` | `08 order[8]` | effect-chain permutation |
| `06` | `slot` | amplifier slot |
| `07` | `slot` | cabinet/IR slot |
| `08` | `length characters` | rename the active preset, 1-8 printable ASCII (trailing spaces dropped; the pedal pads with spaces and echoes the bytes). RAM only until saved with `0x46`; found in the official app ("live edit") |
| `09` | `slot` | preset recall (firmware 1.04 branch; zero-based, `visible = slot + 1`, range 0-127) |

`effect_index` is the **zero-based position in the eight-entry runtime snapshot**, not the
`effectId` (1-8) stored in exported preset JSON; sending the latter caused `effectId=8` to be
rejected with status `0x03`. A same-state restore of preset 09 was confirmed on hardware by
applying all 20 operations and reading runtime, amplifier and IR state back successfully.

Writing the amp/IR slot (`06`/`07`) takes about 0.5 s to become active; read-backs right after the
write can show the old slot, so the restore code polls for up to three seconds.

### 3.5 Runtime snapshot (`0x63`) and other read commands

Snapshot payload layout:

```text
03 | active_preset:u8 | volume:u8 | for each of 8 effects:
     enabled:u8 | variant:u8 | param_count:u8 | params: float32le[param_count]
   | [08, chain_order[8]] | trailing bytes
```

- The eight entries are, in order: **`fx1, fx2, amp, cab, del, mod, rev, eq`** — *not* the
  editor's block numbering, which has `mod` before `del`. Found by toggling each block's on/off CC
  and observing exactly one `enabled` flag flip (CC 20, 21, 23, 24, 26 for delay, 25 for mod, 27, 28).
- Chain order values are **positions of snapshot entries**, and their position in the array is
  their place in the signal path. Verified against the official app's chain screen:
  `[0,1,2,3,4,5,6,7]` = FX1 FX2 AMP CAB DEL MOD REV EQ; `[0,1,2,3,5,4,6,7]` puts MOD before DEL;
  `[7,6,5,4,3,2,1,0]` = EQ REV MOD DEL CAB AMP FX2 FX1.
- Catalog page (`0x40`): `start, count`, then `count` 10-byte records of `slot, flags, 8-byte name`.
- Slot info (`0x36`/`0x56`): 30 bytes — `slot, present, active, u32 size, u32 checksum, u16 format_id,
  16-byte name`; byte 2 marks the active slot. The app substitutes `0x1a1a` for `ff ff ff`, which is
  why the sample format id is 6682.
- Capabilities (`0x45`): a modern reply is `RSP1`, version 2, 128-byte records with a CRC-32;
  this pedal returns the legacy marker `00`. The exact raw `0x63` payload is retained in every
  backup and cross-checked before a live restore.

### 3.6 Preset recall, save, and firmware differences

- The official app's native helper contains a `0x76` command for NanoCore device type 7 with a
  two-byte payload `09 slot` (`visible preset = slot + 1`). It has no checksum; the extra-looking
  bytes in the frame are the normal 7-bit packing masks. Physical testing showed this pedal
  rejects `0x76` with status `0x7e`; the compatible branch sends the same payload through `0x6d`.
- Operation 23 of the app dispatches firmware 1.04 preset storage to `0x46` with a one-byte
  zero-based slot. `0x46 08` stored the live state in visible preset 9 on this pedal; persistence
  was verified by a recall round trip and a byte-for-byte comparison with the original backup.
- Complete `0x46` frame for visible preset 9, sequence 1:

  ```text
  f0 7d 4e 43 70 00 02 01 00 76 00 02 00 00 09 08 f7
  ```

  (the captured `0x76` framing is retained as protocol evidence; the pedal uses the `0x6d` variant).

### 3.7 Global settings (`0x65` / `0x66`)

Settings belong to the pedal, not to a preset: its own Bluetooth, loopback, input gain, USB and
Bluetooth volumes, and MIDI channel. Found in the official app and checked on a pedal. `0x65` with
an empty payload answers with the settings; `0x66` changes some of them and answers with the new
settings in the same layout.

Reply layout (7 bytes; version 2 adds two more):

| Byte | Meaning |
|---|---|
| 0 | layout version (1 on the pedal used here) |
| 1 | Bluetooth on (0/1) |
| 2 | loopback on (0/1) |
| 3 | input gain in dB, signed, -20 to 20 |
| 4 | USB volume, 0-100 |
| 5 | Bluetooth volume, 0-100 |
| 6 | MIDI channel, 0 (omni) to 16 |
| 7, 8 | version 2 only: lower and upper volume limits |

A real reply with input gain +1: `01 01 00 01 64 64 00`. `0x66` takes a **one-byte** field mask,
then the chosen values in mask order: `0x01` Bluetooth, `0x02` loopback, `0x04` input gain (signed),
`0x08` USB volume, `0x10` Bluetooth volume, `0x20` MIDI channel (`0xc0` adds the two version-2
volume limits). A 15-byte reply with a five-band global EQ and a **two-byte** mask belongs to another
product: sending that mask to this pedal made it read the second byte as a value
(`04 00 02` set input gain to 0) and answer with status `0x01`.

### 3.8 Captured SysEx frames (byte-exact)

Captured between the official ToneCommand app and a real NanoCore (MIDI Monitor), one action per
capture. The `<conn>` byte varied (0x00/0x02) with no apparent effect; these examples use 0x00.

- AMP model `0x0f` ("Pey51501"): `F0 7D 4E 43 70 00 02 5B 00 6D 00 02 00 00 06 0F F7`
- CAB model `0x13` ("Ran112B"): `F0 7D 4E 43 70 02 02 0A 00 6D 00 02 00 00 07 13 F7`
- Chain order `[1,7,2,3,0,4,5,6]` (isolated single-block drag):
  `F0 7D 4E 43 70 00 02 73 00 6D 00 0A 00 00 05 08 00 01 07 02 03 00 04 05 06 F7`

`web/src/midi/__tests__/sysex.test.ts` asserts these bytes exactly with the sequence forced to
`01`. The Python library builds the same field with a different payload — `05 08` followed by the
eight order bytes (no extra `00` after the count) — and packs it into 7-bit groups; its frame is
`f0 7d 4e 43 70 00 02 01 00 6d 00 0a 00 00 05 08 01 07 02 03 00 00 04 05 06 f7`. Both forms
have been used successfully on hardware, but they are not byte-identical.

### 3.9 The web editor's three SysEx messages

`web/src/midi/sysex.ts` builds these with opcode `0x6d` (set field). The value bytes are masked to
7 bits; the sequence counter wraps at 256.

| Field | Builder | Value bytes | Length byte |
|---|---|---|---|
| `0x06` AMP model | `buildAmpModelSysEx` | 1 byte, 0-29 (same index as `amp.ts` / the failed CC43) | 2 (field + value) |
| `0x07` CAB model | `buildCabModelSysEx` | 1 byte, 0-29 (same index as `cab.ts` / the failed CC44) | 2 |
| `0x05` chain order | `buildChainOrderSysEx` | `08 00` + 8 block IDs in signal-path order | 10 |

Block IDs for the chain array: `fx1=0, fx2=1, amp=2, cab=3, del=4, mod=5, rev=6, eq=7`
(confirmed on the device's own Effect Chain screen). The leading `08 00` and the different length
convention are understood only empirically — reproducing them verbatim works; the reason is
unknown. Because the web builder appends its value bytes literally after a single leading mask,
its chain-order frame differs from the Python library's 7-bit-packed frame by one byte (an extra
`00` after the count and one fewer mask before the tail group); the scalar AMP/CAB frames coincide.
These messages are converted to server operations by the `bridge` transport; any other SysEx is
refused there.

### 3.10 Amplifier and IR asset SysEx (`0x30`-`0x5b`)

Read from the official app's native library and **tried on a pedal on 2026-10-08** (all 68 slots
backed up first). Integers little endian; `length | slot<<24` packs length in the low 24 bits and
slot in the top byte. Slots: **38 amplifier** (0-37; 30-37 are drive/fuzz models) and **30 IR**
(0-29). Every slot was occupied with factory content.

| Step | AMP | IR | Payload |
|---|---|---|---|
| storage info | `0x30` | `0x50` | empty |
| begin write | `0x31` | `0x51` | `u32 (length \| slot<<24)` |
| acknowledged chunk | `0x32` | `0x52` | `u32 (offset \| slot<<24)` + data |
| streamed chunk (no reply) | `0x3a` | `0x5b` | same as chunk |
| write cursor | `0x38` | `0x5a` | empty; answers `u32` received |
| commit | `0x33` | `0x53` | `u32 (length \| slot<<24)`, `u32 crc32` |
| abort | `0x34` | `0x54` | empty |
| set name | `0x35` | `0x55` | `slot`, name bytes (printable ASCII, ≤15 kept) |
| slot info | `0x36` | `0x56` | `slot`, 30-byte answer |
| read | `0x39` | `0x59` | `slot, u16 offset, u8 length` (windows ≤200 bytes) |
| (IR only, after name) | | `0x57` | `slot`; purpose unknown |

- The slot-info `checksum` is the ordinary **CRC-32** (zlib, polynomial `0xEDB88320`) of all `size`
  bytes of the slot — verified for **both** IR and amp slots on the pedal. A 68-slot backup took
  6.7 s. Replies to begin/chunk/commit/abort/name/`0x57` are judged by status only.
- IR data is raw little-endian `float32` mono samples, no header: 1024 samples (4096 bytes) for 28
  factory slots, 695 (slot 11) and 941 (slot 15) for the shorter ones. Sample rate is not stored;
  a WAV import converts to mono, 48 kHz, ≤1024 samples, peak 1.0, but whether that is what the
  pedal expects is unverified.
- **What the pedal stores for AMP is not the `.ead` file.** The `.ead`/`.eadl` files are an
  encrypted `SAPF` container (`SAPF`, version 1, nonce, payload size, encrypted payload, 32-byte
  MAC; `EADL` is an outer wrapper). The pedal stores and returns the **decrypted inner blob in the
  clear**, starting with magic `DDPB` (version 3, then a 48000 Hz sample-rate field). Reading and
  writing a pedal slot needs no key; installing a factory `.ead` needs the vendor's key, which this
  project deliberately does not extract (a user-supplied decryptor can be configured).
- Same-content writes of IR 29 (0.6 s) and amp 29 (1.0 s) were accepted and read back identical.
- **Side effect:** after a write the pedal makes the written slot active for the live preset.
  `write_asset` reselects the previously active slot with live fields `06`/`07` (polled) unless
  `keep_selection=False`. Reloading the preset restores its own amp and IR.
- Streaming (`0x3a`/`0x5b`, 48-byte chunks, 9 ms delay, window 3) was read from the app but not
  tried; abort and power-loss behaviour are unknown.

---

## 4. Findings catalogue

### 4.1 From the mapping investigation (upstream write-up, hardware-verified)

1. Linear CC scaling is the documented convention and holds for every parameter shape checked;
   editor-assigned defaults are conventions, not manufacturer defaults.
2. Reverb Spring/Shimmer/Cloud ids were in the wrong order (manual prose vs MIDI guide table);
   confirmed as a clean 3-way rotation on hardware and fixed to 4=Shimmer, 5=Cloud, 6=Spring.
3. CAB "Level" (CC67) does nothing — removed from the editor.
4. FX2 Envelope Wah "Level" (CC72) does nothing; Freq/Env/Q/Mix (CC68-71) confirmed live, which
   also confirms the CC68-73 MOD/FX2 routing conflict is real.
5. The editor does not reflect the device's actual values until a control is touched (send-only by
   design; no SysEx read-back was known at the time — later work found `0x63`, section 3.5).
6. On/off and type select work device-wide except AMP/CAB type (SysEx-only) and REV (fixed);
   `sendFullPatch` is authoritative/idempotent.
7. LFO waveform enum bucketing confirmed for Tremolo and Vibrato.
8. Wah/Envelope Wah CC68 frequency ranges confirmed real; MOD Chorus gained a Level param (CC70)
   to match its CC table; editor defaults are conventions.
9. Program Change recall has a +1 display offset (`PC n` → display `n + 1`); tuner, prev/next and
   `sendFullPatch` confirmed working.
10. Bluetooth diagnosis: peripheral stops advertising until Bluetooth is toggled on the device;
    the official phone app was force-pairing and stealing the connection, not a macOS bug; both
    OS Bluetooth MIDI and direct Web Bluetooth paths work once nothing else holds the link.
11. AMP/CAB type switching and effect-chain reordering are **SysEx-only**; captured field ids
    `0x06`, `0x07`, `0x05` and the block-ID numbering were confirmed end-to-end. Long SysEx needs
    Web MIDI `sysex: true` and BLE-MIDI packet continuation.
12. Post-1.04 firmware additions: MOD's four non-contiguous types, FX1's SysEx-only gate/auto-gate
    params, and FX2 Motion Wah 11; functional gaps in Phaser II, Jet Flanger and Motion Wah are
    firmware limitations, not editor bugs.
13. CC22/42 and CC29/49 are unused/ignored, probably reserved for a ninth block.
14. Capture evidence for `0x41`/`0x63`: `0x41` returned a large variable-length response embedding
    the active preset name ("FunkCln" — a preset name, not an FX1 type), and `0x63` returned a 196-byte
    response ending in `08 00 00 01 02 03 04 05 06 07`, independently confirming the chain-order
    block IDs. Decoding `0x41` fully remains open.

### 4.2 From protocol and hardware work in this repository

15. The SysEx frames work over USB as well as BLE; `0x63` reads work identically over both.
16. Bank Select to a non-zero bank makes the pedal ignore all later Program Changes until
    CC0 = CC32 = 0 (measured, and the reason the GT-10 router drops Bank Select).
17. CC7 (channel volume) has no readable or audible effect; the MASTER knob and the pedal's meters
    are not part of the protocol, and the app exposes no control for them.
18. A preset recall takes ~100 ms to appear in the snapshot; selecting a preset loads its amp/IR in
    0.05-0.3 s; a direct amp/IR slot write takes ~0.5 s to become active (restore polls up to 3 s).
19. Measure of the live state (693 controllers, live only, byte-for-byte restored): snapshot order
    `fx1, fx2, amp, cab, del, mod, rev, eq`, parameter bases 50/57/68/60/65/68/74/85/91, linear
    values, and the CC68-73 sharing rule. `docs/calibration/mapping.json` is authoritative.
20. Global settings layout and the **one-byte** `0x66` mask; a two-byte mask belongs to another
    product and was observed to set input gain to 0 with status `0x01`.
21. Live writes are acknowledged before they show in the snapshot (~20 ms needed); comparing a
    read-back with a write must poll until two consecutive reads agree.
22. Empty presets inherit the previous preset's amp/IR in the live state and in backups; an immediate
    save after a recall once stored the wrong amp/IR (not reproduced later).
23. Status code `0x7e` means unknown command; `1`-`5` (and `6` for asset writes) are the documented
    error codes; `0x10`/`0x11` stream response chunks carry total and offset as little-endian u16.
24. Preset recall on this firmware uses `0x6d 09 slot`; `0x76` is rejected with `0x7e`. Permanent
    save uses `0x46` with a zero-based slot.
25. Firmware layouts differ: the factory preset file lists one parameter for Gate, none for Auto
    Gate, and one more than this pedal reports for Pitch/Envelope Wah/Wah; the web editor hides
    parameters of a block whose count disagrees with the measured table.

### 4.3 Hardware verification matrix (MIDI/SysEx rows)

| Date | What | Result |
|---|---|---|
| 2026-10-07 | Raw `0x63` status request over USB (`amidi`) | Full runtime snapshot; reads work over USB with BLE frames |
| 2026-10-07 | `nanocore --transport usb status` | Preset 7 "TightRhy", volume 83, amp 12 "MesR2", IR 2 "Eng412A", 0.1 s, reads only |
| 2026-10-07 | `nanocore status` over BLE | Same state over BLE after re-pairing `Nanocore Midi` |
| 2026-10-08 | Live calibration (`scripts/calibrate_mapping.py --apply`) | 693 controllers; original state restored byte-for-byte |
| 2026-10-08 | Global settings read (`0x65`) | `01 01 00 01 64 64 00`: BT on, loopback off, +1 dB, volumes 100, MIDI channel 0 |
| 2026-10-08 | Global settings write (`0x66`) | One-byte mask works (+1→+2→+1); two-byte mask sets gain to 0 with status `0x01` |
| 2026-10-08 | Preset rename | Pedal echoes name (`08 06 preset`), catalog shows it after save; also exposed the empty-preset amp/IR issue |
| 2026-10-08 | Amp/IR slots read, back up, write | 38 amp + 30 IR slots, 68-slot backup in 6.7 s, CRCs match, same-content writes accepted |
| 2026-10-08 | Chain-order values | Written live orders followed by the official app's chain screen; numbering bug fixed in the editor |
| 2026-10-08 | MIDI input: PC, CC80/81/82, Bank Select, CC7 | PC 3 → preset 4; prev/next ~100 ms; tuner visible; bank trap confirmed; CC7 inert |
| 2026-10-08 | BOSS GT-10 through the router | CTL1/2, EXP SW, expression pedal, patch changes and bank pages worked as mapped |

### 4.4 Amp/IR protocol verification

- IR checksum = zlib CRC-32 over the whole slot; IR files are float32, finite, 695-1024 samples —
  **verified** on 17/17 real slots and 30 factory files.
- Frame layout of begin/chunk/commit/name/read/cursor/abort, chunk sizes (IR 64, AMP 128,
  stream 48, window 3, delay 9 ms), timeouts and retry counts — **code**, from the library.
- `.ead` framing verified on all 38 factory files; the pedal stores the decrypted `DDPB` blob —
  **code** plus pedal read-back. `EADL` outer container — code, no sample. `0x57` — unknown.
- `0x30` reply: `00 20 07 00 | 00 10 00 00 | 26 00 00 00 | 00 30 00 00 | 0c 00 00 00`, i.e. 38
  amp slots (limit 12288) with active slot 12; `0x50` reports 30 IR slots (limit 4096), active 2.

---

## 5. Open questions and unverified items

1. Writing global settings other than input gain (Bluetooth, loopback, USB/BT volume, MIDI channel)
   has not been tried on a pedal.
2. `0x57` (IR, after the name) — purpose unknown; plausibly "apply/reload", not proven.
3. Whether 48 kHz and peak 1.0 are what the pedal expects from a WAV-converted IR.
4. Streamed amp/IR writes (`0x3a`/`0x5b`) over USB and BLE; abort and mid-write power loss; whether
   an active slot is writable; whether a name may be 16 characters or non-ASCII.
5. IR sample rate/normalisation, short-IR padding, and whether an unused slot reports size/present 0.
6. What the first eight bytes of `0x30` mean and the amp size limit; `0x50` defaults (30, 4096).
7. Decoding `0x41`/`0x42` preset records and the newer `0x76` command structure; firmware 1.11 has
   not been tested, and it may change CC43/44, Pitch latency, FX2-drive click and BLE advertising.
8. `0x01`, `0x6e`, `0x75`, `0x78`, `0x79`, `0x81` and the `0x72` notifications are not decoded.
9. The meaning of the `08 00` prefix and the unusual length convention of the chain-order frame.
10. Browsers other than Chrome and Firefox have not been checked.

---

## 6. Where the raw data lives

- Measured controller map: `docs/calibration/{README.md,measurements.json,mapping.json,editor-catalog.json}`,
  rebuilt by `scripts/build_mapping.py` / `scripts/calibrate_mapping.py`.
- Protocol implementation: `src/nanocore_controller/nanocore_protocol.py` (framing, commands,
  parsers), `midi.py` (CC/PC encoding), `sysex_query.py` (request/response matching and events),
  `ble_midi.py` / `usb_midi.py` (transports), `assets_protocol.py` (amp/IR frames).
- Web implementation: `web/src/midi/{sysex,scaling,types}.ts`, `web/src/data/{types,nanocoreSpec,deviceMapping}.ts`,
  `web/src/data/blocks/*.ts`, `web/src/store/routing.ts`; byte-exact capture regressions in
  `web/src/midi/__tests__/sysex.test.ts`.
- Router: `contrib/midi-router/{README.md,nanocore_midi_router.py,gt10.example.json}`.
- Traffic capture procedure: `docs/CAPTURE_GUIDE.md` and `scripts/decode_btsnoop.py`. On a Xiaomi
  Android 15 tablet without root the bug report only contains the truncated `btsnooz_hci.log`, so
  full SysEx cannot be decoded; use the app's binary, or a computer standing in for the pedal.
- Never capture or write on a preset you care about without `nanocore backup` first; new commands go
  into `docs/protocol.md` and a test before they are tried on hardware.
