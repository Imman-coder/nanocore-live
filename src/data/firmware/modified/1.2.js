// Modified firmware 1.2 — UniVibe is mandatory; Octave is optional.
// VERSION = 1.2 + UniVibe. VERSION_OCTAVE = 1.2 + UniVibe + Octave.
import { VERSION as ORIGINAL } from '../original/1.2.js';
import { applyPatches, patchesFor } from '../patches.js';

export const VERSION = applyPatches(ORIGINAL, patchesFor('1.2'));
export const VERSION_OCTAVE = applyPatches(ORIGINAL, patchesFor('1.2', { octave: true }));
