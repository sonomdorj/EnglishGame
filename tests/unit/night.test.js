import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeG, data, FakeDialog } from './fake-game.js';
import { CONFIG } from '../../config.js';

const THREE = await import('three');
const { DayNight, Headmaster } = await import('../../night.js');
const { World, HOUSES, GATE_SPAWN, SCHOOL } = await import('../../world.js');

function dayNightG() {
  const G = { scene: new THREE.Scene(), player: { pos: new THREE.Vector3(0, 0, 10) }, camera: new THREE.PerspectiveCamera(),
    hemi: new THREE.HemisphereLight(), sun: new THREE.DirectionalLight(), nights: [] };
  G.scene.fog = new THREE.Fog(0xffffff, 1, 2);
  G.world = { setNight: f => G.nights.push(f) };
  return G;
}

test('DayNight: sky, sun, moon and stars in the scene; starts in the morning', () => {
  const G = dayNightG();
  const dn = new DayNight(G);
  assert.equal(dn.t, 60);
  assert.equal(dn.isNight, false);
  assert.equal(dn.cycle, CONFIG.dayLengthSec + CONFIG.nightLengthSec);
  for (const o of [dn.sky, dn.sunDisc, dn.moon, dn.stars]) assert.ok(G.scene.children.includes(o));
  assert.equal(dn.stars.geometry.attributes.position.count, 700);
});

test('DayNight: light fades in at dawn, full in the day, fades at dusk, 0 at night', () => {
  const G = dayNightG();
  const dn = new DayNight(G);
  const lightAt = t => { dn.t = t; dn.update(0); return dn.light; };
  const d = CONFIG.dayLengthSec;
  assert.equal(lightAt(0), 0);
  assert.equal(lightAt(5), 0.5);
  assert.equal(lightAt(10), 1);
  assert.equal(lightAt(d / 2), 1);
  assert.equal(lightAt(d - 5), 0.5);
  assert.equal(lightAt(d), 0);
  assert.equal(dn.isNight, true);
  assert.equal(lightAt(d + CONFIG.nightLengthSec - 1), 0);
});

test('DayNight: time wraps after one full cycle', () => {
  const dn = new DayNight(dayNightG());
  dn.t = dn.cycle - 1;
  dn.update(3);
  assert.ok(Math.abs(dn.t - 2) < 1e-9);
  assert.equal(dn.isNight, false);
});

test('DayNight: night look', () => {
  const G = dayNightG();
  const dn = new DayNight(G);
  dn.t = 120; dn.update(0);
  assert.equal(dn.sunDisc.visible, true);
  assert.equal(dn.moon.visible, false);
  assert.equal(dn.stars.material.opacity, 0);
  assert.ok(Math.abs(G.sun.intensity - 2.45) < 1e-9);
  assert.ok(Math.abs(G.hemi.intensity - 1.1) < 1e-9);
  assert.equal(G.nights.at(-1), 0);
  dn.t = CONFIG.dayLengthSec + 30; dn.update(0);
  assert.equal(dn.sunDisc.visible, false);
  assert.equal(dn.moon.visible, true);
  assert.equal(dn.stars.material.opacity, 1);
  assert.ok(Math.abs(G.sun.intensity - 0.05) < 1e-9);
  assert.ok(Math.abs(G.hemi.intensity - 0.25) < 1e-9);
  assert.equal(G.nights.at(-1), 1);
  assert.ok(G.scene.fog.color.equals(dn.sky.material.uniforms.horizon.value));
});

test('DayNight: sun light follows the player; sky follows the camera', () => {
  const G = dayNightG();
  const dn = new DayNight(G);
  G.camera.position.set(5, 2, 7);
  dn.update(0.1);
  assert.ok(G.sun.target.position.equals(G.player.pos));
  assert.ok(Math.abs(G.sun.position.distanceTo(G.player.pos) - 80) < 1e-6);
  assert.ok(dn.sky.position.equals(G.camera.position));
  assert.ok(dn.stars.position.equals(G.camera.position));
});

// ---------- Headmaster ----------

function hmG({ world } = {}) {
  const G = makeG();
  G.scene = new THREE.Scene();
  G.world = world || { lineOfSight: () => true };
  G.teleports = [];
  G.teleportPlayer = spot => { G.teleports.push(spot); G.player.pos.set(spot.x, spot.y, spot.z); };
  G.player.pos = new THREE.Vector3(30, 0, 30);
  G.headmaster = new Headmaster(G);
  return G;
}
const night = (G, on = true) => { G.dayNight.isNight = on; };
const hmUpdate = (G, sec, dt = 0.1) => { for (let t = 0; t < sec; t += dt) { G.clock += dt; G.headmaster.update(dt); } };

test('Headmaster: in the scene at his day spot, lantern off', () => {
  const G = hmG();
  const H = G.headmaster;
  assert.ok(G.scene.children.includes(H.npc.group));
  assert.equal(H.npc.hit.userData.kind, 'headmaster');
  assert.deepEqual([H.npc.group.position.x, H.npc.group.position.z], [H.daySpot.x, H.daySpot.z]);
  assert.equal(H.daySpot.z, SCHOOL.z + SCHOOL.d / 2 + 2.5);
  H.update(0.1);
  assert.equal(H.lantern.intensity, 0);
  assert.equal(H.lamp.visible, false);
  assert.equal(H.speed, 2.2);
  assert.equal(H.sight, 9);
});

test('Headmaster: route = road, door (wait 2 s), road for each patrolled house', () => {
  const G = hmG();
  const H = G.headmaster;
  assert.equal(H.route.length, 9);
  assert.deepEqual(H.route.filter(p => p.wait).map(p => HOUSES.find(h => Math.abs(h.front.z - p.z) < 1e-9 && Math.abs(h.front.x - p.x) < 1e-9).id), ['h2', 'h5', 'h3']);
  assert.ok(H.route.filter(p => !p.wait).every(p => p.x === 1.8));
  H.patrolCount = 6;
  H.wp = 8;
  H.buildRoute();
  assert.equal(H.route.length, 18);
  H.patrolCount = 1;
  H.buildRoute();
  assert.equal(H.wp, 8 % 3);
});

test('Headmaster: night = lantern on, walks the route and waits at the doors', () => {
  const G = hmG();
  const H = G.headmaster;
  night(G);
  H.update(0.01);
  assert.equal(H.lantern.intensity, 6);
  assert.equal(H.lamp.visible, true);
  const start = H.npc.group.position.clone();
  assert.ok(start.distanceTo(new THREE.Vector3(0, 0, SCHOOL.z + SCHOOL.d / 2 + 4)) < 0.05, 'night start spot');
  hmUpdate(G, 3);
  assert.ok(H.npc.group.position.distanceTo(start) > 5, 'walking');
  let waited = false;
  for (let i = 0; i < 2000 && !waited; i++) { hmUpdate(G, 0.1); if (H.wait > 0) waited = true; }
  assert.ok(waited, 'waits at a door');
  assert.ok(H.wait <= 2);
  const at = H.npc.group.position.clone();
  hmUpdate(G, 1.5);
  assert.ok(H.npc.group.position.equals(at), 'still waiting');
  // Day again: back to the school.
  night(G, false);
  H.update(0.1);
  assert.deepEqual([H.npc.group.position.x, H.npc.group.position.z], [H.daySpot.x, H.daySpot.z]);
});

test('Headmaster: sees only ahead, inside his sight, with a clear line', () => {
  let clear = true;
  const G = hmG({ world: { lineOfSight: () => clear } });
  const H = G.headmaster;
  H.npc.group.position.set(0, 0, 0);
  H.npc.group.rotation.y = 0; // looks at +z
  const P = (x, z) => new THREE.Vector3(x, 0, z);
  assert.equal(H.sees(P(0, 5)), true);
  assert.equal(H.sees(P(0, 9.5)), false, 'too far');
  assert.equal(H.sees(P(0, -5)), false, 'behind');
  assert.equal(H.sees(P(0, -1)), true, 'very close: seen from any side');
  assert.equal(H.sees(P(4, 4)), true, '45° is inside the 50° cone');
  assert.equal(H.sees(P(5, 2)), false, '68° is outside');
  clear = false;
  assert.equal(H.sees(P(0, 5)), false, 'wall in between');
  H.easy = true;
  clear = true;
  assert.equal(H.sees(P(0, 6)), false, 'easy: sight 5');
});

test('Headmaster: catches the player at night: line, back to the gate, 4 s grace', () => {
  const G = hmG();
  const H = G.headmaster;
  night(G);
  H.update(0.01);
  const p = H.npc.group.position;
  G.player.pos.set(p.x, 0, p.z + 0.5);
  H.update(0.01);
  assert.deepEqual(G.teleports, [GATE_SPAWN]);
  assert.equal(G.dialog.last, G.people.headmaster.lines.caught[0]);
  assert.equal(H.catches.length, 1);
  assert.equal(H.cooldown, 4);
  G.dialog.finish();
  const stayClose = sec => { for (let t = 0; t < sec; t += 0.1) { G.player.pos.set(p.x, 0, p.z + 0.5); H.update(0.1); G.dialog.finish(); } };
  stayClose(3.8);
  assert.equal(H.catches.length, 1, 'grace time');
  stayClose(0.4);
  assert.equal(H.catches.length, 2);
  assert.equal(G.dialog.last, G.people.headmaster.lines.caught[1]);
});

test('Headmaster: caught lines go round', () => {
  const G = hmG();
  const lines = G.people.headmaster.lines.caught;
  for (let i = 0; i < lines.length + 1; i++) G.headmaster.catchPlayer();
  assert.equal(G.dialog.said.at(-1), lines[0]);
  assert.equal(G.dialog.said.at(-2), lines.at(-1));
});

test('Headmaster: no catch in the day, or while a dialog or panel is open', () => {
  const G = hmG();
  const H = G.headmaster;
  const p = H.npc.group.position;
  G.player.pos.set(p.x, 0, p.z + 0.5);
  hmUpdate(G, 1);
  assert.equal(H.catches.length, 0, 'day');
  night(G);
  H.update(0.01);
  G.player.pos.set(H.npc.group.position.x, 0, H.npc.group.position.z + 0.5);
  G.dialog.say([{ who: 'buu', text: 'x' }]);
  H.update(0.01);
  assert.equal(H.catches.length, 0, 'dialog');
  G.dialog.finish();
  G.picker.open({ title: 't', options: [] });
  H.update(0.01);
  assert.equal(H.catches.length, 0, 'panel');
});

test('Headmaster adapts: 3 catches in 5 min = easy; 10 min without = one more house', () => {
  const G = hmG();
  const H = G.headmaster;
  for (const t of [10, 20, 30]) { G.clock = t; H.catchPlayer(); }
  G.clock = 40; H.adapt();
  assert.equal(H.easy, true);
  assert.equal(H.speed, 1.4);
  assert.equal(H.sight, 5);
  G.clock = 311; H.adapt();
  assert.equal(H.easy, false, 'old catches no longer count');
  assert.equal(H.patrolCount, 3);
  G.clock = 30 + 600; H.adapt();
  assert.equal(H.patrolCount, 4);
  assert.equal(H.route.length, 12);
  for (let k = 2; k <= 5; k++) { G.clock = 30 + 600 * k; H.adapt(); }
  assert.equal(H.patrolCount, 6, 'max 6');
});

test('Headmaster in the real village: walls block his sight', () => {
  const world = new World(new THREE.Scene());
  world.build();
  const G = hmG({ world });
  const H = G.headmaster;
  const h = HOUSES[1]; // h2, west side
  H.npc.group.position.set(h.front.x + 3, 0, h.z);
  H.npc.faceToward(h.x, h.z);
  assert.equal(H.sees(new THREE.Vector3(h.front.x + 0.5, 0, h.z)), true, 'outside, in front');
  assert.equal(H.sees(new THREE.Vector3(h.x, 0, h.z + 3)), false, 'inside, behind the front wall');
});

test('dialog stand-in sanity', () => {
  const d = new FakeDialog();
  let n = 0;
  d.say([{ text: 'a' }], () => { n++; d.say([{ text: 'b' }], () => n++); });
  d.finish();
  assert.equal(n, 2);
  assert.deepEqual(d.texts, ['a', 'b']);
  assert.ok(data.quests.length === 50);
});
