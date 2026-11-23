import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCc } from '../src/core/messages.js';
import { buildParameterWrite } from '../src/core/parameterWrite.js';
import { range, enumP } from '../src/data/paramHelpers.js';

test('a parameter with a documented CC writes a scaled CC', () => {
  assert.deepEqual(
    buildParameterWrite({ param: range('Rate', 68, 0.1, 3.74), normalized: 0.5, channel: 1 }),
    buildCc(1, 68, 64),
  );
});

test('an enum parameter writes the centre of its bucket', () => {
  assert.deepEqual(
    buildParameterWrite({ param: enumP('Wave', 70, ['Sine', 'Triangle', 'Square', 'Saw']), normalized: 1, channel: 2 }),
    buildCc(2, 70, 112),
  );
});

test('a SysEx-only parameter has no CC write', () => {
  assert.equal(buildParameterWrite({ param: range('Depth', null, 0, 100), normalized: 0.5, channel: 1 }), null);
});
