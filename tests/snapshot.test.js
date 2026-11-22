import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, buildSnapshotReply } from '../src/core/snapshot.js';
import { BLOCKS, SNAPSHOT_BLOCKS, blockByCc, paramCcFor, chainBlockIds } from '../src/core/spec.js';

function harnessBytes() {
  const bytes = [0x03, 8, 83];
  const blocks = [
    [1, 2, 2, [0.5, 0.25]],
    [0, 8, 1, [0.75]],
    [1, 12, 3, [0.1, 0.2, 0.3]],
    [1, 2, 1, [0.9]],
    [0, 0, 2, [0.4, 0.6]],
    [1, 3, 2, [0.7, 0.8]],
    [1, 5, 1, [0.2]],
    [0, 0, 3, [0.3, 0.4, 0.5]],
  ];
  for (const [enabled, variant, count, params] of blocks) {
    bytes.push(enabled, variant, count);
    const view = new DataView(new ArrayBuffer(4));
    for (const p of params) {
      view.setFloat32(0, p, true);
      bytes.push(...new Uint8Array(view.buffer));
    }
  }
  bytes.push(0x08, 0, 1, 2, 3, 4, 5, 6, 7);
  return bytes;
}

test('snapshot order is fx1, fx2, amp, cab, del, mod, rev, eq', () => {
  const snapshot = parseSnapshot(harnessBytes());
  assert.deepEqual(snapshot.blocks.map((b) => b.id), SNAPSHOT_BLOCKS);
  assert.equal(snapshot.activePreset, 8);
  assert.equal(snapshot.volume, 83);
  assert.deepEqual(snapshot.chainOrder, [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('snapshot decodes enabled, variant and float parameters for each block', () => {
  const snapshot = parseSnapshot(harnessBytes());
  assert.equal(snapshot.blocks[0].enabled, true);
  assert.equal(snapshot.blocks[0].variant, 2);
  assert.deepEqual(snapshot.blocks[0].params, [0.5, 0.25]);
  assert.equal(snapshot.blocks[1].enabled, false);
  assert.equal(snapshot.blocks[1].variant, 8);
  assert.deepEqual(snapshot.blocks[1].params, [0.75]);
});

test('a truncated snapshot is rejected rather than mis-decoded', () => {
  assert.throws(() => parseSnapshot(harnessBytes().slice(0, 20)));
  assert.throws(() => parseSnapshot([0x04, 1, 2]));
});

test('a snapshot can be wrapped in a device reply and read back', () => {
  const reply = buildSnapshotReply(harnessBytes(), 0x2a);
  const parsed = parseSnapshot(reply);
  assert.equal(parsed.activePreset, 8);
  assert.equal(parsed.sequence, 0x2a);
});


test('chain order maps snapshot indices to block ids in signal-path order', () => {
  assert.deepEqual(chainBlockIds([0, 1, 2, 3, 4, 5, 6, 7]),
    ['fx1', 'fx2', 'amp', 'cab', 'del', 'mod', 'rev', 'eq']);
  assert.deepEqual(chainBlockIds([0, 1, 2, 3, 5, 4, 6, 7]),
    ['fx1', 'fx2', 'amp', 'cab', 'mod', 'del', 'rev', 'eq']);
  assert.deepEqual(chainBlockIds([7, 6, 5, 4, 3, 2, 1, 0]),
    ['eq', 'rev', 'mod', 'del', 'cab', 'amp', 'fx2', 'fx1']);
});

test('on/off and type CCs match the documented block table', () => {
  assert.equal(blockByCc(20).id, 'fx1');
  assert.equal(blockByCc(21).id, 'fx2');
  assert.equal(blockByCc(23).id, 'amp');
  assert.equal(blockByCc(24).id, 'cab');
  assert.equal(blockByCc(25).id, 'mod');
  assert.equal(blockByCc(26).id, 'del');
  assert.equal(blockByCc(27).id, 'rev');
  assert.equal(blockByCc(28).id, 'eq');
  assert.equal(blockByCc(22), undefined);
  assert.equal(BLOCKS.find((b) => b.id === 'fx1').typeCc, 40);
  assert.equal(BLOCKS.find((b) => b.id === 'rev').typeCc, 47);
});

test('parameter CCs use the measured bases, including the FX2 split', () => {
  assert.equal(paramCcFor('fx1', 0), 50);
  assert.equal(paramCcFor('fx1', 6), 56);
  assert.equal(paramCcFor('amp', 4), 64);
  assert.equal(paramCcFor('cab', 2), 67);
  assert.equal(paramCcFor('del', 3), 77);
  assert.equal(paramCcFor('rev', 5), 90);
  assert.equal(paramCcFor('eq', 0), 91);
  assert.equal(paramCcFor('fx2', 0, 0), 57);
  assert.equal(paramCcFor('fx2', 0, 8), 68);
  assert.equal(paramCcFor('fx2', 5, 8), 73);
  assert.equal(paramCcFor('mod', 5), 73);
});

test('the reverb variant ids follow the hardware-confirmed table', () => {
  const rev = BLOCKS.find((b) => b.id === 'rev');
  assert.deepEqual(rev.types.map((t) => t.id), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(rev.types.map((t) => t.variant), [0, 1, 2, 3, 5, 6, 7]);
  assert.equal(rev.types[4].name, 'Shimmer');
});
