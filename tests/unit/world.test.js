import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './fake-dom.js';
import { readJSON } from './data.js';

installDom();
const THREE = await import('three');
const W = await import('../../world.js');
const { World, HOUSES, houseAt, BOUND, GATE_SPAWN, SCHOOL, FETCH_WORDS, FETCH_SPOTS, ITEMS, makeItem, mats } = W;

const body = (x, y, z, r = 0.3, h = 1.7) => ({ pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), r, h, onGround: false });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// An empty world with hand-made boxes.
function boxWorld(...boxes) {
  const w = new World(new THREE.Scene());
  for (const b of boxes) w.colliders.add(b);
  return w;
}
const box = (minX, minY, minZ, maxX, maxY, maxZ, extra = {}) => ({ minX, minY, minZ, maxX, maxY, maxZ, ...extra });

// ---------- data ----------

test('six houses, three on each side, door spots in front of the door', () => {
  assert.equal(HOUSES.length, 6);
  assert.deepEqual(HOUSES.map(h => h.id), ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  for (const h of HOUSES) {
    const side = Math.sign(h.door.x - h.x);
    assert.equal(side, h.x < 0 ? 1 : -1, `${h.id} door faces the road`);
    assert.ok(Math.abs(h.door.z - h.z) < 1e-9);
    assert.ok(Math.abs(Math.abs(h.front.x - h.x) - 5.6) < 1e-9);
    assert.ok(Math.abs(h.villagerSpot.z - h.z) > 2, 'villager stands beside the door');
    assert.deepEqual(h.road, { x: 0, z: h.z });
  }
});

test('houseAt: inside a house footprint only', () => {
  for (const h of HOUSES) assert.equal(houseAt(h.x, h.z), h);
  assert.equal(houseAt(0, 0), null);
  assert.equal(houseAt(-14 + 3.9, 34 + 4.9), HOUSES[0]);
  assert.equal(houseAt(-14 + 4.1, 34), null);
});

test('fixed places are inside the village', () => {
  const inside = (x, z) => x > BOUND.minX && x < BOUND.maxX && z > BOUND.minZ && z < BOUND.maxZ;
  assert.ok(inside(GATE_SPAWN.x, GATE_SPAWN.z));
  assert.ok(inside(SCHOOL.x, SCHOOL.z));
  for (const [x, z] of FETCH_SPOTS) assert.ok(inside(x, z));
  for (const it of ITEMS) if (!it.room) assert.ok(inside(it.x, it.z), it.name);
  assert.equal(ITEMS.length, 12);
  assert.equal(new Set(ITEMS.map(i => i.name)).size, 12);
});

test('every fetch word is a word in words.json and has a Buu line', () => {
  const words = new Set(readJSON('words.json').map(w => w.word));
  const bring = readJSON('buu.json').bring;
  assert.ok(FETCH_SPOTS.length >= 3, 'room for the right thing and 2 others');
  for (const w of FETCH_WORDS) {
    assert.ok(words.has(w), w);
    assert.ok(bring[w], `buu.bring.${w}`);
  }
});

test('every lost thing has Buu lines', () => {
  const B = readJSON('buu.json');
  for (const it of ITEMS) assert.ok(B.lost[it.name], it.name);
  assert.equal(B.lostCount.length, ITEMS.length);
});

// ---------- makeItem ----------

test('makeItem: a model and a glow ring for every thing', () => {
  for (const name of new Set([...FETCH_WORDS, ...ITEMS.map(i => i.name)])) {
    const g = makeItem(name);
    assert.ok(g instanceof THREE.Group, name);
    assert.ok(g.children.length >= 2, `${name} has a model`);
    assert.equal(g.userData.ring, g.children.at(-1));
    assert.ok(g.userData.ring.geometry instanceof THREE.RingGeometry);
  }
});

test('makeItem: unknown names get a white box', () => {
  const g = makeItem('dragon');
  assert.equal(g.children.length, 2);
  assert.ok(g.children[0].geometry instanceof THREE.BoxGeometry);
  assert.equal(g.children[0].material.color.getHex(), 0xffffff);
});

// ---------- collision (hand-made boxes) ----------

test('collides: overlap tests on x, z and height', () => {
  const w = boxWorld(box(0, 0, 0, 1, 2, 1));
  assert.equal(w.collides(0.5, 0, 0.5, 0.3, 1.7), true);
  assert.equal(w.collides(1.29, 0, 0.5, 0.3, 1.7), true);
  assert.equal(w.collides(1.31, 0, 0.5, 0.3, 1.7), false);
  assert.equal(w.collides(0.5, 2, 0.5, 0.3, 1.7), false, 'standing on top');
  assert.equal(w.collides(0.5, -2, 0.5, 0.3, 1.7), false, 'below');
  assert.deepEqual(w.hit(0.5, 0, 0.5, 0.3, 1.7), box(0, 0, 0, 1, 2, 1));
  assert.equal(w.hit(5, 0, 5, 0.3, 1.7), null);
});

test('colliders grid: a big box is found from every cell it covers', () => {
  const w = boxWorld(box(-10, 0, -10, 10, 1, 10));
  for (const [x, z] of [[-9, -9], [9, 9], [0, 0], [-9, 9]]) assert.equal(w.collides(x, 0, z, 0.3, 1.7), true);
  assert.equal(w.colliders.near(20, 20, 21, 21).size, 0);
});

test('moveBody: gravity, landing on the ground', () => {
  const w = boxWorld();
  const b = body(0, 3, 0);
  for (let i = 0; i < 100; i++) w.moveBody(b, 0.05, 18);
  assert.equal(b.pos.y, 0);
  assert.equal(b.vel.y, 0);
  assert.equal(b.onGround, true);
  b.vel.y = 5;
  w.moveBody(b, 0.05, 18);
  assert.ok(b.pos.y > 0);
  assert.equal(b.onGround, false);
});

test('moveBody: big dt is split in small steps (no tunnel through a thin wall)', () => {
  const w = boxWorld(box(1, 0, -5, 1.1, 3, 5));
  const b = body(0, 0, 0);
  b.vel.x = 50;
  w.moveBody(b, 0.1, 18); // 5 m in one call
  assert.ok(b.pos.x < 1 - 0.29, `stopped before the wall, x = ${b.pos.x}`);
});

test('moveBody: slides along a wall', () => {
  const w = boxWorld(box(1, 0, -5, 2, 3, 5));
  const b = body(0, 0, 0);
  b.vel.set(4, 0, 4);
  w.moveBody(b, 0.5, 18);
  assert.ok(b.pos.x < 0.71);
  assert.ok(Math.abs(b.pos.z - 2) < 1e-6);
});

test('moveBody: steps up onto low things, not high ones', () => {
  const w = boxWorld(box(1, 0, -5, 3, 0.3, 5), box(1, 0, 6, 3, 0.6, 9));
  const low = body(0, 0, 0);
  low.vel.x = 4;
  for (let i = 0; i < 10; i++) w.moveBody(low, 0.05, 18);
  assert.ok(low.pos.x > 1.2);
  assert.ok(Math.abs(low.pos.y - 0.3) < 1e-6);
  const high = body(0, 0, 7.5);
  high.vel.x = 4;
  for (let i = 0; i < 10; i++) w.moveBody(high, 0.05, 18);
  assert.ok(high.pos.x <= 0.7 + 1e-9);
  assert.equal(high.pos.y, 0);
});

test('moveBody: lands on top of a box', () => {
  const w = boxWorld(box(-1, 0, -1, 1, 1, 1));
  const b = body(0, 2, 0);
  for (let i = 0; i < 40; i++) w.moveBody(b, 0.05, 18);
  assert.ok(Math.abs(b.pos.y - 1) < 1e-6, `y = ${b.pos.y}`);
  assert.equal(b.onGround, true);
});

test('moveBody: hitting a ceiling stops the jump', () => {
  const w = boxWorld(box(-1, 2.5, -1, 1, 3, 1));
  const b = body(0, 0, 0);
  b.vel.y = 10;
  w.moveBody(b, 0.05, 18);
  w.moveBody(b, 0.05, 18);
  assert.ok(b.pos.y + b.h <= 2.5 + 1e-6);
  assert.equal(b.vel.y, 0);
});

test('moveBody: the village bounds hold the body', () => {
  const w = boxWorld();
  const b = body(0, 0, 0);
  b.vel.set(1000, 0, -1000);
  w.moveBody(b, 0.5, 18);
  assert.equal(b.pos.x, BOUND.maxX);
  assert.equal(b.pos.z, BOUND.minZ);
  b.vel.set(-1000, 0, 1000);
  w.moveBody(b, 0.5, 18);
  assert.equal(b.pos.x, BOUND.minX);
  assert.equal(b.pos.z, BOUND.maxZ);
});

test('topUnder ignores water and boxes above the limit', () => {
  const w = boxWorld(box(-1, 0, -1, 1, 0.2, 1), box(-1, 0, -1, 1, 0.3, 1, { water: true }), box(-1, 0, -1, 1, 0.9, 1));
  assert.equal(w.topUnder(0, 0, 0.3, 0.5), 0.2);
  assert.equal(w.topUnder(0, 0, 0.3, 1), 0.9);
  assert.equal(w.topUnder(5, 5, 0.3, 1), 0);
});

test('lineOfSight: walls block; water, low boxes and open air do not', () => {
  const wall = boxWorld(box(-0.1, 0, -5, 0.1, 3, 5));
  assert.equal(wall.lineOfSight(V(-3, 1.6, 0), V(3, 1.6, 0)), false);
  assert.equal(wall.lineOfSight(V(-3, 1.6, 0), V(-1, 1.6, 0)), true, 'stops before the wall');
  assert.equal(wall.lineOfSight(V(-3, 3.5, 0), V(3, 3.5, 0)), true, 'over the wall');
  assert.equal(wall.lineOfSight(V(-3, 1.6, 6), V(3, 1.6, 6)), true, 'beside the wall');
  assert.equal(wall.lineOfSight(V(0, 1.6, -9), V(0, 1.6, 9)), false, 'along a line inside the wall');
  assert.equal(boxWorld(box(-0.1, 0, -5, 0.1, 3, 5, { water: true })).lineOfSight(V(-3, 1.6, 0), V(3, 1.6, 0)), true);
  assert.equal(boxWorld(box(-0.1, 0, -5, 0.1, 0.9, 5)).lineOfSight(V(-3, 0.5, 0), V(3, 0.5, 0)), true);
  assert.equal(boxWorld().lineOfSight(V(0, 1, 0), V(0, 1, 0)), true);
});

test('reserve / isReserved', () => {
  const w = boxWorld();
  w.reserve(0, 0, 2, 2);
  assert.equal(w.isReserved(1, 1), true);
  assert.equal(w.isReserved(2.5, 1), false);
  assert.equal(w.isReserved(2.5, 1, 1), true);
});

// ---------- the real village ----------

const scene = new THREE.Scene();
const village = new World(scene);
village.build();
const walk = (b, vx, vz, sec) => { b.vel.x = vx; b.vel.z = vz; for (let t = 0; t < sec; t += 0.05) village.moveBody(b, 0.05, 18); };

test('build: colliders, 6 letters, 12 lost things, signs on every house', () => {
  assert.ok(village.colliders.boxes.length > 300);
  assert.equal(village.letters.length, 6);
  assert.deepEqual(village.letters.map(l => l.houseId).sort(), ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  for (const l of village.letters) assert.equal(l.mesh.userData.kind, 'letter');
  assert.equal(village.items.length, 12);
  for (const it of village.items) assert.deepEqual(it.hit.userData, { kind: 'item', name: it.name });
  for (const h of HOUSES) assert.equal(scene.getObjectByName(`sign-${h.id}`), h.sign);
  assert.ok(village.calendars.length >= 6);
});

test('build: room items are inside their house', () => {
  for (const it of ITEMS.filter(i => i.room)) {
    const p = village.items.find(x => x.name === it.name).group.position;
    assert.equal(houseAt(p.x, p.z)?.id, it.room, it.name);
  }
});

test('the gate spawn, villager spots, fetch spots and lost things are free', () => {
  assert.equal(village.collides(GATE_SPAWN.x, 0, GATE_SPAWN.z, 0.3, 1.7), false);
  for (const h of HOUSES) {
    assert.equal(village.collides(h.villagerSpot.x, 0, h.villagerSpot.z, 0.3, 1.7), false, h.id);
    assert.equal(village.collides(h.front.x, 0, h.front.z, 0.3, 1.7), false, h.id);
  }
  for (const [x, z] of FETCH_SPOTS) assert.equal(village.collides(x, 0, z, 0.3, 1.7), false, `${x},${z}`);
});

test('the player walks through a house door into the kitchen', () => {
  for (const h of HOUSES) {
    const b = body(h.front.x, 0, h.front.z);
    const dir = Math.sign(h.x - h.front.x);
    walk(b, dir * 4, 0, 1.2);
    assert.equal(houseAt(b.pos.x, b.pos.z), h, `${h.id}: inside at ${b.pos.x.toFixed(2)}`);
  }
});

test('house walls block walking and sight', () => {
  const h = HOUSES[0]; // west side, door faces +x
  const b = body(h.front.x, 0, h.z + 3);
  walk(b, -4, 0, 2);
  assert.equal(houseAt(b.pos.x, b.pos.z), null, 'front wall beside the door');
  const inside = V(h.x + 1, 1.6, h.z + 3), outside = V(h.front.x, 1.6, h.z + 3);
  assert.equal(village.lineOfSight(outside, inside), false);
  assert.equal(village.lineOfSight(V(h.front.x, 1.6, h.z), V(h.x + 2, 1.6, h.z)), true, 'through the open door');
});

test('the fence keeps the player inside', () => {
  const b = body(0, 0, 40);
  walk(b, 30, 0, 3);
  assert.ok(b.pos.x < 57);
  const g = body(GATE_SPAWN.x, 0, GATE_SPAWN.z);
  walk(g, 0, 10, 2);
  assert.ok(g.pos.z <= BOUND.maxZ);
});

test('the well in the middle of the plaza blocks', () => {
  assert.equal(village.collides(0, 0, 0, 0.3, 1.7), true);
  const b = body(0, 0, 4);
  walk(b, 0, -4, 2);
  assert.ok(b.pos.z > 1.2);
});

test('setSignText puts a texture on the sign', () => {
  const h = HOUSES[2];
  village.setSignText(h, 'Oyunaa');
  assert.ok(h.sign.material.map instanceof THREE.CanvasTexture);
});

test('setNight: windows glow at night only', () => {
  village.setNight(0);
  assert.equal(mats.glass().emissiveIntensity, 0);
  assert.ok(Math.abs(mats.lamp().emissiveIntensity - 0.2) < 1e-9);
  village.setNight(1);
  assert.ok(Math.abs(mats.glass().emissiveIntensity - 0.9) < 1e-9);
  assert.ok(Math.abs(mats.lamp().emissiveIntensity - 2.4) < 1e-9);
});
