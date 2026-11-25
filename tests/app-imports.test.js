import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Scene recall writes FX on/off over CC. This import was missing once and the
// recall silently aborted on the first state difference.
test('the Svelte engine imports every core message helper it calls', () => {
  const source = readFileSync(new URL('../src/lib/engine.js', import.meta.url), 'utf8');
  for (const name of ['buildCc', 'buildRequestSysEx', 'parseSysEx', 'ResponseAssembler']) {
    assert.match(source, new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from ['"]\\.\\./core/messages\\.js['"]`));
  }
});
