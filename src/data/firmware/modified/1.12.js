// Modified firmware 1.12 — UniVibe is mandatory; Octave is optional.
// VERSION = 1.12 + UniVibe. VERSION_OCTAVE = 1.12 + UniVibe + Octave.
import { VERSION as ORIGINAL } from '../original/1.12.js';
import { applyPatches, patchesFor } from '../patches.js';

export const VERSION = applyPatches(ORIGINAL, patchesFor('1.12'));
export const VERSION_OCTAVE = applyPatches(ORIGINAL, patchesFor('1.12', { octave: true }));
