import assert from 'node:assert/strict';
import { test } from 'node:test';

import { byteRange } from './range.js';

test('byteRange', () => {
  assert.equal(byteRange(undefined, 100), null);
  assert.equal(byteRange('bytes=-', 100), null);
  assert.equal(byteRange('items=0-1', 100), null);
  assert.deepEqual(byteRange('bytes=0-', 100), { start: 0, end: 99 });
  assert.deepEqual(byteRange('bytes=10-19', 100), { start: 10, end: 19 });
  assert.deepEqual(byteRange('bytes=90-500', 100), { start: 90, end: 99 });
  assert.deepEqual(byteRange('bytes=-30', 100), { start: 70, end: 99 });
  assert.equal(byteRange('bytes=100-', 100), false);
  assert.equal(byteRange('bytes=20-10', 100), false);
});
