# NanoCore / Mosaic firmware version history — FX list, parameters, ranges

Canonical, single-file reference. **One document, not a set of notes.** It merges the
hardware-verified editor spec in this repo, the firmware-level reverse engineering in
`re-nanocore`, and the official release-note snapshots.

> Scope note: this is a version *history*. Section 3 is the full FX/parameter catalogue at
> the documented baseline (1.04/1.10); Section 4 gives the exact per-version deltas; Section 5
> is the cumulative catalogue at the current firmware (1.3.5). A version's complete FX list
> is **baseline (§3) + all deltas up to that version (§4)** — no table below is a partial
> snapshot that silently drops older effects.

## Provenance

| Source | What it supplies |
| --- | --- |
| `packages/protocol/src/data/blocks/{fx1,fx2,amp,cab,mod,del,rev,eq,synth}.ts` (this repo) | Authoritative current effect list, parameter names, ranges, defaults, CC/SysEx index |
| `packages/protocol/src/data/types.ts` (this repo) | Meaning of `kind`, `cc`, `sysexParamIndex`, `curve` |
| `docs/MIDI_MAPPING_NOTES.md` §§ "Firmware 1.12 changes", "Firmware 1.3.5 changes", "Synth Mode" | Dated hardware confirmations of version boundaries |
| `docs/PARAM_VERIFICATION.md`, `docs/HARDWARE_VERIFICATION.md` (this repo) | Range/taper corrections found on real hardware |
| `README.md` (this repo) | Verified firmware span 1.04 → 1.3.5 |
| `../re-nanocore/evidence/firmware-release-notes.json` | Official 1.11 / 1.12 release-note text |
| `../re-nanocore/docs/firmware-version-comparison.rst` | 1.10 → 1.11 → 1.12 binary comparison and patch-note assessment |
| `../re-nanocore/evidence/firmware-parameter-tables.json` | 1.11 vs 1.12 Spring/Duck/CAB label tables and Pitch float constants |
| `../re-nanocore/evidence/effect-catalog-1.12.json`, `firmware/versions/1.12/effects/INDEX.rst` | Firmware-level selector catalogue for 1.12 (block/subtype/name) |
| `../re-nanocore/docs/firmware-1.2-release.txt`, `firmware-1.2-analysis.txt`, `firmware-1.2-audio.txt` | 1.2 official claims and decoded-binary findings |
| `../nanocore-live/src/core/versions.js`, `firmwareSpec.js` | Community **1.2-modified** custom firmware (Octave / UniVibe) |
| Official sources (not vendored): NANOCORE User Manual and MIDI Control User Guide, `https://openparcelbox.com/manuals/NANOCORE-User-Manual.pdf` and `.../NANOCORE-MIDI-Control-User-Guide.pdf`; release notes `https://www.livtramusic.com/downloads?device=NANOCORE` | Baseline 1.04+ documented names, CC numbers, ranges |

### Evidence legend

- **[HW]** — confirmed on a real NanoCore/Mosaic by this project (CC send + live `0x63` read + pedal screen, or a ToneCommand traffic capture).
- **[FW]** — read from a signed, decoded firmware image (re-nanocore); static evidence, not a runtime/audio test.
- **[DOC]** — from Livtra's manual / MIDI Control User Guide (firmware 1.04+).
- **[REL]** — official release-note claim only; may not be independently verified here.
- **[UNK]** — exact first firmware version is not pinned by available evidence.

Keep these markers. [REL] and [UNK] are not the same as [HW]: a string present in a binary is not proof a feature is reachable, and a release note is not proof of runtime behaviour.

## 1. Version timeline

| Version | Status in evidence | Effect-list / parameter impact |
| --- | --- | --- |
| **1.04** | [DOC] original documented baseline; editor verified 1.04+ [HW] | 8 chain blocks: FX1, FX2, AMP, CAB, MOD, DEL, REV, EQ. Full catalogue in §3. |
| **1.10** | [FW] plaintext readback recovered over USB DFU; [REL] preset-data-loss warning on update | No documented FX/parameter change vs 1.04. 1.11's unchanged tables confirm 1.10-era Duck had 4 params, CAB 2, Spring `DECAY/PREDLY/XOVER/MOD/MIX`, Pitch ±12. |
| **1.11** | [FW] decoded, authenticated; [REL]+[FW] patch notes assessed | **No FX-list or parameter-range change.** Fixes only: CC43/44 AMP+IR switching, Bluetooth advertising while powered off, Pitch latency, FX2 Drive switching clicks. Internal FIT version is `1.11b` while the outer label is `1.11`. Program Change reaches presets above 40 [HW]. |
| **1.12** | [FW] decoded; every change [HW]-confirmed 2026-10-24 | Spring `MOD`→`TONE` (same CC/range); Duck 4→8 params; FX2 Pitch ±12→±24 st; CAB Output Level CC67 revived 0–100. Fresh synth/instrument strings present in binary but reachability unproven [FW]. |
| **1.2** | [REL] released 2026-11-11; [FW] decoded package `0bf64603…` | 48 kHz engine, stereo chain, ping-pong option on every delay, NAM A2-Lite model inference, 10 synth voices, comp/wah types in FX1/FX2. The exact first-firmware boundary for the 17 new FX types is **not pinned**: [REL]+[FW] put them in 1.2, [HW] confirmation of their ids/params was done on 1.3.5. |
| **1.3.5** | [HW] confirmed 2026-11-12 / 11-15; current editor target | 17 new effect types mapped (FX1 4→12, FX2 12→21); boost types corrected to 3 params each; all 10 Synth voices mapped; editing is entirely SysEx. Current cumulative catalogue in §5. |
| **1.2-modified** | Community patch set on 1.2 (re-nanocore / nanocore-live), **not** an official Livtra release | FX2 Pitch replaced by **Octave** (11 controls); MOD Velvet Vibrato replaced by **UniVibe** (4 controls). 1.2 combined patch hardware-confirmed and released as work in progress; UniVibe also user-confirmed on 1.12, Octaver on 1.11 withdrawn. See §4.5. |

### FX count by version

Counts are user-selectable types per block; AMP/CAB counts are preamp/IR models.

| Version | FX1 | FX2 | AMP | CAB | MOD | DEL | REV | EQ | Synth |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.04 / 1.10 | 4 | 11 | 30 | 30 | 5 | 8 | 7 | 3 | — |
| 1.11 | 4 | 12 [FW] | 30 | 30 | 9 [UNK] | 8 | 7 | 3 | — |
| 1.12 | 4 | 12 [FW] | 30 | 30 | 9 [FW] | 8 [FW] | 7 [FW] | 3 [FW] | — [FW strings only] |
| 1.2 | 12 [REL] | 21 [REL] | 30 | 30 | 9 | 8 | 7 | 3 | 10 [REL] |
| 1.3.5 | 12 [HW] | 21 [HW] | 30 | 30 | 9 [HW] | 8 [HW] | 7 [HW] | 3 [HW] | 10 [HW] |

The "post-1.04, exact version unconfirmed" effects: **FX2 Motion Wah is present in 1.11**
(the `MOTION_WAH` / `motion_wah` name strings are in
`re-nanocore/firmware/versions/1.11/audio/effect_metadata.c`) [FW]. The four MOD additions
(Velvet Vibrato, Chorus II, Phaser II, Jet Flanger) are absent from the 1.04 manual and not
named in the recovered 1.11 source strings, but are present in the **1.12 firmware selector
catalogue** [FW], so their introduction is bounded to 1.11–1.12 and remains [UNK].

## 2. How to read a parameter

- `Name (CC n) a..b unit` — continuous range from MIDI CC 0→127; `CC n` is for an external
  controller / the CC Reference page only. This editor always writes via SysEx.
- `Name (S x) a..b unit` — no working CC; written with SysEx per-parameter index `x`.
- `Name {A|B}` — enumerated options.
- `curve exp` / `curve quad` — non-linear CC→value taper confirmed on hardware; everything
  else is linear.
- "absent on device" / "CC dead" means the manual or CC map lists a control that the pedal's
  own screen and ToneCommand do not expose. It is deliberately not in the editor.

Parameter **defaults** are editor/hardware-read conventions, not guaranteed factory
defaults; they are omitted from §3 and included in §5 where relevant.

## 3. Baseline catalogue — firmware 1.04 / 1.10 ([DOC] + [HW])

### FX1 (block 0, on/off CC20, type CC40)

| id | Type | Parameters and ranges |
| -- | ---- | --------------------- |
| 0 | Gate | Threshold (CC50) −100..0 dB |
| 1 | Auto Gate | — (no documented CC param) |
| 2 | Gate + Compressor (NC-Com) | Gate Threshold (CC50) −100..0 dB; Comp Threshold (CC51) −60..0 dB; Ratio (CC52) 1..20:1; Knee (CC53) 0..24 dB; Attack (CC54) 0..200 ms; Release (CC55) 0..1000 ms; Makeup (CC56) −24..24 dB |
| 3 | Compressor | Threshold (CC51) −60..0 dB; Ratio (CC52) 1..20:1; Knee (CC53) 0..24 dB; Attack (CC54) 0..200 ms; Release (CC55) 0..1000 ms; Makeup (CC56) −24..24 dB |

Hardware corrections later folded in [HW]: Compressor Ratio floor is **1:1**, not the manual's
"1.1:1"; Gate and Auto Gate have further real controls with no CC (Release 5..100 ms;
Sensitivity −6..60 dB, Release 20..300 ms), reached by SysEx. Knee's real default is 0 dB.

### FX2 (block 1, on/off CC21, type CC41)

| id | Type | Parameters and ranges |
| -- | ---- | --------------------- |
| 0 | Scream (TS9) | Gain (CC57) 0..1; Tone (CC58) 0..100; Level (CC59) 0..100 |
| 1 | Klone (Ryra Klone) | same as Scream |
| 2 | OCD (Fulltone OCD) | same as Scream |
| 3 | DS2 (Boss DS-2) | same as Scream |
| 4 | PIFUZZ (Big Muff Pi) | same as Scream |
| 5 | Range (Rangemaster) | Boost (CC57) 0..1 *(documented single param — wrong, see 1.3.5)* |
| 6 | XAC (Xotic AC) | Boost (CC57) 0..1 *(documented single param — wrong, see 1.3.5)* |
| 7 | Fiman (Friedman) | Boost (CC57) 0..1 *(documented single param — wrong, see 1.3.5)* |
| 8 | Pitch | Pitch (CC68) −12..+12 st; Fine (CC69) −1..+1 st; Mix (CC70) 0..100; "Level" (CC71) documented but absent on device |
| 9 | Envelope Wah | Freq (CC68) 10..20000 Hz; Env (CC69) 0..20000 Hz; Q (CC70) 0.1..20; Mix (CC71) 0..100; "Level" (CC72) documented but dead |
| 10 | Wah | Freq (CC68) 163..3500 Hz; Sweep (CC69) 0..100; Rate (CC70) 0..8 Hz; Shape (CC71) 0..100; Mix (CC72) 0..100; "Level" (CC73) documented but dead |
| 11 | Motion Wah [UNK] | Rate (CC68) 0..15 Hz; Voice (CC69) 0..100; Sweep (S3) 0..100; Mix (S4) 0..100 |

CC68–73 are shared with MOD: when FX2 is Pitch / Envelope Wah / Wah (and, from 1.3.5,
every FX2 type), those six CCs drive FX2 instead of MOD. Freq and Sweep tapers on the wah
types are exponential [HW].

### AMP (block 2, on/off CC23, type CC43 — type-select needs SysEx)

30 preamp models, ids 0–29: BogXTC1/2, ENGP1/2, Fd59Bm, Fd65Dk, Hiw103, MarDSL1/2,
Mar8001/2, MesR1/2/3, OgG120, Pey51501/2, Pey6505, RanT21/2, RoJC120, SLO1001/2/3,
VXAC30, ApSVTVR, ApSVTCL, Adn900, Hiw320, MarSup.

Common parameters: Gain (CC60) 0..1; Bass (CC61) −10..+10 dB; Mid (CC62) −10..+10 dB;
Treble (CC63) −10..+10 dB; Level (CC64) documented −10..+10 dB but is really 0..100 [HW].

### CAB (block 3, on/off CC24, type CC44 — type-select needs SysEx)

30 IR models, ids 0–29: Bog412A/B, Eng412A/B, FdTR212, Fd59BM410, Hiw412, Mar412A/B,
Mar96412A/B, Mes412A/B/C, Og412, pey412A/B, peyVk412, Ran112A/B/C, SLO412A/B/C, AC30212,
AP810, Ap410, Adn410, HiwB410, Mar412.

Common parameters: Low Cut (CC65) 20..500 Hz; High Cut (CC66) 2000..20000 Hz (both
exponential taper [HW]); "Level" (CC67) documented but dead until 1.12.

### MOD (block 4, on/off CC25, type CC45)

| id | Type | Parameters and ranges |
| -- | ---- | --------------------- |
| 0 | Chorus | Rate (CC68) 0.1..3.74 Hz; Depth (CC69) 0..1 ms; "Level" (CC70) documented but absent |
| 1 | Phaser | Rate (CC68) 0.05..5 Hz; Feedback (CC69) −95..95; Mix (CC70) 0..100; "Level" (CC71) absent |
| 2 | Flanger | Rate (CC68) 0.05..5 Hz; Feedback (CC69) −95..95; Mix (CC70) 0..100; "Level" (CC71) absent |
| 3 | Tremolo | Rate (CC68) 0.01..20 Hz; Depth (CC69) 0..100; Wave (CC70) {Sine,Triangle,Square,Saw}; Smooth (CC71) 0..40 Hz; Mix (CC72) 0..100; "Level" (CC73) absent |
| 4 | Vibrato | Rate (CC68) 0.01..20 Hz; Depth (CC69) 0..20 ms; Wave (CC70) {Sine,Triangle,Square,Saw}; Mix (CC71) 0..100; "Level" (CC72) absent |
| 10 | Velvet Vibrato [UNK] | Rate (CC68) 0.45..10 Hz exp; Wave 0..100; Voice 0..100; Depth 0..100; Mix 0..100 |
| 11 | Chorus II [UNK] | Rate (CC68) 0..1; Amount (CC69) 0..1; Feedback (CC70) 0..1; Mix (CC71) 0..1 |
| 12 | Phaser II [UNK] | Depth (S0) 0..100; Rate (S1) 0.05..5 Hz; Feedback (S2) −95..95; Mix (S3) 0..100 |
| 17 | Jet Flanger [UNK] | Rate (CC68) 0.05..5 Hz; Depth (CC69) 0..100; Feedback (S2) −95..95; Phase (S3) 0..360°; Mix (S4) 0..100 |

IDs 5–9 and 13–16 select nothing — confirmed empirically. Phaser II / Jet Flanger's
SysEx-only controls were once thought dead over MIDI; they are fully controllable via the
per-parameter SysEx mechanism [HW].

### DEL (block 5, on/off CC26, type CC46)

| id | Type | Parameters and ranges (1.10 baseline) |
| -- | ---- | ------------------------------------- |
| 0 | BBD | Delay (CC74) 1..2000 ms; Feedback (CC75) 0..95; Age (CC76) 0..100; Mix (CC77) 0..100; "Level" (CC78) absent |
| 1 | Digital | Time (CC74) 0.1..3000 ms; Feedback (CC75) 0..95; Mix (CC76) 0..100; "Level" (CC77) absent |
| 2 | Duck | Time (CC74) 0.1..3000 ms; Feedback (CC75) 0..95; Filter (CC76) 0..100; Mix (CC77) 0..100; "Level" (CC78) absent — **4 params in 1.11** |
| 3 | Ice | Time (CC74) 0.1..3000 ms; Feedback (CC75) 0..95; Interval (CC76) −12..+12 st; Mix (CC77) 0..100; "Level" (CC78) absent |
| 4 | Reverse | Time (CC74) 0.1..3000 ms; Feedback (CC75) 0..95; Mix (CC76) 0..100; "Level" (CC77) absent |
| 5 | LoFi | Time (CC74) 2..3000 ms; Feedback (CC75) 0..95; Bit Depth (CC76) 4..16 bit; LoFi Mix (CC77) 0..100; Mix (CC78) 0..100; "Level" (CC79) absent |
| 6 | Smear | Time (CC74) 0.1..3000 ms; Feedback (CC75) 0..95; Smear (CC76) 0..100; Filter (CC77) 0..100; Mix (CC78) 0..100; "Level" (CC79) absent |
| 7 | Mod Delay | Time (CC74) 0.1..3000 ms; Feedback (CC75) 0..95; Mod Depth (CC76) 0..20 ms; Mod Rate (CC77) 0.05..5 Hz; Mix (CC78) 0..100; "Level" (CC79) absent |

### REV (block 6, on/off CC27, type CC47)

| id | Type | Parameters and ranges |
| -- | ---- | --------------------- |
| 0 | Room | Decay (CC85) 0.5..12 s; Pre Delay (CC86) 0..80 ms; Tone (CC87) 0..100; Mod (CC88) 0..100; Mix (CC89) 0..100; "Level" (CC90) absent |
| 1 | Plate | Decay (CC85) 0.5..12 s; Pre Delay (CC86) 0..80 ms; Tone (CC87) 0..100; Mod (CC88) 0..100; Mix (CC89) 0..100 |
| 2 | Hall | Decay (CC85) 0.5..12 s; Pre Delay (CC86) 0..80 ms; Tone (CC87) 0..100; LF Damp (CC88) 0..100; Mix (CC89) 0..100 |
| 3 | Concert | Decay (CC85) 0.5..12 s; Pre Delay (CC86) 0..80 ms; HF Damp (CC87) 0..100; Mod (CC88) 0..100; Mix (CC89) 0..100 |
| 4 | Shimmer | Decay (CC85) 0..12 s; Pre Delay (CC86) 5..120 ms; Tone (CC87) 0..100; Pitch (CC88) −24..+24 st; Mix (CC89) 0..100 |
| 5 | Cloud | Decay (CC85) 1..100 s; Tone (CC86) 0..100; Mod Depth (CC87) 0..100; Mod Rate (CC88) 0.02..0.25 Hz; Mix (CC89) 0..100 |
| 6 | Spring | Decay (CC85) 0..12 s; Pre Delay (CC86) 5..80 ms; Crossover (CC87) 800..8000 Hz; **Mod (CC88) 0..100**; Mix (CC89) 0..100 |

Type ids 4/5/6 = Shimmer/Cloud/Spring follow the MIDI guide's "Reverb quick check"; the
user manual's plain listing order is wrong [HW]. Internally the firmware numbers these
subtypes 5/6/7 because of a HALL alias at internal subtype 4 — see §6.

### EQ (block 7, on/off CC28, type CC48)

| id | Type | Parameters and ranges |
| -- | ---- | --------------------- |
| 0 | 3-band EQ | Low (CC91) −15..+15 dB; Mid (CC92) −15..+15 dB; High (CC93) −15..+15 dB |
| 1 | 6-band EQ | 120, 250, 500 Hz, 1, 2, 4 kHz (CC91–96) each −15..+15 dB |
| 2 | 8-band EQ | 60, 120, 250, 500 Hz, 1, 2, 4, 8 kHz (CC91–97 and CC33) each −15..+15 dB |

All EQ types also have a real Level control (S<band count>) −12..+12 dB, found on the
device screen with no CC [HW]; it is not in the original manual.

## 4. Per-version deltas

### 4.1 1.11 — no effect/parameter changes

[REL] four fixes, all assessed in `re-nanocore/docs/firmware-version-comparison.rst`:
CC43/44 AMP/IR switching, Bluetooth advertising while powered off and plugged in, Pitch
latency, FX2 Drive switching clicks. Only the CC43/44 change is a *verified implementation
change* [FW]; the other three are static-support or unverified. **No FX was added or
removed; no parameter range changed.** [HW] Program Change now reaches presets above 40.

### 4.2 1.12 — four hardware-confirmed changes (2026-10-24) [HW]

| Area | Before (1.10/1.11) | From 1.12 |
| --- | --- | --- |
| FX2 Pitch (id 8) | CC68 coarse −12..+12 st | CC68 coarse **−24..+24 st**; Fine still ±1 st; same CC, same Mix |
| REV Spring (id 6, internal subtype 7) | 5 labels `DECAY, PREDLY, XOVER, MOD, MIX` | 5 labels `DECAY, PREDLY, XOVER, TONE, MIX` — **relabel of CC88, not a new control**; range still 0..100 |
| DEL Duck (id 2) | 4 live params `TIME, FBK, FILTER, MIX` | 8 live params `TIME, FBK, SENS, DEPTH, ATK, REL, FILTER, MIX` |
| CAB common | 2 params `LOCUT, HICUT`; CC67 dead | 3 params `LOCUT, HICUT, LEVEL`; CC67 revived, linear **0..100** |

Duck's 1.12 parameter layout (the important part — indices moved, do not append):

| Position | Parameter | Range | Access |
| --- | --- | --- | --- |
| 0 | Time | 0.1..3000 ms | CC74 |
| 1 | Feedback | 0..95 | CC75 |
| 2 | Sensitivity | 0..100 | CC76 (repurposed from Filter) |
| 3 | Depth | 0..100 | CC77 (repurposed from Mix) |
| 4 | Attack | 0.1..100 ms | CC78 (new) |
| 5 | Release | 10..2000 ms | CC79 (new) |
| 6 | Filter | 0..100 | SysEx index 6 (moved off CC76) |
| 7 | Mix | 0..100 | SysEx index 7 (moved off CC77) |

[FW] corroboration from the decoded tables: Spring at `0x40096768` (1.11) → `0x4009b324`
(1.12); Duck `0x4009691c` → `0x4009bbe4`; CAB `0x40096940` → `0x4009bc14`; Pitch coarse
scale/offset float32 `24.0 / −12.0` (1.11) → `48.0 / −24.0` (1.12), fine `2.0 / −1.0`
unchanged. The reverb addition was a *changed* control, not five new ones.

### 4.3 1.2 — engine/synth/comp-wah release [REL] + [FW]

[REL] official notes: 48 kHz engine and USB recording/playback; stereo processing
throughout the chain; left/right ping-pong option on **every** delay algorithm; NAM A2-Lite
amp inference at 48 kHz; ten guitar-driven synth voices (Settings-enabled, stored per
preset); Peak Comp, Parallel Comp, Classic Wah, Retro Wah and Bass Wah in FX1 and FX2.

[FW] decoded-image findings: codec clock programming/readback and asynchronous USB
feedback; 64-frame callback at 1.333 ms (8.84% more work per second); fixed-format NA2L
model (32-byte header + 1871 float32 weights, 48 kHz required); ITCM/DTCM regions; stereo
and ping-pong labels present but complete signal paths not independently verified.
An early 1.2 analysis said the then-current UniVibe/Octaver patches did **not** support 1.2;
that is superseded — a combined 1.2 patch was later flashed, hardware-tested and released
as work in progress (2026-11-16). See §4.5.

[UNK] The 17 new FX-type ids and their exact parameter values were captured on hardware
under **1.3.5** (ToneCommand 1.3.5 is the companion for 1.2). Whether they first shipped in
1.2 or were refined by 1.3.5 is not established; §5 lists them under "1.3.5+" for that reason.

### 4.4 1.3.5 — 17 new effect types, all SysEx [HW]

FX1 4 → 12, FX2 12 → 21. Type select is a single opcode-`0x6d` subcommand-`0x02` SysEx
message `[0x02, blockId, typeId, paramCount, ...floats]`, preceded by a chain-order prime;
`typeCC` is reference-only. Every parameter write is SysEx, including AMP/CAB common params.

New FX1 types (ids 4–11), all `rangeSysexOnly`, with ranges:

| id | Type | Parameters and ranges |
| -- | ---- | --------------------- |
| 4 | Env Wah | Freq 10..20000 Hz exp; Env 0..20000 Hz; Q 0.1..20; Mix 0..100 |
| 5 | Wah | Freq 163..3500 Hz exp; Sweep 0..100; Rate 0..8 Hz; Shape 0..100; Mix 0..100 |
| 6 | Motion Wah | Rate 0..15 Hz; Voice 0..100; Sweep 0..100 (S3); Mix 0..100 (S4) |
| 7 | Peak Comp | Threshold −60..0 dB; Ratio 1..20:1; Attack 0..32 ms; Release 0..56 ms; Makeup −24..24 dB |
| 8 | Parallel Comp | Threshold −60..0 dB; Attack 0.01..250 ms; Release 10..2500 ms; Mix 0..200; Level −24..24 dB |
| 9 | Classic Wah | Position 0..100; Low Freq 20..500 Hz; High Freq 500..5000 Hz; Mix 0..100; Level −60..+6 dB |
| 10 | Retro Wah | Position 0..100; Low Freq 20..500 Hz; High Freq 500..5000 Hz; Mix 0..100; Level −60..+6 dB |
| 11 | Bass Wah | Position 0..100; Q Trim 0..100; Volume Trim 0..100; Mix 0..100; Level −60..+6 dB |

New FX2 types (ids 12–20) mirror FX1's copies, with FX2's universal CC68–72 routing:

| id | Type | Parameters and ranges |
| -- | ---- | --------------------- |
| 12 | Gate | Threshold (CC68) −100..0 dB; Release (CC69) 5..100 ms |
| 13 | Auto Gate | Sensitivity (CC68) −6..60 dB; Release (CC69) 20..300 ms |
| 14 | Gate + Compressor | Gate Thresh (CC68) −100..0 dB; Comp Thresh (CC69) −60..0 dB; Ratio (CC70) 1..20:1; Knee (CC71) 0..24 dB; Attack (CC72) 0..200 ms; Release (CC73) 0..1000 ms; Makeup (S6) −24..24 dB |
| 15 | Compressor | Threshold (CC68) −60..0 dB; Ratio (CC69) 1..20:1; Knee (CC70) 0..24 dB; Attack (CC71) 0..200 ms; Release (CC72) 0..1000 ms; Makeup (CC73) −24..24 dB |
| 16 | Peak Comp | Threshold (CC68) −60..0 dB; Ratio (CC69) 1..20:1; Attack (CC70) 0..32 ms; Release (CC71) 0..56 ms; Makeup (CC72) −24..24 dB |
| 17 | Parallel Comp | Threshold (CC68) −60..0 dB; Attack (CC69) 0.01..250 ms; Release (CC70) 10..2500 ms; Mix (CC71) 0..200; Level (CC72) −24..24 dB |
| 18 | Classic Wah | Position (CC68) 0..100; Low Freq (CC69) 20..500 Hz; High Freq (CC70) 500..5000 Hz; Mix (CC71) 0..100; Level (CC72) −60..+6 dB |
| 19 | Retro Wah | same ranges (CC68–72); Low Freq default differs |
| 20 | Bass Wah | Position (CC68) 0..100; Q Trim (CC69) 0..100; Volume Trim (CC70) 0..100; Mix (CC71) 0..100; Level (CC72) −60..+6 dB |

FX2 boost types 5–7 (Range, XAC, Fiman) were corrected from the documented single `Boost`
param to **Gain (CC57) 0..1, Tone (CC58) 0..100, Level (CC59) 0..100** [HW]. FX2 Pitch's
"Level" (CC71) and Wah's "Level" (CC73) are genuinely absent on the device.

Open gap: Parallel Comp's Attack/Release ranges/defaults are screen-confirmed, but their
CC→value curve matches neither linear nor the project's `exp` formula; the editor keeps
linear rather than guessing [HW].

### 4.5 1.2-modified (community firmware, not official)

This is a **community patch set**, not a Livtra release. The browser editor models it as an
explicit `1.2-modified` selector (`nanocore-live/src/core/versions.js`), which starts from
the later-firmware type list (1.12/1.2) and swaps two types. All of its controls are sent
by SysEx per-parameter index — no CC was captured for them.

Editor model (`1.2-modified`), with the values the UI displays:

| Block | Stock type replaced | Replacement | Parameters and displayed ranges |
| ----- | ------------------- | ----------- | ------------------------------- |
| FX2 | Pitch (id 8) | **Octave** | Dry 0..100 %; −2 Oct 0..100 %; −1 Oct 0..100 %; +1 Oct 0..100 %; +2 Oct 0..100 %; Attack 0..2000 ms; Lowpass 150..18000 Hz; Detune 0..30 ct; Dry FX {Smooth, Smooth, Filter, Detune}; Reson {Low, Medium, High, Peak}; Level 0..100 % |
| MOD | Velvet Vibrato (id 10) | **UniVibe** | Speed 0..100; Depth 0..100; Level 0..100; Mode {Chorus, Vibrato} |

Underlying normalized values (important — the displayed percentage is not the DSP value):
Octave uses 0..1 for Dry and the four octave voices, 0..2000 ms Attack, 150..18000 Hz
Lowpass, 0..30 ct Detune, four Dry FX modes, four Reson choices, and Level 0..2 with a
fixed −9 dB output offset so 50 % is unity (`re-nanocore/evidence/octave-full-controls-integration.json`,
`firmware/custom-fx/octave/README.rst`). UniVibe uses Speed `0.2 + 5.8*x²` Hz, Depth
excursion 0..1, Level 0..2 (50 = unity, 100 = +6.02 dB), Mode 0/1 = Chorus/Vibrato — only
four controls, no Wave/Voice/Mix (`re-nanocore/docs/custom-fx-univibe-controls.txt`).

Hardware status by base firmware (all from `re-nanocore/evidence/`):

| Base | Status |
| ---- | ------ |
| 1.10 | UniVibe four-control revision flashed with exact full-OS readback and runtime ready; UI/listening feedback still pending on that receipt (`custom-fx-univibe-controls-flash.json`). |
| 1.11 | Octaver support **withdrawn** after a failed hardware test (`octave-pages-1.11-failure.json`). |
| 1.12 | UniVibe physically installed and user-confirmed working ("bam, done" / "sounds rad") (`univibe-1.12-user-confirmation.json`). Octave booted and read back, but the guarded timing test failed — work in progress, not a stable release (`octave-device-1.12.json`, `octave-paired-device-1.12.json`). |
| 1.2 | Combined Octave + UniVibe patch flashed/read back, active Octaver timing exercised and user confirmation recorded ("works great, distribute this patch for 1.2 on the github site", 2026-11-16); released as **work in progress** (`firmware-1.2-custom-fx.json`). Octaver folds stereo to mono; UniVibe preserves separate stereo state. |

Known limits of the custom patches: Octave uses ~61.8 KB state plus a 64 KB ring allocation
and its code sits outside ITCM, so there is no worst-case CPU guarantee; the user's exact
audition chain and NAM coexistence are not established. See `re-nanocore/docs/firmware-1.2-octave-dsp.txt`,
`firmware-1.2-univibe.txt`, `firmware-1.2-octave-ui.txt` for the offline validation reports.

There is no firmware-version query opcode. The global-settings marker byte 0 of opcode
`0x65` is a settings-layout marker (1 or 2), not a version, so firmware-dependent
behaviour needs an explicit selector; that byte is only an auto hint.

## 5. Cumulative catalogue — current firmware 1.3.5+ [HW]

This is the full, de-duplicated effect/parameter/range set the editor ships today. Ranges
are hardware-verified; defaults are editor conventions from live reads. See §3 for the
1.04/1.10 subset and §4 for the changes that produced this state.

Conventions: `CC n` = external-controller CC, `S n` = SysEx-only parameter index.
All 8 chain blocks plus the parallel Synth mode.

### FX1 — 12 types

| id | Type | Parameters (range, unit, default) |
| -- | ---- | --------------------------------- |
| 0 | Gate | Threshold CC50 −100..0 dB (−80); Release S1 5..100 ms (50) |
| 1 | Auto Gate | Sensitivity S0 −6..60 dB (27); Release S1 20..300 ms (109.9) |
| 2 | Gate + Compressor | Gate Thresh CC50 −100..0 dB (−80); Comp Thresh CC51 −60..0 dB (−20); Ratio CC52 1..20:1 (4); Knee CC53 0..24 dB (0); Attack CC54 0..200 ms (10); Release CC55 0..1000 ms (100); Makeup CC56 −24..24 dB (0) |
| 3 | Compressor | Thresh CC51 −60..0 dB (−20); Ratio CC52 1..20:1 (4); Knee CC53 0..24 dB (0); Attack CC54 0..200 ms (10); Release CC55 0..1000 ms (100); Makeup CC56 −24..24 dB (0) |
| 4 | Env Wah | Freq S0 10..20000 Hz exp (400); Env S1 0..20000 Hz (1000); Q S2 0.1..20 (8); Mix S3 0..100 (80) |
| 5 | Wah | Freq S0 163..3500 Hz exp (800); Sweep S1 0..100 (50); Rate S2 0..8 Hz (1.5); Shape S3 0..100 (0); Mix S4 0..100 (80) |
| 6 | Motion Wah | Rate S0 0..15 Hz (2); Voice S1 0..100 (50); Sweep S3 0..100 (55); Mix S4 0..100 (100) |
| 7 | Peak Comp | Threshold S0 −60..0 dB (−6); Ratio S1 1..20:1 (2); Attack S2 0..32 ms (22.9); Release S3 0..56 ms (23.1); Makeup S4 −24..24 dB (0) |
| 8 | Parallel Comp | Threshold S0 −60..0 dB (−12); Attack S1 0.01..250 ms (2.2); Release S2 10..2500 ms (216); Mix S3 0..200 (200); Level S4 −24..24 dB (0) |
| 9 | Classic Wah | Position S0 0..100 (0); Low Freq S1 20..500 Hz (455); High Freq S2 500..5000 Hz (2155); Mix S3 0..100 (100); Level S4 −60..+6 dB (0) |
| 10 | Retro Wah | Position S0 0..100 (0); Low Freq S1 20..500 Hz (435); High Freq S2 500..5000 Hz (1901); Mix S3 0..100 (100); Level S4 −60..+6 dB (0) |
| 11 | Bass Wah | Position S0 0..100 (0); Q Trim S1 0..100 (100); Volume Trim S2 0..100 (70); Mix S3 0..100 (100); Level S4 −60..+6 dB (0) |

### FX2 — 21 types

| id | Type | Parameters (range, unit, default) |
| -- | ---- | --------------------------------- |
| 0–4 | Scream, Klone, OCD, DS2, PIFUZZ | Gain CC57 0..1 (0.5); Tone CC58 0..100 (50); Level CC59 0..100 (80) |
| 5–7 | Range, XAC, Fiman | Gain CC57 0..1 (0.5); Tone CC58 0..100 (50); Level CC59 0..100 (80) *(1.3.5 correction)* |
| 8 | Pitch | Pitch CC68 −24..+24 st (0); Fine CC69 −1..+1 (0); Mix CC70 0..100 (100) |
| 9 | Envelope Wah | Freq CC68 10..20000 Hz exp (400); Env CC69 0..20000 Hz (1000); Q CC70 0.1..20 (8); Mix CC71 0..100 (80) |
| 10 | Wah | Freq CC68 163..3500 Hz exp (800); Sweep CC69 0..100 (50); Rate CC70 0..8 Hz (1.5); Shape CC71 0..100 (0); Mix CC72 0..100 (80) |
| 11 | Motion Wah | Rate CC68 0..15 Hz (2); Voice CC69 0..100 (50); Sweep S3 0..100 (55); Mix S4 0..100 (100) |
| 12 | Gate | Threshold CC68 −100..0 dB (−80); Release CC69 5..100 ms (50) |
| 13 | Auto Gate | Sensitivity CC68 −6..60 dB (27); Release CC69 20..300 ms (109.9) |
| 14 | Gate + Compressor | Gate Thresh CC68 −100..0 dB (−80); Comp Thresh CC69 −60..0 dB (−20); Ratio CC70 1..20:1 (4); Knee CC71 0..24 dB (0); Attack CC72 0..200 ms (10); Release CC73 0..1000 ms (100); Makeup S6 −24..24 dB (0) |
| 15 | Compressor | Thresh CC68 −60..0 dB (−20); Ratio CC69 1..20:1 (4); Knee CC70 0..24 dB (0); Attack CC71 0..200 ms (10); Release CC72 0..1000 ms (100); Makeup CC73 −24..24 dB (0) |
| 16 | Peak Comp | Threshold CC68 −60..0 dB (−6); Ratio CC69 1..20:1 (2); Attack CC70 0..32 ms (22.9); Release CC71 0..56 ms (23.1); Makeup CC72 −24..24 dB (0) |
| 17 | Parallel Comp | Threshold CC68 −60..0 dB (−12); Attack CC69 0.01..250 ms (2.2); Release CC70 10..2500 ms (216); Mix CC71 0..200 (200); Level CC72 −24..24 dB (0) |
| 18 | Classic Wah | Position CC68 0..100 (0); Low Freq CC69 20..500 Hz (455); High Freq CC70 500..5000 Hz (2155); Mix CC71 0..100 (100); Level CC72 −60..+6 dB (0) |
| 19 | Retro Wah | same ranges (CC68–72); Low Freq default 435 Hz, High Freq 1901 Hz |
| 20 | Bass Wah | Position CC68 0..100 (0); Q Trim CC69 0..100 (100); Volume Trim CC70 0..100 (70); Mix CC71 0..100 (100); Level CC72 −60..+6 dB (0) |

### AMP — 30 models, common params only

Gain CC60 0..1 (1); Bass CC61 −10..+10 dB (0); Mid CC62 −10..+10 dB (0);
Treble CC63 −10..+10 dB (0); Level CC64 0..100 (80). Model list in §3.

### CAB — 30 IRs, common params only

Low Cut CC65 20..500 Hz exp (20); High Cut CC66 2000..20000 Hz exp (20000);
Level CC67 0..100 (100) *(1.12)*. IR list in §3.

### MOD — 9 types

| id | Type | Parameters (range, unit, default) |
| -- | ---- | --------------------------------- |
| 0 | Chorus | Rate CC68 0.1..3.74 Hz (2.3); Depth CC69 0..1 ms (0.5) |
| 1 | Phaser | Rate CC68 0.05..5 Hz (0.5); Feedback CC69 −95..95 (20); Mix CC70 0..100 (40) |
| 2 | Flanger | Rate CC68 0.05..5 Hz (0.8); Feedback CC69 −95..95 (55); Mix CC70 0..100 (35) |
| 3 | Tremolo | Rate CC68 0.01..20 Hz (5.01); Depth CC69 0..100 (60); Wave CC70 {Sine,Triangle,Square,Saw} (0); Smooth CC71 0..40 Hz (0); Mix CC72 0..100 (100) |
| 4 | Vibrato | Rate CC68 0.01..20 Hz (9.01); Depth CC69 0..20 ms (0.4); Wave CC70 {Sine,Triangle,Square,Saw} (0); Mix CC71 0..100 (80) |
| 10 | Velvet Vibrato | Rate CC68 0.45..10 Hz exp (1); Wave CC69 0..100 (75); Voice CC70 0..100 (45); Depth CC71 0..100 (40); Mix CC72 0..100 (100) |
| 11 | Chorus II | Rate CC68 0..1 (0.5); Amount CC69 0..1 (0.5); Feedback CC70 0..1 (0); Mix CC71 0..1 (0.5) |
| 12 | Phaser II | Depth S0 0..100 (45); Rate S1 0.05..5 Hz (2.77); Feedback S2 −95..95 (0); Mix S3 0..100 (65) |
| 17 | Jet Flanger | Rate CC68 0.05..5 Hz (0.55); Depth CC69 0..100 (70); Feedback S2 −95..95 (5); Phase S3 0..360° (95); Mix S4 0..100 (55) |

### DEL — 8 types

| id | Type | Parameters (range, unit, default) |
| -- | ---- | --------------------------------- |
| 0 | BBD | Delay CC74 1..2000 ms (350); Feedback CC75 0..95 (48); Age CC76 0..100 (65); Mix CC77 0..100 (40) |
| 1 | Digital | Time CC74 0.1..3000 ms (350); Feedback CC75 0..95 (32); Mix CC76 0..100 (32) |
| 2 | Duck (1.12) | Time CC74 0.1..3000 ms (450); Feedback CC75 0..95 (42); Sensitivity CC76 0..100 (50); Depth CC77 0..100 (50); Attack CC78 0.1..100 ms (5); Release CC79 10..2000 ms (200); Filter S6 0..100 (55); Mix S7 0..100 (40) |
| 3 | Ice | Time CC74 0.1..3000 ms (501); Feedback CC75 0..95 (30); Interval CC76 −12..+12 st (12); Mix CC77 0..100 (40) |
| 4 | Reverse | Time CC74 0.1..3000 ms (600); Feedback CC75 0..95 (25); Mix CC76 0..100 (50) |
| 5 | LoFi | Time CC74 2..3000 ms (350); Feedback CC75 0..95 (40); Bit Depth CC76 4..16 bit (8); LoFi Mix CC77 0..100 (70); Mix CC78 0..100 (40) |
| 6 | Smear | Time CC74 0.1..3000 ms (651); Feedback CC75 0..95 (45); Smear CC76 0..100 (68); Filter CC77 0..100 (42); Mix CC78 0..100 (40) |
| 7 | Mod Delay | Time CC74 0.1..3000 ms (420); Feedback CC75 0..95 (38); Mod Depth CC76 0..20 ms (4); Mod Rate CC77 0.05..5 Hz (1); Mix CC78 0..100 (40) |

1.2 adds a left/right ping-pong option to every delay algorithm [REL]; the editor's
current delay specs do not expose a separate ping-pong control, so this remains a
release-note-level claim rather than a mapped parameter.

### REV — 7 types

| id | Type | Parameters (range, unit, default) |
| -- | ---- | --------------------------------- |
| 0 | Room | Decay CC85 0.5..12 s (1.2); Pre Delay CC86 0..80 ms (5); Tone CC87 0..100 (65); Mod CC88 0..100 (10); Mix CC89 0..100 (30) |
| 1 | Plate | Decay CC85 0.5..12 s (2.5); Pre Delay CC86 0..80 ms (12); Tone CC87 0..100 (70); Mod CC88 0..100 (25); Mix CC89 0..100 (35) |
| 2 | Hall | Decay CC85 0.5..12 s (4); Pre Delay CC86 0..80 ms (24); Tone CC87 0..100 (58); LF Damp CC88 0..100 (40); Mix CC89 0..100 (38) |
| 3 | Concert | Decay CC85 0.5..12 s (5.5); Pre Delay CC86 0..80 ms (32); HF Damp CC87 0..100 (55); Mod CC88 0..100 (30); Mix CC89 0..100 (40) |
| 4 | Shimmer | Decay CC85 0..12 s (3.2); Pre Delay CC86 5..120 ms (5); Tone CC87 0..100 (58); Pitch CC88 −24..+24 st (12); Mix CC89 0..100 (50) |
| 5 | Cloud | Decay CC85 1..100 s (55); Tone CC86 0..100 (75); Mod Depth CC87 0..100 (40); Mod Rate CC88 0.02..0.25 Hz (0.1); Mix CC89 0..100 (50) |
| 6 | Spring | Decay CC85 0..12 s (2); Pre Delay CC86 5..80 ms (20); Crossover CC87 800..8000 Hz (4501); **Tone CC88 0..100 (20)** *(1.12)*; Mix CC89 0..100 (50) |

### EQ — 3 types

| id | Type | Parameters (range, unit, default) |
| -- | ---- | --------------------------------- |
| 0 | 3-band EQ | Low CC91, Mid CC92, High CC93 each −15..+15 dB (0); Level S3 −12..+12 dB (0) |
| 1 | 6-band EQ | 120/250/500 Hz, 1/2/4 kHz (CC91–96) each −15..+15 dB (0); Level S6 −12..+12 dB (0) |
| 2 | 8-band EQ | 60/120/250/500 Hz, 1/2/4/8 kHz (CC91–97, CC33) each −15..+15 dB (0); Level S8 −12..+12 dB (0) |

### Synth mode (firmware 1.2+, blockId 10, enable field 0x0a) — 10 voices

Not part of the 8-slot reorderable chain; a separate parallel mode. All params are
SysEx-only. Attack (where present) is 2..400 ms with a quadratic taper `2 + 398*t²` [HW].

| id | Voice | Parameters (range, unit, default) |
| -- | ----- | --------------------------------- |
| 0 | Analog Synth | Wave S0 {Sine,Saw,Square,Triangle,Pulse} (1); Attack S1 2..400 ms quad (5); Release S2 0..100 (50); Detune S3 0..20 ct (5); Tone S4 0..100 (68); Mix S5 0..100 (100) |
| 1 | Strings | Attack S0 2..400 ms quad (83); Release S1 0..100 (72); Ensemble S2 0..100 (50); Tone S3 0..100 (55); Mix S4 0..100 (100) |
| 2 | Pad | Tone S0 0..100 (100); Decay S1 0..100 (50); Mix S2 0..100 (100) |
| 3 | Choir | Attack S0 2..400 ms quad (122); Release S1 0..100 (70); Vowel S2 0..100 (20); Tone S3 0..100 (60); Mix S4 0..100 (100) |
| 4 | Brass | Attack S0 2..400 ms quad (25); Release S1 0..100 (50); Bite S2 0..100 (60); Tone S3 0..100 (70); Mix S4 0..100 (100) |
| 5 | Organ | Attack S0 2..400 ms quad (3); Release S1 0..100 (25); Harmonics S2 0..100 (60); Tone S3 0..100 (85); Mix S4 0..100 (100) |
| 6 | Flute | Attack S0 2..400 ms quad (40); Release S1 0..100 (45); Breath S2 0..100 (35); Tone S3 0..100 (70); Mix S4 0..100 (100) |
| 7 | Lead | Tone S0 0..100 (100); Decay S1 0..100 (50); Mix S2 0..100 (100) |
| 8 | Bass | Attack S0 2..400 ms quad (2); Release S1 0..100 (30); Sub Level S2 0..100 (70); Tone S3 0..100 (40); Mix S4 0..100 (100) |
| 9 | Pluck | Tone S0 0..100 (100); Decay S1 0..100 (50); Mix S2 0..100 (100) |

## 6. Firmware-level cross-check (1.12) [FW]

`re-nanocore/evidence/effect-catalog-1.12.json` lists the firmware's own selector entries.
These are **internal subtypes/picker slots**, not the CC values shown to users — do not
equate them with the editor ids above.

| Family | Internal subtypes / names | Picker count |
| --- | --- | --- |
| FX1 | 0 GATE, 1 AUTO GATE, 2 NG+COM, 3 COMP | 4 |
| FX2 | 0–7 drive model slots, 8 PITCH, 9 ENV WAH, 10 WAH, 11 MOTION WAH | 12 |
| AMP | AMP model | 1 (30 models selected by metadata) |
| CAB | CAB / IR | 1 (30 IRs selected by metadata) |
| MOD | 0 CHORUS, 1 PHASER, 2 FLANGER, 3 TREMOLO, 4 VIBRATO, 10 VELVET VIBRATO, 11 CHORUS II, 12 PHASER II, 17 JET FLANGER | 9 |
| DEL | 0 BBD, 1 DIGITAL, 2 DUCK, 3 ICE, 4 REVERSE, 5 LOFI, 6 SMEAR, 7 MOD | 8 |
| REV | 0 ROOM, 1 PLATE, 2 HALL, 3 CONCERT, 4 HALL (alias), 5 SHIMMER, 6 CLOUD, 7 SPRING | 8 entries / 7 distinct |
| EQ | 0 EQ3, 1 EQ6, 2 EQ8 | 3 |
| GAT | 0 GATE, 1 AUTO GATE (internal alias of FX1's dynamics processor) | — |
| EXP | 0 VOLUME, 1 PAN, 2 WIDTH, 3 WAH (expression/support family) | — |

MOD ids are non-contiguous (5–9 and 13–16 select nothing on hardware [HW]); the firmware
catalogue confirms exactly ids 0,1,2,3,4,10,11,12,17. REV's internal subtype 4 is an alias
of HALL, which is why the three user-facing CC47 values 4/5/6 (Shimmer/Cloud/Spring) are
internal subtypes 5/6/7. The `EXP` and `GAT` families are internal/expression processors,
not user-facing chain blocks.

## 7. Evidence gaps / open questions

1. **Exact introduction version of the four post-1.04 MOD additions** (Velvet Vibrato,
   Chorus II, Phaser II, Jet Flanger). Present in 1.12 [FW], absent from the 1.04 manual;
   bounded to 1.11–1.12. FX2 Motion Wah, by contrast, is confirmed present in 1.11 [FW].
2. **1.2 vs 1.3.5 boundary for the 17 new FX types.** [REL]+[FW] attribute the comp/wah
   types to 1.2; ids and full parameter values were only captured on 1.3.5 [HW].
3. **1.2 ping-pong on every delay** is [REL]/[FW label] only; not exposed as an editor
   parameter, so no per-type range is known.
4. **1.2 NAM A2-Lite** is format-fingerprinted [FW] (32-byte header + 1871 float32 weights,
   48 kHz only), but numerical/audio equivalence and arbitrary-NAM support are unverified.
5. **1.12 CAB Output Level** persistence/gain application was not measured in the
   firmware comparison; presence and CC mapping are [HW].
6. **1.11 pitch latency, FX2 click fix, Bluetooth-off advertising** are [FW static] /
   unverified; do not treat them as measured improvements.
7. **Synth reachability in 1.12** — synth strings exist in the 1.12 binary but block-10
   registration was not traced; 1.2/1.3.5 synth mapping is [HW].
8. **Parallel Comp Attack/Release curve** (1.3.5) is unmapped; ranges are correct, taper unknown.
9. **No firmware-version query opcode exists.** The `0x65` global-settings byte 0 is a
   settings-layout marker (1 or 2), not a version — the editor detects a capability
   signature, not a version string. Never present the marker as a version number.
10. **Mosaic** speaks the same SysEx protocol byte-for-byte [HW]; this history applies to
    both devices unless a finding explicitly names NanoCore only.

## 8. Reproducing / verifying

- Current effect/ranges: read the block files listed in Provenance; the test suite checks
  the spec shape: `cd /home/anvi/Projects/livtra-nanocore-editor && npm test`.
- Modified-firmware ranges in §4.5: `cd /home/anvi/Projects/nanocore-live && npm test`
  (90 tests, including the Octave/UniVibe replacement assertions), or print them directly:
  `node --input-type=module -e "import {typesFor} from './src/core/versions.js'; console.log(typesFor('fx2','1.2-modified').find(t=>t.slug==='octave').params)"`.
  The displayed percentages are UI scaling; the DSP-side normalized values are in
  `re-nanocore/evidence/octave-full-controls-integration.json` and
  `re-nanocore/docs/custom-fx-univibe-controls.txt`.
- 1.11/1.12 parameter tables: `cd /home/anvi/Projects/re-nanocore && python3 -m json.tool evidence/firmware-parameter-tables.json`.
- 1.12 selector catalogue: `python3 -c "import json,collections;d=json.load(open('evidence/effect-catalog-1.12.json'));print(collections.Counter(e['family'] for e in d['effects']))"`.
- Official release notes snapshot: `evidence/firmware-release-notes.json` in re-nanocore.
- Live source URLs (not fetched by this document): the manual/MIDI-guide links in
  `packages/protocol/src/data/deviceInfo.ts`, and `https://www.livtramusic.com/downloads?device=NANOCORE`.
