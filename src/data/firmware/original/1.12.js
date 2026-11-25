// Original firmware 1.12 — effect parameters by block
// One file per version; grouped by FX block.
// P() = parameter, T() = type. Edit the tables below directly.
// cc: null means SysEx-only; never send a CC for it.
const P = (value) => value;
const T = (value) => value;

export const VERSION = {
  fx1: {
    common: [],
    types: [
      T({
        id: 0, slug: 'gate', name: 'Gate', description: 'Eliminates low-level noise and purifies the input signal.', variant: 0,
        params: [
          P({ kind: 'range', id: 'gate_release', label: 'Gate Release', cc: null, min: 5, max: 100, unit: 'ms', decimals: 0, step: null }),
        ],
      }),
      T({
        id: 1, slug: 'auto_gate', name: 'Auto Gate', description: 'Adaptive noise gate that automatically adjusts the threshold based on signal level changes.', variant: 1,
        params: [
          P({ kind: 'range', id: 'sensitivity', label: 'Sensitivity', cc: null, min: -6, max: 60, unit: 'dB', decimals: 1, step: null }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, min: 20, max: 300, unit: 'ms', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 2, slug: 'gate_compressor', name: 'Gate + Compressor (NC-Com)', description: 'Noise Gate + Compressor combo; simultaneously optimizes noise floor and dynamic range.', variant: 2,
        params: [
          P({ kind: 'range', id: 'gate_threshold', cc: 50, min: -100, max: 0, label: 'Gate Threshold', unit: 'dB', default: -60 }),
          P({ kind: 'range', id: 'comp_threshold', cc: 51, min: -60, max: 0, label: 'Compressor Threshold', unit: 'dB', default: -20 }),
          P({ kind: 'range', id: 'ratio', cc: 52, min: 1.1, max: 20, label: 'Ratio', unit: ':1', decimals: 1, default: 4 }),
          P({ kind: 'range', id: 'knee', cc: 53, min: 0, max: 24, label: 'Knee', unit: 'dB', default: 6 }),
          P({ kind: 'range', id: 'attack', cc: 54, min: 0, max: 200, label: 'Attack', unit: 'ms', default: 10 }),
          P({ kind: 'range', id: 'release', cc: 55, min: 0, max: 1000, label: 'Release', unit: 'ms', default: 150 }),
          P({ kind: 'range', id: 'makeup', cc: 56, min: -24, max: 24, label: 'Makeup', unit: 'dB', default: 0 }),
        ],
      }),
      T({
        id: 3, slug: 'compressor', name: 'Compressor', description: 'Smooths volume fluctuations and stabilizes tone quality.', variant: 3,
        params: [
          P({ kind: 'range', id: 'comp_threshold', cc: 51, min: -60, max: 0, label: 'Threshold', unit: 'dB', default: -20 }),
          P({ kind: 'range', id: 'ratio', cc: 52, min: 1.1, max: 20, label: 'Ratio', unit: ':1', decimals: 1, default: 4 }),
          P({ kind: 'range', id: 'knee', cc: 53, min: 0, max: 24, label: 'Knee', unit: 'dB', default: 6 }),
          P({ kind: 'range', id: 'attack', cc: 54, min: 0, max: 200, label: 'Attack', unit: 'ms', default: 10 }),
          P({ kind: 'range', id: 'release', cc: 55, min: 0, max: 1000, label: 'Release', unit: 'ms', default: 150 }),
          P({ kind: 'range', id: 'makeup', cc: 56, min: -24, max: 24, label: 'Makeup', unit: 'dB', default: 0 }),
        ],
      }),
      T({
        id: 4, slug: 'env_wah', name: 'Env Wah', cc: null,
        params: [
          P({ kind: 'range', id: 'freq', label: 'Freq', cc: null, min: 10, max: 20000, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'env', label: 'Env', cc: null, min: 0, max: 20000, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'q', label: 'Q', cc: null, min: 0.1, max: 20, unit: '', decimals: 1, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
        ],
      }),
      T({
        id: 5, slug: 'wah', name: 'Wah', cc: null,
        params: [
          P({ kind: 'range', id: 'freq', label: 'Freq', cc: null, min: 163, max: 3500, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'sweep', label: 'Sweep', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'rate', label: 'Rate', cc: null, min: 0, max: 8, unit: 'Hz', decimals: 1, step: null }),
          P({ kind: 'range', id: 'shape', label: 'Shape', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
        ],
      }),
      T({
        id: 6, slug: 'motion_wah', name: 'Motion Wah', cc: null,
        params: [
          P({ kind: 'range', id: 'rate', label: 'Rate', cc: null, min: 0, max: 15, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'voice', label: 'Voice', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'sweep', label: 'Sweep', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
        ],
      }),
      T({
        id: 7, slug: 'peak_comp', name: 'Peak Comp', cc: null,
        params: [
          P({ kind: 'range', id: 'threshold', label: 'Threshold', cc: null, min: -60, max: 0, unit: 'dB', decimals: 1, step: null }),
          P({ kind: 'range', id: 'ratio', label: 'Ratio', cc: null, min: 1, max: 20, unit: ':1', decimals: 1, step: 0.2 }),
          P({ kind: 'range', id: 'attack', label: 'Attack', cc: null, min: 0, max: 32, unit: 'ms', decimals: 1, step: null }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, min: 0, max: 56, unit: 'ms', decimals: 1, step: null }),
          P({ kind: 'range', id: 'makeup', label: 'Makeup', cc: null, min: -24, max: 24, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 8, slug: 'parallel_comp', name: 'Parallel Comp', cc: null,
        params: [
          P({ kind: 'range', id: 'threshold', label: 'Threshold', cc: null, min: -60, max: 0, unit: 'dB', decimals: 1, step: null }),
          P({ kind: 'range', id: 'attack', label: 'Attack', cc: null, min: 0.01, max: 250, unit: 'ms', decimals: 2, step: null }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, min: 10, max: 2500, unit: 'ms', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 200, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'makeup', label: 'Makeup', cc: null, min: -24, max: 24, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 9, slug: 'classic_wah', name: 'Classic Wah', cc: null,
        params: [
          P({ kind: 'range', id: 'position', label: 'Position', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'low_freq', label: 'Low Freq', cc: null, min: 20, max: 500, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'high_freq', label: 'High Freq', cc: null, min: 500, max: 5000, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: null, min: -60, max: 6, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 10, slug: 'retro_wah', name: 'Retro Wah', cc: null,
        params: [
          P({ kind: 'range', id: 'position', label: 'Position', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'low_freq', label: 'Low Freq', cc: null, min: 20, max: 500, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'high_freq', label: 'High Freq', cc: null, min: 500, max: 5000, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: null, min: -60, max: 6, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 11, slug: 'bass_wah', name: 'Bass Wah', cc: null,
        params: [
          P({ kind: 'range', id: 'position', label: 'Position', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'q_trim', label: 'Q Trim', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'volume_trim', label: 'Volume Trim', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: null, min: -60, max: 6, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
    ],
  },
  fx2: {
    common: [],
    types: [
      T({
        id: 0, slug: 'scream', name: 'Scream', description: 'Based on Ibanez TS9 pedal modeling.', variant: 0,
        params: [
          P({ kind: 'range', id: 'gain', cc: 57, min: 0, max: 1, label: 'Gain', decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', cc: 58, min: 0, max: 100, label: 'Tone', default: 50 }),
          P({ kind: 'range', id: 'level', cc: 59, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 1, slug: 'klone', name: 'Klone', description: 'Based on Ryra The Klone pedal modeling.', variant: 1,
        params: [
          P({ kind: 'range', id: 'gain', cc: 57, min: 0, max: 1, label: 'Gain', decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', cc: 58, min: 0, max: 100, label: 'Tone', default: 50 }),
          P({ kind: 'range', id: 'level', cc: 59, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 2, slug: 'ocd', name: 'OCD', description: 'Based on Fulltone OCD pedal modeling.', variant: 2,
        params: [
          P({ kind: 'range', id: 'gain', cc: 57, min: 0, max: 1, label: 'Gain', decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', cc: 58, min: 0, max: 100, label: 'Tone', default: 50 }),
          P({ kind: 'range', id: 'level', cc: 59, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 3, slug: 'ds2', name: 'DS2', description: 'Based on Boss DS-2 pedal modeling.', variant: 3,
        params: [
          P({ kind: 'range', id: 'gain', cc: 57, min: 0, max: 1, label: 'Gain', decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', cc: 58, min: 0, max: 100, label: 'Tone', default: 50 }),
          P({ kind: 'range', id: 'level', cc: 59, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 4, slug: 'pifuzz', name: 'PIFUZZ', description: 'Based on EHX Big Muff Pi pedal modeling.', variant: 4,
        params: [
          P({ kind: 'range', id: 'gain', cc: 57, min: 0, max: 1, label: 'Gain', decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'tone', cc: 58, min: 0, max: 100, label: 'Tone', default: 50 }),
          P({ kind: 'range', id: 'level', cc: 59, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 5, slug: 'range', name: 'Range', description: 'Based on Dallas-Arbiter Rangemaster pedal modeling.', variant: 5,
        params: [
          P({ kind: 'range', id: 'boost', cc: 57, min: 0, max: 1, label: 'Boost', decimals: 2, default: 0.5 }),
        ],
      }),
      T({
        id: 6, slug: 'xac', name: 'XAC', description: 'Based on Xotic AC Booster pedal modeling.', variant: 6,
        params: [
          P({ kind: 'range', id: 'boost', cc: 57, min: 0, max: 1, label: 'Boost', decimals: 2, default: 0.5 }),
        ],
      }),
      T({
        id: 7, slug: 'fiman', name: 'Fiman', description: 'Based on Friedman Marty Friedman pedal modeling.', variant: 7,
        params: [
          P({ kind: 'range', id: 'boost', cc: 57, min: 0, max: 1, label: 'Boost', decimals: 2, default: 0.5 }),
        ],
      }),
      T({
        id: 8, slug: 'pitch', name: 'Pitch', description: 'Pitch shift effect; changes the signal pitch.', variant: 8,
        params: [
          P({ kind: 'range', id: 'pitch', label: 'Pitch', cc: null, min: -24, max: 24, unit: 'st', decimals: 0, step: null }),
          P({ kind: 'range', id: 'fine', label: 'Fine', cc: null, min: -1, max: 1, unit: 'st', decimals: 1, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
        ],
      }),
      T({
        id: 9, slug: 'envelope_wah', name: 'Envelope Wah', description: 'Auto-triggered filter sweep based on playing dynamics.', variant: 9,
        params: [
          P({ kind: 'range', id: 'freq', cc: 68, min: 10, max: 20000, label: 'Freq', unit: 'Hz', format: 'freq', default: 400 }),
          P({ kind: 'range', id: 'env', cc: 69, min: 0, max: 20000, label: 'Env', unit: 'Hz', format: 'freq', default: 2000 }),
          P({ kind: 'range', id: 'q', cc: 70, min: 0.1, max: 20, label: 'Q', decimals: 1, default: 2 }),
          P({ kind: 'range', id: 'mix', cc: 71, min: 0, max: 100, label: 'Mix', default: 100 }),
        ],
      }),
      T({
        id: 10, slug: 'wah', name: 'Wah', description: 'Cyclic sweep filter with a set waveform.', variant: 10,
        params: [
          P({ kind: 'range', id: 'freq', cc: 68, min: 163, max: 3500, label: 'Freq', unit: 'Hz', format: 'freq', default: 800 }),
          P({ kind: 'range', id: 'sweep', cc: 69, min: 0, max: 100, label: 'Sweep', default: 50 }),
          P({ kind: 'range', id: 'rate', cc: 70, min: 0, max: 8, label: 'Rate', unit: 'Hz', decimals: 2, default: 1 }),
          P({ kind: 'range', id: 'shape', cc: 71, min: 0, max: 100, label: 'Shape', default: 50 }),
          P({ kind: 'range', id: 'mix', cc: 72, min: 0, max: 100, label: 'Mix', default: 100 }),
          P({ kind: 'range', id: 'level', cc: 73, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 11, slug: 'motion_wah', name: 'Motion Wah', description: 'Cyclic wah filter from a later firmware update.', warning: 'Confirmed on real hardware: Sweep and Mix don\'t respond to MIDI — and not from the official Livtra app either, so this looks like a current firmware limitation rather than something specific to this editor. Only Rate and Voice (shown below) work; the other two are omitted here rather than shown as dead controls. See MIDI_MAPPING_NOTES.md.', variant: 11,
        params: [
          P({ kind: 'range', id: 'rate', cc: 68, min: 0, max: 15, label: 'Rate', unit: 'Hz', decimals: 1, default: 2 }),
          P({ kind: 'range', id: 'voice', cc: 69, min: 0, max: 100, label: 'Voice', default: 50 }),
        ],
      }),
      T({
        id: 12, slug: 'gate', name: 'Gate', cc: null,
        params: [
          P({ kind: 'range', id: 'threshold', label: 'Threshold', cc: null, min: -100, max: 0, unit: 'dB', decimals: 1, step: null }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, min: 5, max: 100, unit: 'ms', decimals: 0, step: null }),
        ],
      }),
      T({
        id: 13, slug: 'auto_gate', name: 'Auto Gate', cc: null,
        params: [
          P({ kind: 'range', id: 'sensitivity', label: 'Sensitivity', cc: null, min: -6, max: 60, unit: 'dB', decimals: 1, step: null }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, min: 20, max: 300, unit: 'ms', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 14, slug: 'gate_compressor', name: 'Gate + Compressor', cc: null,
        params: [
          P({ kind: 'range', id: 'gate_thresh', label: 'Gate Thresh', cc: null, min: -100, max: 0, unit: 'dB', decimals: 1, step: null }),
          P({ kind: 'range', id: 'comp_thresh', label: 'Comp Thresh', cc: null, min: -60, max: 0, unit: 'dB', decimals: 1, step: null }),
          P({ kind: 'range', id: 'ratio', label: 'Ratio', cc: null, min: 1, max: 20, unit: ':1', decimals: 1, step: 0.2 }),
          P({ kind: 'range', id: 'knee', label: 'Knee', cc: null, min: 0, max: 24, unit: 'dB', decimals: 0, step: null }),
          P({ kind: 'range', id: 'attack', label: 'Attack', cc: null, min: 0, max: 200, unit: 'ms', decimals: 0, step: null }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, min: 0, max: 1000, unit: 'ms', decimals: 0, step: null }),
          P({ kind: 'range', id: 'makeup', label: 'Makeup', cc: null, min: -24, max: 24, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 15, slug: 'compressor', name: 'Compressor', cc: null,
        params: [
          P({ kind: 'range', id: 'threshold', label: 'Threshold', cc: null, min: -60, max: 0, unit: 'dB', decimals: 1, step: null }),
          P({ kind: 'range', id: 'ratio', label: 'Ratio', cc: null, min: 1, max: 20, unit: ':1', decimals: 1, step: 0.2 }),
          P({ kind: 'range', id: 'knee', label: 'Knee', cc: null, min: 0, max: 24, unit: 'dB', decimals: 0, step: null }),
          P({ kind: 'range', id: 'attack', label: 'Attack', cc: null, min: 0, max: 200, unit: 'ms', decimals: 0, step: null }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, min: 0, max: 1000, unit: 'ms', decimals: 0, step: null }),
          P({ kind: 'range', id: 'makeup', label: 'Makeup', cc: null, min: -24, max: 24, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 16, slug: 'peak_comp', name: 'Peak Comp', cc: null,
        params: [
          P({ kind: 'range', id: 'threshold', label: 'Threshold', cc: null, min: -60, max: 0, unit: 'dB', decimals: 1, step: null }),
          P({ kind: 'range', id: 'ratio', label: 'Ratio', cc: null, min: 1, max: 20, unit: ':1', decimals: 1, step: 0.2 }),
          P({ kind: 'range', id: 'attack', label: 'Attack', cc: null, min: 0, max: 32, unit: 'ms', decimals: 1, step: null }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, min: 0, max: 56, unit: 'ms', decimals: 1, step: null }),
          P({ kind: 'range', id: 'makeup', label: 'Makeup', cc: null, min: -24, max: 24, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 17, slug: 'parallel_comp', name: 'Parallel Comp', cc: null,
        params: [
          P({ kind: 'range', id: 'threshold', label: 'Threshold', cc: null, min: -60, max: 0, unit: 'dB', decimals: 1, step: null }),
          P({ kind: 'range', id: 'attack', label: 'Attack', cc: null, min: 0.01, max: 250, unit: 'ms', decimals: 2, step: null }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, min: 10, max: 2500, unit: 'ms', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 200, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'makeup', label: 'Makeup', cc: null, min: -24, max: 24, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 18, slug: 'classic_wah', name: 'Classic Wah', cc: null,
        params: [
          P({ kind: 'range', id: 'position', label: 'Position', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'low_freq', label: 'Low Freq', cc: null, min: 20, max: 500, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'high_freq', label: 'High Freq', cc: null, min: 500, max: 5000, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: null, min: -60, max: 6, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 19, slug: 'retro_wah', name: 'Retro Wah', cc: null,
        params: [
          P({ kind: 'range', id: 'position', label: 'Position', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'low_freq', label: 'Low Freq', cc: null, min: 20, max: 500, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'high_freq', label: 'High Freq', cc: null, min: 500, max: 5000, unit: 'Hz', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: null, min: -60, max: 6, unit: 'dB', decimals: 1, step: null }),
        ],
      }),
      T({
        id: 20, slug: 'bass_wah', name: 'Bass Wah', cc: null,
        params: [
          P({ kind: 'range', id: 'position', label: 'Position', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'q_trim', label: 'Q Trim', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'volume_trim', label: 'Volume Trim', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'level', label: 'Level', cc: null, min: -60, max: 6, unit: 'dB', decimals: 1, step: null }),
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
    common: [{ kind: 'range', id: 'level', label: 'Level', min: 0, max: 100, cc: 67, unit: '%', decimals: 0 }],
    types: [

    ],
  },
  mod: {
    common: [],
    types: [
      T({
        id: 0, slug: 'chorus', name: 'Chorus', description: 'Classic chorus effect; widens the soundstage for a fuller, thicker tone.', variant: 0,
        params: [
          P({ kind: 'range', id: 'rate', cc: 68, min: 0.1, max: 3.74, label: 'Rate', unit: 'Hz', decimals: 2, default: 1 }),
          P({ kind: 'range', id: 'depth', cc: 69, min: 0, max: 1, label: 'Depth', unit: 'ms', decimals: 2, default: 0.5 }),
        ],
      }),
      T({
        id: 1, slug: 'phaser', name: 'Phaser', description: 'Phaser effect; periodic sweep filtering for a swirling, moving tone.', variant: 1,
        params: [
          P({ kind: 'range', id: 'rate', cc: 68, min: 0.05, max: 5, label: 'Rate', unit: 'Hz', decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'feedback', cc: 69, min: -95, max: 95, label: 'Feedback', default: 30 }),
          P({ kind: 'range', id: 'mix', cc: 70, min: 0, max: 100, label: 'Mix', default: 50 }),
        ],
      }),
      T({
        id: 2, slug: 'flanger', name: 'Flanger', description: 'Flanger effect; comb-filtering creates an ethereal, metallic floating texture.', variant: 2,
        params: [
          P({ kind: 'range', id: 'rate', cc: 68, min: 0.05, max: 5, label: 'Rate', unit: 'Hz', decimals: 2, default: 0.3 }),
          P({ kind: 'range', id: 'feedback', cc: 69, min: -95, max: 95, label: 'Feedback', default: 50 }),
          P({ kind: 'range', id: 'mix', cc: 70, min: 0, max: 100, label: 'Mix', default: 50 }),
        ],
      }),
      T({
        id: 3, slug: 'tremolo', name: 'Tremolo', description: 'Volume tremolo; cyclically fluctuates volume based on waveform.', variant: 3,
        params: [
          P({ kind: 'range', id: 'rate', cc: 68, min: 0.01, max: 20, label: 'Rate', unit: 'Hz', decimals: 2, default: 4 }),
          P({ kind: 'range', id: 'depth', cc: 69, min: 0, max: 100, label: 'Depth', default: 60 }),
          P({ kind: 'enum', id: 'wave', cc: 70, options: ['Sine', 'Triangle', 'Square', 'Saw'], label: 'Wave', default: 0 }),
          P({ kind: 'range', id: 'smooth', cc: 71, min: 0, max: 40, label: 'Smooth', unit: 'Hz', decimals: 2, default: 5 }),
          P({ kind: 'range', id: 'mix', cc: 72, min: 0, max: 100, label: 'Mix', default: 100 }),
        ],
      }),
      T({
        id: 4, slug: 'vibrato', name: 'Vibrato', description: 'Pitch vibrato; subtly fluctuates pitch to enrich the tone.', variant: 4,
        params: [
          P({ kind: 'range', id: 'rate', cc: 68, min: 0.01, max: 20, label: 'Rate', unit: 'Hz', decimals: 2, default: 5 }),
          P({ kind: 'range', id: 'depth', cc: 69, min: 0, max: 20, label: 'Depth', unit: 'ms', decimals: 1, default: 3 }),
          P({ kind: 'enum', id: 'wave', cc: 70, options: ['Sine', 'Triangle', 'Square', 'Saw'], label: 'Wave', default: 0 }),
          P({ kind: 'range', id: 'mix', cc: 71, min: 0, max: 100, label: 'Mix', default: 50 }),
        ],
      }),
      T({
        id: 10, slug: 'velvet_vibrato', name: 'Velvet Vibrato', description: 'Richer, multi-voice take on Vibrato from a later firmware update.', variant: 10,
        params: [
          P({ kind: 'range', id: 'rate', cc: 68, min: 0.45, max: 10, label: 'Rate', unit: 'Hz', decimals: 2, default: 5 }),
          P({ kind: 'range', id: 'wave', cc: 69, min: 0, max: 100, label: 'Wave', default: 50 }),
          P({ kind: 'range', id: 'voice', cc: 70, min: 0, max: 100, label: 'Voice', default: 50 }),
          P({ kind: 'range', id: 'depth', cc: 71, min: 0, max: 100, label: 'Depth', default: 50 }),
          P({ kind: 'range', id: 'mix', cc: 72, min: 0, max: 100, label: 'Mix', default: 50 }),
        ],
      }),
      T({
        id: 11, slug: 'chorus_ii', name: 'Chorus II', description: 'Alternate chorus algorithm from a later firmware update.', variant: 11,
        params: [
          P({ kind: 'range', id: 'rate', cc: 68, min: 0, max: 1, label: 'Rate', decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'amount', cc: 69, min: 0, max: 1, label: 'Amount', decimals: 2, default: 0.5 }),
          P({ kind: 'range', id: 'feedback', cc: 70, min: 0, max: 1, label: 'Feedback', decimals: 2, default: 0 }),
          P({ kind: 'range', id: 'mix', cc: 71, min: 0, max: 1, label: 'Mix', decimals: 2, default: 0.5 }),
        ],
      }),
      T({
        id: 12, slug: 'phaser_ii', name: 'Phaser II', description: 'Alternate phaser algorithm from a later firmware update.', warning: 'Confirmed on real hardware: none of this type\'s parameters respond to MIDI — and not from the official Livtra app either, so this looks like a current firmware limitation rather than something specific to this editor. Selecting Phaser II itself works fine; its Depth/Rate/Feedback/Mix controls just have no effect yet. See MIDI_MAPPING_NOTES.md.', variant: 12,
        params: [
          P({ kind: 'range', id: 'depth', label: 'Depth', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'rate', label: 'Rate', cc: null, min: 0.05, max: 5, unit: 'Hz', decimals: 2, step: null }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: null, min: -95, max: 95, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
        ],
      }),
      T({
        id: 17, slug: 'jet_flanger', name: 'Jet Flanger', description: 'Alternate flanger algorithm from a later firmware update.', warning: 'Confirmed on real hardware: Feedback, Phase and Mix don\'t respond to MIDI — and not from the official Livtra app either, so this looks like a current firmware limitation rather than something specific to this editor. Only Rate and Depth (shown below) work; the other three are omitted here rather than shown as dead controls. See MIDI_MAPPING_NOTES.md.', variant: 17,
        params: [
          P({ kind: 'range', id: 'rate', label: 'Rate', cc: 68, min: 0.05, max: 5, unit: 'Hz', decimals: 2, step: null }),
          P({ kind: 'range', id: 'depth', label: 'Depth', cc: 69, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: null, min: -95, max: 95, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'phase', label: 'Phase', cc: null, min: 0, max: 360, unit: '°', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
        ],
      }),
    ],
  },
  del: {
    common: [],
    types: [
      T({
        id: 0, slug: 'bbd', name: 'BBD', description: 'Classic BBD analog delay; vintage warm tape delay texture.', variant: 0,
        params: [
          P({ kind: 'range', id: 'delay', cc: 74, min: 1, max: 2000, label: 'Delay', unit: 'ms', format: 'time', default: 350 }),
          P({ kind: 'range', id: 'feedback', cc: 75, min: 0, max: 95, label: 'Feedback', default: 30 }),
          P({ kind: 'range', id: 'age', cc: 76, min: 0, max: 100, label: 'Age', default: 20 }),
          P({ kind: 'range', id: 'mix', cc: 77, min: 0, max: 100, label: 'Mix', default: 40 }),
          P({ kind: 'range', id: 'level', cc: 78, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 1, slug: 'digital', name: 'Digital', description: 'Clean digital delay; clear and transparent tone, suitable for various genres.', variant: 1,
        params: [
          P({ kind: 'range', id: 'time', cc: 74, min: 0.1, max: 2000, label: 'Time', unit: 'ms', format: 'time', default: 350 }),
          P({ kind: 'range', id: 'feedback', cc: 75, min: 0, max: 95, label: 'Feedback', default: 30 }),
          P({ kind: 'range', id: 'mix', cc: 76, min: 0, max: 100, label: 'Mix', default: 40 }),
          P({ kind: 'range', id: 'level', cc: 77, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 2, slug: 'duck', name: 'Duck', description: 'Duck delay; automatically lowers delay tail during playing to avoid muddiness.', variant: 2,
        params: [
          P({ kind: 'range', id: 'time', label: 'Time', cc: null, min: 0.1, max: 2000, unit: 'ms', decimals: 1, step: null }),
          P({ kind: 'range', id: 'feedback', label: 'Feedback', cc: null, min: 0, max: 95, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'sensitivity', label: 'Sensitivity', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'depth', label: 'Depth', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'attack', label: 'Attack', cc: null, min: 0.1, max: 100, unit: 'ms', decimals: 1, step: null }),
          P({ kind: 'range', id: 'release', label: 'Release', cc: null, min: 10, max: 2000, unit: 'ms', decimals: 0, step: null }),
          P({ kind: 'range', id: 'filter', label: 'Filter', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
          P({ kind: 'range', id: 'mix', label: 'Mix', cc: null, min: 0, max: 100, unit: '', decimals: 0, step: null }),
        ],
      }),
      T({
        id: 3, slug: 'ice', name: 'Ice', description: 'Ice pitch-shift delay; delayed signal with pitch offset for ethereal atmosphere.', variant: 3,
        params: [
          P({ kind: 'range', id: 'time', cc: 74, min: 0.1, max: 2000, label: 'Time', unit: 'ms', format: 'time', default: 350 }),
          P({ kind: 'range', id: 'feedback', cc: 75, min: 0, max: 95, label: 'Feedback', default: 30 }),
          P({ kind: 'range', id: 'interval', cc: 76, min: -12, max: 12, label: 'Interval', unit: 'st', default: 12 }),
          P({ kind: 'range', id: 'mix', cc: 77, min: 0, max: 100, label: 'Mix', default: 40 }),
          P({ kind: 'range', id: 'level', cc: 78, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 4, slug: 'reverse', name: 'Reverse', description: 'Reverse delay; plays back delay signal in reverse for a dreamy spatial effect.', variant: 4,
        params: [
          P({ kind: 'range', id: 'time', cc: 74, min: 0.1, max: 2000, label: 'Time', unit: 'ms', format: 'time', default: 350 }),
          P({ kind: 'range', id: 'feedback', cc: 75, min: 0, max: 95, label: 'Feedback', default: 30 }),
          P({ kind: 'range', id: 'mix', cc: 76, min: 0, max: 100, label: 'Mix', default: 40 }),
          P({ kind: 'range', id: 'level', cc: 77, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 5, slug: 'lofi', name: 'LoFi', description: 'Lo-fi delay; bit-rate distortion creates vintage degraded tape texture.', variant: 5,
        params: [
          P({ kind: 'range', id: 'time', cc: 74, min: 2, max: 2000, label: 'Time', unit: 'ms', format: 'time', default: 350 }),
          P({ kind: 'range', id: 'feedback', cc: 75, min: 0, max: 95, label: 'Feedback', default: 30 }),
          P({ kind: 'range', id: 'bit_depth', cc: 76, min: 4, max: 16, label: 'Bit Depth', unit: 'bit', default: 12 }),
          P({ kind: 'range', id: 'lofi_mix', cc: 77, min: 0, max: 100, label: 'LoFi Mix', default: 40 }),
          P({ kind: 'range', id: 'mix', cc: 78, min: 0, max: 100, label: 'Mix', default: 40 }),
          P({ kind: 'range', id: 'level', cc: 79, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 6, slug: 'smear', name: 'Smear', description: 'Smear delay; softens and blurs delay signal for a gentle spatial diffusion.', variant: 6,
        params: [
          P({ kind: 'range', id: 'time', cc: 74, min: 0.1, max: 2000, label: 'Time', unit: 'ms', format: 'time', default: 350 }),
          P({ kind: 'range', id: 'feedback', cc: 75, min: 0, max: 95, label: 'Feedback', default: 30 }),
          P({ kind: 'range', id: 'smear', cc: 76, min: 0, max: 100, label: 'Smear', default: 40 }),
          P({ kind: 'range', id: 'filter', cc: 77, min: 0, max: 100, label: 'Filter', default: 50 }),
          P({ kind: 'range', id: 'mix', cc: 78, min: 0, max: 100, label: 'Mix', default: 40 }),
          P({ kind: 'range', id: 'level', cc: 79, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 7, slug: 'mod_delay', name: 'Mod Delay', description: 'Modulated delay; delay with tremolo wobble for richer tonal layers.', variant: 7,
        params: [
          P({ kind: 'range', id: 'time', cc: 74, min: 0.1, max: 2000, label: 'Time', unit: 'ms', format: 'time', default: 350 }),
          P({ kind: 'range', id: 'feedback', cc: 75, min: 0, max: 95, label: 'Feedback', default: 30 }),
          P({ kind: 'range', id: 'mod_depth', cc: 76, min: 0, max: 20, label: 'Mod Depth', unit: 'ms', default: 5 }),
          P({ kind: 'range', id: 'mod_rate', cc: 77, min: 0.05, max: 5, label: 'Mod Rate', unit: 'Hz', decimals: 2, default: 1 }),
          P({ kind: 'range', id: 'mix', cc: 78, min: 0, max: 100, label: 'Mix', default: 40 }),
          P({ kind: 'range', id: 'level', cc: 79, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
    ],
  },
  rev: {
    common: [],
    types: [
      T({
        id: 0, slug: 'room', name: 'Room', description: 'Room reverb; simulates a small indoor space with a compact, natural sound.', variant: 0,
        params: [
          P({ kind: 'range', id: 'decay', cc: 85, min: 0.5, max: 12, label: 'Decay', unit: 's', decimals: 1, default: 2 }),
          P({ kind: 'range', id: 'pre_delay', cc: 86, min: 0, max: 80, label: 'Pre Delay', unit: 'ms', default: 10 }),
          P({ kind: 'range', id: 'tone', cc: 87, min: 0, max: 100, label: 'Tone', default: 50 }),
          P({ kind: 'range', id: 'mod', cc: 88, min: 0, max: 100, label: 'Mod', default: 20 }),
          P({ kind: 'range', id: 'mix', cc: 89, min: 0, max: 100, label: 'Mix', default: 30 }),
          P({ kind: 'range', id: 'level', cc: 90, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 1, slug: 'plate', name: 'Plate', description: 'Plate reverb; classic metal plate vintage tone, warm and smooth.', variant: 1,
        params: [
          P({ kind: 'range', id: 'decay', cc: 85, min: 0.5, max: 12, label: 'Decay', unit: 's', decimals: 1, default: 2.5 }),
          P({ kind: 'range', id: 'pre_delay', cc: 86, min: 0, max: 80, label: 'Pre Delay', unit: 'ms', default: 10 }),
          P({ kind: 'range', id: 'tone', cc: 87, min: 0, max: 100, label: 'Tone', default: 50 }),
          P({ kind: 'range', id: 'mod', cc: 88, min: 0, max: 100, label: 'Mod', default: 20 }),
          P({ kind: 'range', id: 'mix', cc: 89, min: 0, max: 100, label: 'Mix', default: 30 }),
          P({ kind: 'range', id: 'level', cc: 90, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 2, slug: 'hall', name: 'Hall', description: 'Hall reverb; simulates a large concert hall with a wide, grand spatial feel.', variant: 2,
        params: [
          P({ kind: 'range', id: 'decay', cc: 85, min: 0.5, max: 12, label: 'Decay', unit: 's', decimals: 1, default: 4 }),
          P({ kind: 'range', id: 'pre_delay', cc: 86, min: 0, max: 80, label: 'Pre Delay', unit: 'ms', default: 20 }),
          P({ kind: 'range', id: 'tone', cc: 87, min: 0, max: 100, label: 'Tone', default: 50 }),
          P({ kind: 'range', id: 'lf_damp', cc: 88, min: 0, max: 100, label: 'LF Damp', default: 30 }),
          P({ kind: 'range', id: 'mix', cc: 89, min: 0, max: 100, label: 'Mix', default: 30 }),
          P({ kind: 'range', id: 'level', cc: 90, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 3, slug: 'concert', name: 'Concert', description: 'Concert hall reverb; transparent and structured, ideal for solo performances.', variant: 3,
        params: [
          P({ kind: 'range', id: 'decay', cc: 85, min: 0.5, max: 12, label: 'Decay', unit: 's', decimals: 1, default: 3 }),
          P({ kind: 'range', id: 'pre_delay', cc: 86, min: 0, max: 80, label: 'Pre Delay', unit: 'ms', default: 20 }),
          P({ kind: 'range', id: 'hf_damp', cc: 87, min: 0, max: 100, label: 'HF Damp', default: 30 }),
          P({ kind: 'range', id: 'mod', cc: 88, min: 0, max: 100, label: 'Mod', default: 20 }),
          P({ kind: 'range', id: 'mix', cc: 89, min: 0, max: 100, label: 'Mix', default: 30 }),
          P({ kind: 'range', id: 'level', cc: 90, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 4, slug: 'shimmer', name: 'Shimmer', description: 'Shimmer reverb; pitch-shifted overtones create an ethereal, dreamy atmosphere.', variant: 5,
        params: [
          P({ kind: 'range', id: 'decay', cc: 85, min: 0, max: 12, label: 'Decay', unit: 's', decimals: 1, default: 5 }),
          P({ kind: 'range', id: 'pre_delay', cc: 86, min: 5, max: 120, label: 'Pre Delay', unit: 'ms', default: 20 }),
          P({ kind: 'range', id: 'tone', cc: 87, min: 0, max: 100, label: 'Tone', default: 50 }),
          P({ kind: 'range', id: 'pitch', cc: 88, min: -24, max: 24, label: 'Pitch', unit: 'st', default: 12 }),
          P({ kind: 'range', id: 'mix', cc: 89, min: 0, max: 100, label: 'Mix', default: 30 }),
          P({ kind: 'range', id: 'level', cc: 90, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 5, slug: 'cloud', name: 'Cloud', description: 'Cloud ambient reverb; ultra-long decay with soft modulation for a floating environmental feel.', variant: 6,
        params: [
          P({ kind: 'range', id: 'decay', cc: 85, min: 1, max: 100, label: 'Decay', unit: 's', decimals: 0, default: 20 }),
          P({ kind: 'range', id: 'tone', cc: 86, min: 0, max: 100, label: 'Tone', default: 50 }),
          P({ kind: 'range', id: 'mod_depth', cc: 87, min: 0, max: 100, label: 'Mod Depth', default: 20 }),
          P({ kind: 'range', id: 'mod_rate', cc: 88, min: 0.02, max: 0.25, label: 'Mod Rate', unit: 'Hz', decimals: 2, default: 0.1 }),
          P({ kind: 'range', id: 'mix', cc: 89, min: 0, max: 100, label: 'Mix', default: 30 }),
          P({ kind: 'range', id: 'level', cc: 90, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
      T({
        id: 6, slug: 'spring', name: 'Spring', description: 'Spring reverb; emulates vintage amp spring reverb with retro-rock texture.', variant: 7,
        params: [
          P({ kind: 'range', id: 'decay', cc: 85, min: 0, max: 12, label: 'Decay', unit: 's', decimals: 1, default: 2 }),
          P({ kind: 'range', id: 'pre_delay', cc: 86, min: 5, max: 80, label: 'Pre Delay', unit: 'ms', default: 10 }),
          P({ kind: 'range', id: 'crossover', cc: 87, min: 800, max: 8000, label: 'Crossover', unit: 'Hz', format: 'freq', default: 2000 }),
          P({ kind: 'range', id: 'mod', cc: 88, min: 0, max: 100, label: 'Mod', default: 20 }),
          P({ kind: 'range', id: 'mix', cc: 89, min: 0, max: 100, label: 'Mix', default: 30 }),
          P({ kind: 'range', id: 'level', cc: 90, min: 0, max: 100, label: 'Level', default: 70 }),
        ],
      }),
    ],
  },
  eq: {
    common: [],
    types: [
      T({
        id: 0, slug: 'eq3', name: '3-band EQ', description: 'Quickly adjust low, mid, and high frequencies.', variant: 0,
        params: [
          P({ kind: 'range', id: 'low', cc: 91, min: -15, max: 15, label: 'Low', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'mid', cc: 92, min: -15, max: 15, label: 'Mid', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'high', cc: 93, min: -15, max: 15, label: 'High', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'level', label: 'Level', min: -12, max: 12, cc: null, unit: 'dB', decimals: 0 }),
        ],
      }),
      T({
        id: 1, slug: 'eq6', name: '6-band EQ', description: 'Parametric multi-band fine-tuning of tone.', variant: 1,
        params: [
          P({ kind: 'range', id: 'b120', cc: 91, min: -15, max: 15, label: '120 Hz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b250', cc: 92, min: -15, max: 15, label: '250 Hz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b500', cc: 93, min: -15, max: 15, label: '500 Hz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b1k', cc: 94, min: -15, max: 15, label: '1 kHz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b2k', cc: 95, min: -15, max: 15, label: '2 kHz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b4k', cc: 96, min: -15, max: 15, label: '4 kHz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'level', label: 'Level', min: -12, max: 12, cc: null, unit: 'dB', decimals: 0 }),
        ],
      }),
      T({
        id: 2, slug: 'eq8', name: '8-band EQ', description: 'Full-range EQ; precise tonal shaping across the entire frequency spectrum.', variant: 2,
        params: [
          P({ kind: 'range', id: 'b60', cc: 91, min: -15, max: 15, label: '60 Hz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b120', cc: 92, min: -15, max: 15, label: '120 Hz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b250', cc: 93, min: -15, max: 15, label: '250 Hz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b500', cc: 94, min: -15, max: 15, label: '500 Hz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b1k', cc: 95, min: -15, max: 15, label: '1 kHz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b2k', cc: 96, min: -15, max: 15, label: '2 kHz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b4k', cc: 97, min: -15, max: 15, label: '4 kHz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'b8k', cc: 33, min: -15, max: 15, label: '8 kHz', unit: 'dB', default: 0 }),
          P({ kind: 'range', id: 'level', label: 'Level', min: -12, max: 12, cc: null, unit: 'dB', decimals: 0 }),
        ],
      }),
    ],
  },
};
