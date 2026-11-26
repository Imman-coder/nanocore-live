// Original firmware 1.10 — effect parameters by block
// Generated from packages/protocol/src/data/blocks/*.ts (the hardware-verified canonical
// spec), with version gates from docs/FIRMWARE_VERSION_HISTORY.md §§3-4.
// Baseline catalogue (docs/FIRMWARE_VERSION_HISTORY.md §3): FX1 ids 0-3, FX2 ids 0-10,
// MOD ids 0-4, 4-param Duck, FX2 Pitch +/-12 st, Spring CC88 = "Mod", no CAB Level, no Synth.
// Motion Wah (FX2 id 11) is present from 1.11 [FW], so it is deliberately absent here.
// P() = parameter, T() = type. Edit the tables below directly.
// cc: null means SysEx-only (sysexParamIndex is its positional index); never send a CC for it.
const P = (value) => value;
const T = (value) => value;

export const VERSION = {
  fx1: {
    common: [],
    types: [
      T({
        id: 0, variant: 0, slug: 'gate', name: 'Gate',
        description: 'Eliminates low-level noise and purifies the input signal.',
        params: [
          P({ kind: 'range', id: 'threshold', label: 'Threshold', cc: 50, min: -100, max: 0, unit: 'dB', default: -80 }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, sysexParamIndex: 1, min: 5, max: 100, unit: 'ms', decimals: 1, default: 50 }),
        ],
      }),
      T({
        id: 1, variant: 1, slug: 'auto_gate', name: 'Auto Gate',
        description: 'Adaptive noise gate that automatically adjusts the threshold based on signal level changes.',
        params: [
          P({ kind: 'range', id: 'sensitivity', label: 'Sensitivity', cc: null, sysexParamIndex: 0, min: -6, max: 60, unit: 'dB', decimals: 1, default: 27 }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, sysexParamIndex: 1, min: 20, max: 300, unit: 'ms', decimals: 1, default: 109.9 }),
        ],
      }),
      T({
        id: 2, variant: 2, slug: 'gate_compressor', name: 'Gate + Compressor (NC-Com)', shortName: "NG+Comp",
        description: 'Noise Gate + Compressor combo; simultaneously optimizes noise floor and dynamic range.',
        params: [
          P({ kind: 'range', id: 'gate_threshold', label: 'Gate Threshold', cc: 50, min: -100, max: 0, unit: 'dB', default: -80 }),
          P({ kind: 'range', id: 'comp_threshold', label: 'Compressor Threshold', cc: 51, min: -60, max: 0, unit: 'dB', default: -20 }),
          P({ kind: 'range', id: 'ratio', label: 'Ratio', cc: 52, min: 1, max: 20, unit: ':1', decimals: 1, default: 4 }),
          P({ kind: 'range', id: 'knee', label: 'Knee', cc: 53, min: 0, max: 24, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'attack', label: 'Attack', cc: 54, min: 0, max: 200, unit: 'ms', default: 10 }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: 55, min: 0, max: 1000, unit: 'ms', default: 100 }),
          P({ kind: 'range', id: 'makeup', label: 'Makeup', cc: 56, min: -24, max: 24, unit: 'dB', default: 0 }),
        ],
      }),
      T({
        id: 3, variant: 3, slug: 'compressor', name: 'Compressor',
        description: 'Smooths volume fluctuations and stabilizes tone quality.',
        params: [
          P({ kind: 'range', id: 'comp_threshold', label: 'Threshold', cc: 51, min: -60, max: 0, unit: 'dB', default: -20 }),
          P({ kind: 'range', id: 'ratio', label: 'Ratio', cc: 52, min: 1, max: 20, unit: ':1', decimals: 1, default: 4 }),
          P({ kind: 'range', id: 'knee', label: 'Knee', cc: 53, min: 0, max: 24, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'attack', label: 'Attack', cc: 54, min: 0, max: 200, unit: 'ms', default: 10 }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: 55, min: 0, max: 1000, unit: 'ms', default: 100 }),
          P({ kind: 'range', id: 'makeup', label: 'Makeup', cc: 56, min: -24, max: 24, unit: 'dB', default: 0 }),
        ],
      }),
    ],
  },
  fx2: {
    common: [],
    types: [
      T({
        id: 0, variant: 0, slug: 'scream', name: 'Scream',
        description: 'Based on Ibanez TS9 pedal modeling.',
        params: [
          P({ kind: 'range', id: 'gain', label: 'Gain', cc: 57, min: 0, max: 1, decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 58, min: 0, max: 100, default: 50 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: 59, min: 0, max: 100, default: 80 }),
        ],
      }),
      T({
        id: 1, variant: 1, slug: 'klone', name: 'Klone',
        description: 'Based on Ryra The Klone pedal modeling.',
        params: [
          P({ kind: 'range', id: 'gain', label: 'Gain', cc: 57, min: 0, max: 1, decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 58, min: 0, max: 100, default: 50 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: 59, min: 0, max: 100, default: 80 }),
        ],
      }),
      T({
        id: 2, variant: 2, slug: 'ocd', name: 'OCD',
        description: 'Based on Fulltone OCD pedal modeling.',
        params: [
          P({ kind: 'range', id: 'gain', label: 'Gain', cc: 57, min: 0, max: 1, decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 58, min: 0, max: 100, default: 50 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: 59, min: 0, max: 100, default: 80 }),
        ],
      }),
      T({
        id: 3, variant: 3, slug: 'ds2', name: 'DS2',
        description: 'Based on Boss DS-2 pedal modeling.',
        params: [
          P({ kind: 'range', id: 'gain', label: 'Gain', cc: 57, min: 0, max: 1, decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 58, min: 0, max: 100, default: 50 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: 59, min: 0, max: 100, default: 80 }),
        ],
      }),
      T({
        id: 4, variant: 4, slug: 'pifuzz', name: 'PIFUZZ',
        description: 'Based on EHX Big Muff Pi pedal modeling.',
        params: [
          P({ kind: 'range', id: 'gain', label: 'Gain', cc: 57, min: 0, max: 1, decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 58, min: 0, max: 100, default: 50 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: 59, min: 0, max: 100, default: 80 }),
        ],
      }),
      T({
        id: 5, variant: 5, slug: 'range', name: 'Range',
        description: 'Based on Dallas-Arbiter Rangemaster pedal modeling.',
        params: [
          P({ kind: 'range', id: 'gain', label: 'Gain', cc: 57, min: 0, max: 1, decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 58, min: 0, max: 100, default: 50 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: 59, min: 0, max: 100, default: 80 }),
        ],
      }),
      T({
        id: 6, variant: 6, slug: 'xac', name: 'XAC',
        description: 'Based on Xotic AC Booster pedal modeling.',
        params: [
          P({ kind: 'range', id: 'gain', label: 'Gain', cc: 57, min: 0, max: 1, decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 58, min: 0, max: 100, default: 50 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: 59, min: 0, max: 100, default: 80 }),
        ],
      }),
      T({
        id: 7, variant: 7, slug: 'fiman', name: 'Fiman',
        description: 'Based on Friedman Marty Friedman pedal modeling.',
        params: [
          P({ kind: 'range', id: 'gain', label: 'Gain', cc: 57, min: 0, max: 1, decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 58, min: 0, max: 100, default: 50 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: 59, min: 0, max: 100, default: 80 }),
        ],
      }),
      T({
        id: 8, variant: 8, slug: 'pitch', name: 'Pitch',
        description: 'Pitch shift effect; changes the signal pitch.',
        note: 'Shares CC68-73 with the MOD block. While FX2 is set to Pitch, Envelope Wah or Wah, those six CCs control this effect instead of MOD — see docs/MIDI_MAPPING_NOTES.md. Tip — same trick as the Wah type\'s pedal tip works here for a Digitech Whammy-style effect: map an external MIDI expression pedal directly to CC68 (Pitch, -12~+12 semitones) at the MIDI level (not through this send-only editor) for real-time foot-controlled pitch bending.',
        params: [
          P({ kind: 'range', id: 'pitch', label: 'Pitch', cc: 68, min: -24, max: 12, unit: 'st', default: 0 }),
          P({ kind: 'range', id: 'fine', label: 'Fine', cc: 69, min: -1, max: 1, decimals: 2, default: 0 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 70, min: 0, max: 100, default: 100 }),
        ],
      }),
      T({
        id: 9, variant: 9, slug: 'envelope_wah', name: 'Envelope Wah',
        description: 'Auto-triggered filter sweep based on playing dynamics.',
        note: 'Shares CC68-73 with the MOD block. While FX2 is set to Pitch, Envelope Wah or Wah, those six CCs control this effect instead of MOD — see docs/MIDI_MAPPING_NOTES.md.',
        params: [
          P({ kind: 'range', id: 'freq', label: 'Freq', cc: 68, min: 10, max: 20000, unit: 'Hz', format: 'freq', curve: 'exp', default: 400 }),
          P({ kind: 'range', id: 'env', label: 'Env', cc: 69, min: 0, max: 20000, unit: 'Hz', format: 'freq', default: 1000 }),
          P({ kind: 'range', id: 'q', label: 'Q', cc: 70, min: 0.1, max: 20, decimals: 1, default: 8 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 71, min: 0, max: 100, default: 80 }),
        ],
      }),
      T({
        id: 10, variant: 10, slug: 'wah', name: 'Wah',
        description: 'Cyclic sweep filter with a set waveform.',
        note: 'Shares CC68-73 with the MOD block. While FX2 is set to Pitch, Envelope Wah or Wah, those six CCs control this effect instead of MOD — see docs/MIDI_MAPPING_NOTES.md. Tip — emulating a classic pedal-controlled wah: set Rate and Sweep to 0 (disables the automatic cyclic sweep), then map an external MIDI expression pedal directly to CC68 (Freq, confirmed 163Hz-3.5kHz on hardware) at the MIDI level. This editor is send-only and does not listen for MIDI input, so the pedal doesn\'t go through the app — connect it straight to the NanoCore\'s MIDI bus (USB-MIDI hub, or NanoCore MIDI over Bluetooth) on a matching channel, and your foot position drives Freq in real time exactly like a physical treadle would.',
        params: [
          P({ kind: 'range', id: 'freq', label: 'Freq', cc: 68, min: 163, max: 3500, unit: 'Hz', format: 'freq', curve: 'exp', default: 800 }),
          P({ kind: 'range', id: 'sweep', label: 'Sweep', cc: 69, min: 0, max: 100, default: 50 }),
          P({ kind: 'range', id: 'rate', label: 'Rate', cc: 70, min: 0, max: 8, unit: 'Hz', decimals: 2, default: 1.5 }),
          P({ kind: 'range', id: 'shape', label: 'Shape', cc: 71, min: 0, max: 100, default: 0 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 72, min: 0, max: 100, default: 80 }),
        ],
      }),
    ],
  },
  amp: {
    common: [],
    types: [
    ],
  },
  cab: {
    common: [],
    types: [
    ],
  },
  mod: {
    common: [],
    types: [
      T({
        id: 0, variant: 0, slug: 'chorus', name: 'Chorus',
        description: 'Classic chorus effect; widens the soundstage for a fuller, thicker tone.',
        params: [
          P({ kind: 'range', id: 'rate', label: 'Rate', cc: 68, min: 0.1, max: 3.74, unit: 'Hz', decimals: 2, default: 2.3 }),
          P({ kind: 'range', id: 'depth', label: 'Depth', cc: 69, min: 0, max: 1, unit: 'ms', decimals: 2, default: 0.5 }),
        ],
      }),
      T({
        id: 1, variant: 1, slug: 'phaser', name: 'Phaser',
        description: 'Phaser effect; periodic sweep filtering for a swirling, moving tone.',
        params: [
          P({ kind: 'range', id: 'rate', label: 'Rate', cc: 68, min: 0.05, max: 5, unit: 'Hz', decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: 69, min: -95, max: 95, default: 20 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 70, min: 0, max: 100, default: 40 }),
        ],
      }),
      T({
        id: 2, variant: 2, slug: 'flanger', name: 'Flanger',
        description: 'Flanger effect; comb-filtering creates an ethereal, metallic floating texture.',
        params: [
          P({ kind: 'range', id: 'rate', label: 'Rate', cc: 68, min: 0.05, max: 5, unit: 'Hz', decimals: 2, default: 0.8 }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: 69, min: -95, max: 95, default: 55 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 70, min: 0, max: 100, default: 35 }),
        ],
      }),
      T({
        id: 3, variant: 3, slug: 'tremolo', name: 'Tremolo',
        description: 'Volume tremolo; cyclically fluctuates volume based on waveform.',
        params: [
          P({ kind: 'range', id: 'rate', label: 'Rate', cc: 68, min: 0.01, max: 20, unit: 'Hz', decimals: 2, default: 5.01 }),
          P({ kind: 'range', id: 'depth', label: 'Depth', cc: 69, min: 0, max: 100, default: 60 }),
          P({ kind: 'enum', id: 'wave', label: 'Wave', cc: 70, options: ['Sine', 'Triangle', 'Square', 'Saw'], default: 0 }),
          P({ kind: 'range', id: 'smooth', label: 'Smooth', cc: 71, min: 0, max: 40, unit: 'Hz', decimals: 2, default: 0 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 72, min: 0, max: 100, default: 100 }),
        ],
      }),
      T({
        id: 4, variant: 4, slug: 'vibrato', name: 'Vibrato',
        description: 'Pitch vibrato; subtly fluctuates pitch to enrich the tone.',
        params: [
          P({ kind: 'range', id: 'rate', label: 'Rate', cc: 68, min: 0.01, max: 20, unit: 'Hz', decimals: 2, default: 9.01 }),
          P({ kind: 'range', id: 'depth', label: 'Depth', cc: 69, min: 0, max: 20, unit: 'ms', decimals: 1, default: 0.4 }),
          P({ kind: 'enum', id: 'wave', label: 'Wave', cc: 70, options: ['Sine', 'Triangle', 'Square', 'Saw'], default: 0 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 71, min: 0, max: 100, default: 80 }),
        ],
      }),
    ],
  },
  del: {
    common: [],
    types: [
      T({
        id: 0, variant: 0, slug: 'bbd', name: 'BBD',
        description: 'Classic BBD analog delay; vintage warm tape delay texture.',
        params: [
          P({ kind: 'range', id: 'delay', label: 'Delay', cc: 74, min: 1, max: 2000, unit: 'ms', format: 'time', default: 350 }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: 75, min: 0, max: 95, default: 48 }),
          P({ kind: 'range', id: 'age', label: 'Age', cc: 76, min: 0, max: 100, default: 65 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 77, min: 0, max: 100, default: 40 }),
        ],
      }),
      T({
        id: 1, variant: 1, slug: 'digital', name: 'Digital',
        description: 'Clean digital delay; clear and transparent tone, suitable for various genres.',
        params: [
          P({ kind: 'range', id: 'time', label: 'Time', cc: 74, min: 0.1, max: 3000, unit: 'ms', format: 'time', default: 350 }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: 75, min: 0, max: 95, default: 32 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 76, min: 0, max: 100, default: 32 }),
        ],
      }),
      T({
        id: 2, variant: 2, slug: 'duck', name: 'Duck',
        description: 'Duck delay; automatically lowers delay tail during playing to avoid muddiness.',
        params: [
          P({ kind: 'range', id: 'time', label: 'Time', cc: 74, min: 0.1, max: 3000, unit: 'ms', format: 'time', default: 450 }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: 75, min: 0, max: 95, default: 42 }),
          P({ kind: 'range', id: 'filter', label: 'Filter', cc: 76, min: 0, max: 100, default: 55 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 77, min: 0, max: 100, default: 40 }),
        ],
      }),
      T({
        id: 3, variant: 3, slug: 'ice', name: 'Ice',
        description: 'Ice pitch-shift delay; delayed signal with pitch offset for ethereal atmosphere.',
        params: [
          P({ kind: 'range', id: 'time', label: 'Time', cc: 74, min: 0.1, max: 3000, unit: 'ms', format: 'time', default: 501 }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: 75, min: 0, max: 95, default: 30 }),
          P({ kind: 'range', id: 'interval', label: 'Interval', cc: 76, min: -12, max: 12, unit: 'st', default: 12 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 77, min: 0, max: 100, default: 40 }),
        ],
      }),
      T({
        id: 4, variant: 4, slug: 'reverse', name: 'Reverse',
        description: 'Reverse delay; plays back delay signal in reverse for a dreamy spatial effect.',
        params: [
          P({ kind: 'range', id: 'time', label: 'Time', cc: 74, min: 0.1, max: 3000, unit: 'ms', format: 'time', default: 600 }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: 75, min: 0, max: 95, default: 25 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 76, min: 0, max: 100, default: 50 }),
        ],
      }),
      T({
        id: 5, variant: 5, slug: 'lofi', name: 'LoFi',
        description: 'Lo-fi delay; bit-rate distortion creates vintage degraded tape texture.',
        params: [
          P({ kind: 'range', id: 'time', label: 'Time', cc: 74, min: 2, max: 3000, unit: 'ms', format: 'time', default: 350 }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: 75, min: 0, max: 95, default: 40 }),
          P({ kind: 'range', id: 'bit_depth', label: 'Bit Depth', cc: 76, min: 4, max: 16, unit: 'bit', default: 8 }),
          P({ kind: 'range', id: 'lofi_mix', label: 'LoFi Mix', cc: 77, min: 0, max: 100, default: 70 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 78, min: 0, max: 100, default: 40 }),
        ],
      }),
      T({
        id: 6, variant: 6, slug: 'smear', name: 'Smear',
        description: 'Smear delay; softens and blurs delay signal for a gentle spatial diffusion.',
        params: [
          P({ kind: 'range', id: 'time', label: 'Time', cc: 74, min: 0.1, max: 3000, unit: 'ms', format: 'time', default: 651 }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: 75, min: 0, max: 95, default: 45 }),
          P({ kind: 'range', id: 'smear', label: 'Smear', cc: 76, min: 0, max: 100, default: 68 }),
          P({ kind: 'range', id: 'filter', label: 'Filter', cc: 77, min: 0, max: 100, default: 42 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 78, min: 0, max: 100, default: 40 }),
        ],
      }),
      T({
        id: 7, variant: 7, slug: 'mod_delay', name: 'Mod Delay',
        description: 'Modulated delay; delay with tremolo wobble for richer tonal layers.',
        params: [
          P({ kind: 'range', id: 'time', label: 'Time', cc: 74, min: 0.1, max: 3000, unit: 'ms', format: 'time', default: 420 }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: 75, min: 0, max: 95, default: 38 }),
          P({ kind: 'range', id: 'mod_depth', label: 'Mod Depth', cc: 76, min: 0, max: 20, unit: 'ms', default: 4 }),
          P({ kind: 'range', id: 'mod_rate', label: 'Mod Rate', cc: 77, min: 0.05, max: 5, unit: 'Hz', decimals: 2, default: 1 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 78, min: 0, max: 100, default: 40 }),
        ],
      }),
    ],
  },
  rev: {
    common: [],
    types: [
      T({
        id: 0, variant: 1, slug: 'room', name: 'Room',
        description: 'Room reverb; simulates a small indoor space with a compact, natural sound.',
        params: [
          P({ kind: 'range', id: 'decay', label: 'Decay', cc: 85, min: 0.5, max: 12, unit: 's', decimals: 1, default: 1.2 }),
          P({ kind: 'range', id: 'pre_delay', label: 'Pre Delay', cc: 86, min: 0, max: 80, unit: 'ms', default: 5 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 87, min: 0, max: 100, default: 65 }),
          P({ kind: 'range', id: 'mod', label: 'Mod', cc: 88, min: 0, max: 100, default: 10 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 89, min: 0, max: 100, default: 30 }),
        ],
      }),
      T({
        id: 1, variant: 2, slug: 'plate', name: 'Plate',
        description: 'Plate reverb; classic metal plate vintage tone, warm and smooth.',
        params: [
          P({ kind: 'range', id: 'decay', label: 'Decay', cc: 85, min: 0.5, max: 12, unit: 's', decimals: 1, default: 2.5 }),
          P({ kind: 'range', id: 'pre_delay', label: 'Pre Delay', cc: 86, min: 0, max: 80, unit: 'ms', default: 12 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 87, min: 0, max: 100, default: 70 }),
          P({ kind: 'range', id: 'mod', label: 'Mod', cc: 88, min: 0, max: 100, default: 25 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 89, min: 0, max: 100, default: 35 }),
        ],
      }),
      T({
        id: 2, variant: 3, slug: 'hall', name: 'Hall',
        description: 'Hall reverb; simulates a large concert hall with a wide, grand spatial feel.',
        params: [
          P({ kind: 'range', id: 'decay', label: 'Decay', cc: 85, min: 0.5, max: 12, unit: 's', decimals: 1, default: 4 }),
          P({ kind: 'range', id: 'pre_delay', label: 'Pre Delay', cc: 86, min: 0, max: 80, unit: 'ms', default: 24 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 87, min: 0, max: 100, default: 58 }),
          P({ kind: 'range', id: 'lf_damp', label: 'LF Damp', cc: 88, min: 0, max: 100, default: 40 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 89, min: 0, max: 100, default: 38 }),
        ],
      }),
      T({
        id: 3, variant: 4, slug: 'concert', name: 'Concert',
        description: 'Concert hall reverb; transparent and structured, ideal for solo performances.',
        params: [
          P({ kind: 'range', id: 'decay', label: 'Decay', cc: 85, min: 0.5, max: 12, unit: 's', decimals: 1, default: 5.5 }),
          P({ kind: 'range', id: 'pre_delay', label: 'Pre Delay', cc: 86, min: 0, max: 80, unit: 'ms', default: 32 }),
          P({ kind: 'range', id: 'hf_damp', label: 'HF Damp', cc: 87, min: 0, max: 100, default: 55 }),
          P({ kind: 'range', id: 'mod', label: 'Mod', cc: 88, min: 0, max: 100, default: 30 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 89, min: 0, max: 100, default: 40 }),
        ],
      }),
      T({
        id: 4, variant: 5, slug: 'shimmer', name: 'Shimmer',
        description: 'Shimmer reverb; pitch-shifted overtones create an ethereal, dreamy atmosphere.',
        params: [
          P({ kind: 'range', id: 'decay', label: 'Decay', cc: 85, min: 0, max: 12, unit: 's', decimals: 1, default: 3.2 }),
          P({ kind: 'range', id: 'pre_delay', label: 'Pre Delay', cc: 86, min: 5, max: 120, unit: 'ms', default: 5 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 87, min: 0, max: 100, default: 58 }),
          P({ kind: 'range', id: 'pitch', label: 'Pitch', cc: 88, min: -24, max: 24, unit: 'st', default: 12 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 89, min: 0, max: 100, default: 50 }),
        ],
      }),
      T({
        id: 5, variant: 6, slug: 'cloud', name: 'Cloud',
        description: 'Cloud ambient reverb; ultra-long decay with soft modulation for a floating environmental feel.',
        params: [
          P({ kind: 'range', id: 'decay', label: 'Decay', cc: 85, min: 1, max: 100, unit: 's', decimals: 0, default: 55 }),
          P({ kind: 'range', id: 'tone', label: 'Tone', cc: 86, min: 0, max: 100, default: 75 }),
          P({ kind: 'range', id: 'mod_depth', label: 'Mod Depth', cc: 87, min: 0, max: 100, default: 40 }),
          P({ kind: 'range', id: 'mod_rate', label: 'Mod Rate', cc: 88, min: 0.02, max: 0.25, unit: 'Hz', decimals: 2, default: 0.1 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 89, min: 0, max: 100, default: 50 }),
        ],
      }),
      T({
        id: 6, variant: 7, slug: 'spring', name: 'Spring',
        description: 'Spring reverb; emulates vintage amp spring reverb with retro-rock texture.',
        params: [
          P({ kind: 'range', id: 'decay', label: 'Decay', cc: 85, min: 0, max: 12, unit: 's', decimals: 1, default: 2 }),
          P({ kind: 'range', id: 'pre_delay', label: 'Pre Delay', cc: 86, min: 5, max: 80, unit: 'ms', default: 20 }),
          P({ kind: 'range', id: 'crossover', label: 'Crossover', cc: 87, min: 800, max: 8000, unit: 'Hz', format: 'freq', default: 4501 }),
          P({ kind: 'range', id: 'mod', label: 'Mod', cc: 88, min: 0, max: 100, default: 20 }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: 89, min: 0, max: 100, default: 50 }),
        ],
      }),
    ],
  },
  eq: {
    common: [],
    types: [
      T({
        id: 0, variant: 0, slug: 'eq3', name: '3-band EQ',
        description: 'Quickly adjust low, mid, and high frequencies.',
        params: [
          P({ kind: 'range', id: 'low', label: 'Low', cc: 91, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'mid', label: 'Mid', cc: 92, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'high', label: 'High', cc: 93, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: null, sysexParamIndex: 3, min: -12, max: 12, unit: 'dB', default: 0 }),
        ],
      }),
      T({
        id: 1, variant: 1, slug: 'eq6', name: '6-band EQ',
        description: 'Parametric multi-band fine-tuning of tone.',
        params: [
          P({ kind: 'range', id: 'b120', label: '120 Hz', cc: 91, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b250', label: '250 Hz', cc: 92, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b500', label: '500 Hz', cc: 93, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b1k', label: '1 kHz', cc: 94, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b2k', label: '2 kHz', cc: 95, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b4k', label: '4 kHz', cc: 96, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: null, sysexParamIndex: 6, min: -12, max: 12, unit: 'dB', default: 0 }),
        ],
      }),
      T({
        id: 2, variant: 2, slug: 'eq8', name: '8-band EQ',
        description: 'Full-range EQ; precise tonal shaping across the entire frequency spectrum.',
        params: [
          P({ kind: 'range', id: 'b60', label: '60 Hz', cc: 91, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b120', label: '120 Hz', cc: 92, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b250', label: '250 Hz', cc: 93, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b500', label: '500 Hz', cc: 94, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b1k', label: '1 kHz', cc: 95, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b2k', label: '2 kHz', cc: 96, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b4k', label: '4 kHz', cc: 97, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b8k', label: '8 kHz', cc: 33, min: -15, max: 15, unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: null, sysexParamIndex: 8, min: -12, max: 12, unit: 'dB', default: 0 }),
        ],
      }),
    ],
  },
  synth: {
    common: [],
    types: [
    ],
  },
};
