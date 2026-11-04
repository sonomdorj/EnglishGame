import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../config.js';

test('every setting is a positive number', () => {
  for (const [k, v] of Object.entries(CONFIG)) {
    assert.equal(typeof v, 'number', k);
    assert.ok(Number.isFinite(v) && v > 0, k);
  }
});

test('settings make sense together', () => {
  assert.ok(CONFIG.runSpeed > CONFIG.walkSpeed);
  assert.ok(CONFIG.dayLengthSec > CONFIG.nightLengthSec);
  assert.ok(CONFIG.talkDistance > CONFIG.buuFollowDistance);
  assert.ok(CONFIG.ttsRate <= 1);
  assert.equal(CONFIG.textDelaySec, 1.5);
});
