import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, writeSave, clearSave } from '../../save.js';
import { fakeStorage } from './fake-dom.js';

const KEY = 'nameKeeper.save.v1';
beforeEach(() => { globalThis.localStorage = fakeStorage(); });

test('loadSave: no save = empty object', () => {
  assert.deepEqual(loadSave(), {});
});

test('writeSave then loadSave returns the same data', () => {
  writeSave({ questsDone: 3, met: ['oyunaa'] });
  assert.equal(localStorage.getItem(KEY), '{"questsDone":3,"met":["oyunaa"]}');
  assert.deepEqual(loadSave(), { questsDone: 3, met: ['oyunaa'] });
});

test('loadSave: broken or wrong data = empty object', () => {
  for (const raw of ['{not json', '42', '"text"', 'null', 'true']) {
    localStorage.setItem(KEY, raw);
    assert.deepEqual(loadSave(), {}, raw);
  }
});

test('clearSave removes the save', () => {
  writeSave({ a: 1 });
  clearSave();
  assert.equal(localStorage.getItem(KEY), null);
  assert.deepEqual(loadSave(), {});
});

test('blocked storage never throws', () => {
  globalThis.localStorage = fakeStorage({ fail: true });
  assert.deepEqual(loadSave(), {});
  assert.doesNotThrow(() => writeSave({ a: 1 }));
  assert.doesNotThrow(() => clearSave());
});

test('missing localStorage never throws', () => {
  delete globalThis.localStorage;
  assert.deepEqual(loadSave(), {});
  assert.doesNotThrow(() => writeSave({ a: 1 }));
  assert.doesNotThrow(() => clearSave());
});
