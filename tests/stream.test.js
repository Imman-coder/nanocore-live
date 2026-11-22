import test from 'node:test';
import assert from 'node:assert/strict';
import * as messages from '../src/core/messages.js';
import { ResponseAssembler, parseSysEx, COMMAND } from '../src/core/messages.js';
import { buildSnapshotReply } from '../src/core/snapshot.js';

function streamed(payload, offset, total, status, sequence) {
  const body = [0x02, sequence & 0xff, sequence >> 8, 0x63, 0x00, status,
    (payload.length + 4) & 0xff, ((payload.length + 4) >> 8) & 0xff,
    total & 0xff, total >> 8, offset & 0xff, offset >> 8, ...payload];
  return [0xf0, ...messages.MANUFACTURER, messages.DIR_DEVICE_TO_HOST, ...messages.pack7bit(body), 0xf7];
}

test('a final-only streamed response is accepted and returned', () => {
  const data = [1, 2, 3];
  const frame = streamed(data, 0, data.length, 0x11, 5);
  const parsed = parseSysEx(frame);
  assert.equal(parsed.status, 0x11);
  const assembled = new ResponseAssembler().feed(parsed);
  assert.equal(assembled.status, 0);
  assert.deepEqual(assembled.payload, data);
});

test('an intermediate chunk does not resolve, the final chunk returns the whole payload', () => {
  const assembler = new ResponseAssembler();
  assert.equal(assembler.feed(parseSysEx(streamed([1, 2, 3], 0, 6, 0x10, 6))), null);
  const done = assembler.feed(parseSysEx(streamed([4, 5, 6], 3, 6, 0x11, 6)));
  assert.deepEqual(done.payload, [1, 2, 3, 4, 5, 6]);
  assert.equal(done.status, 0);
});

test('a final chunk with a gap is rejected', () => {
  const assembler = new ResponseAssembler();
  assembler.feed(parseSysEx(streamed([1, 2], 0, 6, 0x10, 7)));
  assert.throws(() => assembler.feed(parseSysEx(streamed([5, 6], 4, 6, 0x11, 7))));
});

test('contradictory overlapping chunks are rejected', () => {
  const assembler = new ResponseAssembler();
  assembler.feed(parseSysEx(streamed([1, 2, 3], 0, 4, 0x10, 8)));
  assert.throws(() => assembler.feed(parseSysEx(streamed([9, 9], 1, 4, 0x11, 8))));
});

test('a plain status-0 reply passes through unchanged', () => {
  const parsed = parseSysEx(buildSnapshotReply([3, 1, 2], 9));
  assert.equal(new ResponseAssembler().feed(parsed), parsed);
});
