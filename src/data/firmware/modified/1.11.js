// Modified firmware 1.11 — UniVibe patch only (Octave is not supported on this base).
import { VERSION as ORIGINAL } from '../original/1.11.js';
import { applyPatches, patchesFor } from '../patches.js';

export const VERSION = applyPatches(ORIGINAL, patchesFor('1.11'));
