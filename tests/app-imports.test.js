import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Scene recall writes FX on/off over CC. This import was missing once and the
// recall silently aborted on the first state difference. The gateway split
// moved request/reply helpers into device.js; check both files.
test('the engine gateway imports every core message helper it calls', () => {
  const sources = ['../src/lib/engine.js', '../src/lib/gateway/device.js']
    .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  for (const name of ['buildCc', 'buildRequestSysEx', 'parseSysEx', 'ResponseAssembler']) {
    assert.match(sources, new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from ['"]\\.\\./(?:\\.\\./)?core/messages\\.js['"]`));
  }
});
