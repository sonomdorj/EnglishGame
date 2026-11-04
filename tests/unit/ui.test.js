import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Picker, renderBook, WEEKDAYS } from '../../ui.js';
import { installDom, FakeElement } from './fake-dom.js';
import { readJSON } from './data.js';

installDom();
let root, p;
beforeEach(() => { root = new FakeElement(); root.hidden = true; p = new Picker(root); });

test('WEEKDAYS is re-exported', () => {
  assert.equal(WEEKDAYS.length, 7);
});

test('open: title, one button per option, footer', () => {
  p.open({ title: 'What day?', options: ['A', 'B', 'C'] });
  assert.equal(p.isOpen, true);
  assert.equal(p.titleEl.textContent, 'What day?');
  assert.equal(p.bodyEl.innerHTML, '');
  assert.deepEqual(p.optEl.children.map(b => b.textContent), ['A', 'B', 'C']);
  assert.deepEqual(p.optEl.children.map(b => b.dataset.index), [0, 1, 2]);
  assert.equal(root.querySelector('.p-foot').hidden, false);
  p.open({ title: 'X', options: ['Z'], closable: false });
  assert.equal(p.optEl.children.length, 1, 'old buttons removed');
  assert.equal(root.querySelector('.p-foot').hidden, true);
  p.open({ title: 'No options' });
  assert.deepEqual(p.buttons, []);
});

test('clicking a button or pick(i) calls onPick(i, button)', () => {
  const got = [];
  p.open({ title: 't', options: ['A', 'B'], onPick: (i, b) => got.push([i, b.textContent]) });
  p.optEl.children[1].click();
  p.pick(0);
  p.pick(5);  // no such button
  p.pick(-1);
  assert.deepEqual(got, [[1, 'B'], [0, 'A']]);
});

test('pick without onPick or before open does nothing', () => {
  assert.doesNotThrow(() => p.pick(0));
  p.open({ title: 't', options: ['A'] });
  assert.doesNotThrow(() => p.pick(0));
});

test('close: hides, runs onClose once', () => {
  let n = 0;
  p.open({ title: 't', options: ['A'], onClose: () => n++ });
  p.close();
  assert.equal(p.isOpen, false);
  assert.equal(p.cfg, null);
  p.close();
  assert.equal(n, 1);
});

test('close: a closable:false panel needs force', () => {
  let n = 0;
  p.open({ title: 't', options: ['A'], closable: false, onClose: () => n++ });
  p.close();
  assert.equal(p.isOpen, true);
  p.close(true);
  assert.equal(p.isOpen, false);
  assert.equal(n, 1);
});

const villagers = readJSON('villagers.json').filter(v => v.house);
const empty = () => ({ met: [], items: [], lettersRead: [], found: [] });

test('renderBook: nobody met yet', () => {
  const el = new FakeElement();
  renderBook(el, villagers, empty());
  assert.match(el.innerHTML, /<h2>Family Book<\/h2>/);
  assert.match(el.innerHTML, /You have not met anyone yet/);
  assert.match(el.innerHTML, /Not met yet: 6 people\./);
  assert.match(el.innerHTML, /Letters read: 0 of 6\./);
  assert.match(el.innerHTML, /Lost things found: 0 of 12\.</);
  assert.doesNotMatch(el.innerHTML, /Things you took/);
  assert.doesNotMatch(el.innerHTML, /class="person"/);
});

test('renderBook: met people with family, nickname, items, letters, found', () => {
  const el = new FakeElement();
  const bat = villagers.find(v => v.id === 'batbayar');
  const s = { met: villagers.map(v => v.id).filter(id => id !== 'ganbold'), items: ['bread', 'fish'], lettersRead: ['h1', 'h2'],
    found: ['key', 'cup'], nicknames: { batbayar: 'Iron Nose' } };
  renderBook(el, villagers, s, 12);
  const html = el.innerHTML;
  assert.equal((html.match(/class="person"/g) || []).length, 5);
  assert.ok(html.includes(`${bat.name} ("Iron Nose")`));
  assert.ok(html.includes(`Job: ${bat.job}`));
  assert.ok(html.includes(`Father: ${bat.father}`));
  assert.ok(html.includes(`Mother: ${bat.mother}`));
  assert.ok(html.includes('Children: Oyunaa'), 'child id shown as name');
  assert.match(html, /Born: (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d+ [A-Z][a-z]+ \d{4}/);
  assert.match(html, /Not met yet: 1 person\./);
  assert.match(html, /Things you took: bread, fish\./);
  assert.match(html, /Letters read: 2 of 6\./);
  assert.match(html, /Lost things found: 2 of 12 \(key, cup\)/);
});

test('renderBook: everyone met, no "Not met" line; unknown child id shown as id', () => {
  const el = new FakeElement();
  const vs = villagers.map(v => (v.id === 'oyunaa' ? { ...v, children: ['nobody'] } : v));
  renderBook(el, vs, { ...empty(), met: vs.map(v => v.id) });
  assert.doesNotMatch(el.innerHTML, /Not met yet/);
  assert.ok(el.innerHTML.includes('Children: nobody'));
  assert.ok(el.innerHTML.includes('Children: none'));
});

test('renderBook: old save without found list', () => {
  const el = new FakeElement();
  const s = empty();
  delete s.found;
  renderBook(el, villagers, s);
  assert.match(el.innerHTML, /Lost things found: 0 of 12\.</);
});
