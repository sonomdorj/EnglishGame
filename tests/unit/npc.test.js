import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './fake-dom.js';

installDom();
const THREE = await import('three');
const { Human, Panda, makeLabel } = await import('../../npc.js');

test('makeLabel: sprite sized from the text width', () => {
  const s = makeLabel('Buu');
  assert.ok(s instanceof THREE.Sprite);
  assert.ok(s.material.map instanceof THREE.CanvasTexture);
  const long = makeLabel('Batsaikhan Erdene');
  assert.ok(long.scale.x > s.scale.x);
  assert.equal(long.scale.y, s.scale.y);
});

test('Human: parts, label, hit box data', () => {
  const h = new Human({ id: 'oyunaa', name: 'Oyunaa', scale: 0.76 });
  assert.equal(h.id, 'oyunaa');
  for (const k of ['group', 'root', 'hips', 'legL', 'legR', 'torso', 'chest', 'armL', 'armR', 'head', 'mouth', 'label', 'hit']) assert.ok(h[k], k);
  assert.equal(h.root.scale.x, 0.76);
  assert.deepEqual(h.hit.userData, { kind: 'villager', id: 'oyunaa' });
  assert.equal(h.hit.material.visible, false);
  assert.ok(h.hit.geometry.parameters.height >= 1.9, 'children still have a full-height hit box');
  const hm = new Human({ id: 'headmaster', name: 'H', kind: 'headmaster' });
  assert.equal(hm.hit.userData.kind, 'headmaster');
});

test('Human: every hair style and extra builds', () => {
  const extras = ['apron', 'glasses', 'cap', 'beard', 'mustache', 'tie', 'skirt', 'longSleeves'];
  const counts = {};
  for (const hairStyle of ['short', 'long', 'bun', 'bald']) {
    const h = new Human({ id: 'x', name: 'X', hairStyle, extras });
    let n = 0;
    h.group.traverse(() => n++);
    counts[hairStyle] = n;
  }
  assert.ok(counts.bald < counts.long, 'bald has less hair');
  let plain = 0, full = 0;
  new Human({ id: 'a', name: 'A' }).group.traverse(() => plain++);
  new Human({ id: 'b', name: 'B', extras }).group.traverse(() => full++);
  assert.ok(full > plain);
});

test('Human: label:false gives no label', () => {
  const h = new Human({ id: 'a', name: 'A', label: false });
  assert.equal(h.label, undefined);
});

test('setItem: puts a box in the right hand, null removes it', () => {
  const h = new Human({ id: 'a', name: 'A' });
  h.setItem(0xff0000);
  assert.ok(h.item);
  assert.equal(h.item.parent, h.armR.el);
  assert.equal(h.item.material.color.getHex(), 0xff0000);
  const first = h.item;
  h.setItem(0x00ff00);
  assert.notEqual(h.item, first);
  assert.equal(first.parent, null, 'old item removed');
  h.setItem(null);
  assert.equal(h.item, null);
  assert.equal(h.armR.el.children.includes(first), false);
  h.setItem(undefined);
  assert.equal(h.item, null);
});

test('faceToward turns the body to a point', () => {
  const h = new Human({ id: 'a', name: 'A' });
  h.group.position.set(0, 0, 0);
  h.faceToward(0, 5);
  assert.equal(h.group.rotation.y, 0);
  h.faceToward(5, 0);
  assert.ok(Math.abs(h.group.rotation.y - Math.PI / 2) < 1e-9);
});

test('lookAt turns only the head, by at most 1 radian, smoothly', () => {
  const h = new Human({ id: 'a', name: 'A' });
  h.lookAt(5, 0);
  assert.ok(h.head.rotation.y > 0 && h.head.rotation.y < 0.11);
  for (let i = 0; i < 200; i++) h.lookAt(-5, -0.01); // almost behind: clamped
  assert.ok(Math.abs(h.head.rotation.y + 1) < 1e-3);
  assert.equal(h.group.rotation.y, 0);
});

test('animate: legs swing when walking, mouth moves when talking', () => {
  const h = new Human({ id: 'a', name: 'A' });
  h.animate(0.1, true, 0.1);
  assert.ok(h.walk > 0);
  assert.notEqual(h.legL.top.rotation.x, 0);
  assert.equal(h.legL.top.rotation.x, -h.legR.top.rotation.x);
  h.talking = true;
  h.animate(0.1, false, 0.1);
  assert.ok(h.mouth.scale.y > 1);
  h.talking = false;
  h.animate(0.1, false, 0.1);
  assert.equal(h.mouth.scale.y, 1);
  for (let i = 0; i < 100; i++) h.animate(0.1, false, i);
  assert.ok(h.walk < 1e-3, 'walk phase settles');
  h.setItem(0xffffff);
  h.animate(0.1, false, 1);
  assert.equal(h.armR.sh.rotation.x, -0.6, 'arm holds the item up');
});

test('animate: eyes close for a short blink', () => {
  const h = new Human({ id: 'a', name: 'A' });
  const eyes = () => h.head.children.filter(c => c.geometry?.type === 'SphereGeometry' && Math.abs(c.position.y - h.eyesY) < 0.001);
  assert.ok(eyes().length >= 2);
  h.blink = 0.2;
  h.animate(0.1, false, 0); // blink = 0.1: closed
  assert.ok(eyes().every(e => !e.visible));
  h.animate(0.2, false, 0); // blink < 0: open, new timer 2..6
  assert.ok(eyes().every(e => e.visible));
  assert.ok(h.blink >= 2 && h.blink <= 6);
});

test('Panda: parts, label, hit box', () => {
  const p = new Panda();
  assert.equal(p.legs.length, 4);
  assert.deepEqual(p.hit.userData, { kind: 'buu', id: 'buu' });
  assert.ok(p.label instanceof THREE.Sprite);
});

test('Panda.faceToward turns 12% of the way each call, the short way', () => {
  const p = new Panda();
  p.faceToward(5, 0); // target +90°
  assert.ok(Math.abs(p.group.rotation.y - Math.PI / 2 * 0.12) < 1e-9);
  for (let i = 0; i < 200; i++) p.faceToward(5, 0);
  assert.ok(Math.abs(p.group.rotation.y - Math.PI / 2) < 1e-6);
  p.group.rotation.y = Math.PI * 0.95;
  p.faceToward(-0.1, -5); // target ≈ -179°, nearer by going up past 180°
  assert.ok(p.group.rotation.y > Math.PI * 0.95);
});

test('Panda.animate: walking legs, idle settle, head nods while talking', () => {
  const p = new Panda();
  p.animate(0.1, true, 0);
  assert.notEqual(p.legs[0].rotation.x, 0);
  assert.equal(p.legs[0].rotation.x, p.legs[3].rotation.x);
  assert.equal(p.legs[1].rotation.x, -p.legs[0].rotation.x);
  for (let i = 0; i < 100; i++) p.animate(0.1, false, i);
  assert.ok(Math.abs(p.legs[0].rotation.x) < 1e-6);
  p.talking = true;
  p.animate(0.1, false, 0.1);
  assert.notEqual(p.head.rotation.x, 0);
  p.talking = false;
  p.animate(0.1, false, 0.1);
  assert.equal(p.head.rotation.x, 0);
});
