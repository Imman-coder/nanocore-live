// Modified firmware 1.10 — UniVibe patch only (Octave is not supported on this base).
// Patches are defined once in ../patches.js; this file only selects them.
import { VERSION as ORIGINAL } from '../original/1.10.js';
import { applyPatches, patchesFor } from '../patches.js';

export const VERSION = applyPatches(ORIGINAL, patchesFor('1.10'));
