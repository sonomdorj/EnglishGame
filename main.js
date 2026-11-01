import * as THREE from 'three';
import { CONFIG } from './config.js';
import { World, HOUSES, GATE_SPAWN, houseAt } from './world.js';
import { Human, Panda } from './npc.js';
import { Dialog } from './dialog.js';
import { Picker, renderBook } from './ui.js';
import { Learner } from './learn.js';
import { QuestRunner } from './quest.js';
import { DayNight, Headmaster } from './night.js';
import { loadSave, writeSave } from './save.js';
import { Voice } from './audio.js';
import { parseDate } from './dates.js';

const $ = id => document.getElementById(id);

// How each villager looks.
const LOOKS = {
  batbayar: { shirt: 0x4a4f58, pants: 0x2f2a26, hair: 0x15100c, extras: ['apron', 'beard'], apronColor: 0x6a4a2a, skin: 0xc8946c },
  dulamsuren: { shirt: 0x8a5a9a, pants: 0x7a2a34, hair: 0x1b1410, hairStyle: 'bun', extras: ['apron', 'skirt', 'longSleeves'] },
  oyunaa: { shirt: 0xe86aa6, pants: 0x2a3a6a, hair: 0x120c08, hairStyle: 'long', extras: ['skirt'], scale: 0.76 },
  enkhjargal: { shirt: 0x6f8f3a, pants: 0x5a4632, hair: 0x6a6a6a, hairStyle: 'bun', extras: ['cap', 'longSleeves'], capColor: 0xb03a2a, skin: 0xc8946c },
  tsetseg: { shirt: 0x3b6fd6, pants: 0x4a4a52, hair: 0x1b1410, hairStyle: 'long', extras: ['glasses', 'skirt', 'longSleeves'] },
  ganbold: { shirt: 0x2f8c8c, pants: 0x283a5a, hair: 0x2a2018, extras: ['cap', 'mustache'], capColor: 0x1e2e4a, skin: 0xc0886a },
};
const LOST_TOTAL = 12;

async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Cannot load ${path}`);
  return r.json();
}

const G = window.game = { started: false, paused: false, clock: 0 };

async function init() {
  const [allPeople, quests, words, letters, buuLines] = await Promise.all(
    ['villagers.json', 'quests.json', 'words.json', 'letters.json', 'buu.json'].map(loadJSON));
  const villagers = allPeople.filter(v => v.house);
  G.people = Object.fromEntries(allPeople.map(v => [v.id, v]));
  G.buuLines = buuLines;
  G.voice = new Voice();
  await G.voice.load();
  G.villagerList = villagers;
  G.villagerData = Object.fromEntries(villagers.map(v => [v.id, v]));
  G.quests = quests;
  G.letters = Object.fromEntries(letters.map(l => [l.house, l.lines]));

  // Save data
  G.state = Object.assign({ questsDone: 0, met: [], items: [], lettersRead: [], found: [], introDone: false }, loadSave());
  G.persist = () => writeSave(G.state);
  G.learner = new Learner(words, G.state, G.persist);

  // Renderer, scene, lights
  const canvas = $('view');
  const renderer = G.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // ?fast=1 (used by tests): low resolution and no shadows.
  const fast = new URLSearchParams(location.search).has('fast');
  renderer.setPixelRatio(fast ? 0.5 : Math.min(2, devicePixelRatio));
  renderer.shadowMap.enabled = !fast;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = G.scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe6f5, 70, 320);
  const camera = G.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 800);
  camera.rotation.order = 'YXZ';
  G.hemi = new THREE.HemisphereLight(0xffffff, 0x5a6a48, 1);
  G.sun = new THREE.DirectionalLight(0xffffff, 2.4);
  G.sun.castShadow = true;
  G.sun.shadow.mapSize.set(2048, 2048);
  Object.assign(G.sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
  G.sun.shadow.bias = -0.0005;
  G.sun.shadow.normalBias = 0.03;
  scene.add(G.hemi, G.sun, G.sun.target);
  // Warm light inside the house the player is in.
  G.roomLight = new THREE.PointLight(0xffd9a8, 0, 11, 1.4);
  scene.add(G.roomLight);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  // World
  const world = G.world = new World(scene);
  world.build();
  G.houseById = Object.fromEntries(HOUSES.map(h => [h.id, h]));
  for (const v of villagers) world.setSignText(G.houseById[v.house], v.name);
  for (const it of world.items) it.group.visible = !G.state.found.includes(it.name);

  // Player
  G.player = { pos: new THREE.Vector3(GATE_SPAWN.x, GATE_SPAWN.y, GATE_SPAWN.z), vel: new THREE.Vector3(), r: 0.3, h: 1.7, onGround: false };
  G.yaw = GATE_SPAWN.yaw; G.pitch = 0;
  G.dayNight = new DayNight(G);

  // Villagers stand in front of their house.
  G.villagers = {};
  for (const v of villagers) {
    const h = G.houseById[v.house];
    const npc = new Human({ id: v.id, name: v.name, ...(LOOKS[v.id] || {}) });
    npc.group.position.set(h.villagerSpot.x, 0, h.villagerSpot.z);
    npc.faceToward(0, h.villagerSpot.z);
    npc.home = { ...h.villagerSpot };
    scene.add(npc.group);
    G.villagers[v.id] = npc;
  }

  // Buu
  G.buu = new Panda();
  G.buuBody = { pos: new THREE.Vector3(GATE_SPAWN.x + 1.5, 0, GATE_SPAWN.z + 2), vel: new THREE.Vector3(), r: 0.45, h: 1.2, onGround: false };
  G.buu.group.position.copy(G.buuBody.pos);
  scene.add(G.buu.group);
  G.buuStuck = 0;

  G.headmaster = new Headmaster(G);

  // UI
  G.dialog = new Dialog($('dialog'), G.voice, nameOf);
  G.picker = new Picker($('picker'));
  G.bookEl = $('book');
  G.quest = new QuestRunner(G);

  // Things the player can look at and use
  G.targets = [G.buu.hit, ...Object.values(G.villagers).map(n => n.hit), ...world.letters.map(l => l.mesh),
    ...world.calendars, ...world.items.map(i => i.hit)];
  G.raycaster = new THREE.Raycaster();

  setupInput(canvas);
  $('start').querySelector('.loading').hidden = true;
  $('start').querySelector('.ready').hidden = false;
  G.ready = true;

  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (G.started && !G.paused) update(dt);
    else updateCamera();
    renderer.render(scene, camera);
  });
}

// ---------- helpers used by quest / night code ----------

G.modalOpen = () => G.picker.isOpen || !G.bookEl.hidden;

G.openPanel = show => {
  G.closePanels();
  if (document.pointerLockElement) document.exitPointerLock();
  show();
};

G.closePanels = () => {
  G.picker.close();
  G.bookEl.hidden = true;
};

// Returns intro lines the first time the player meets a villager.
G.meet = id => {
  if (G.state.met.includes(id)) return [];
  G.state.met.push(id);
  G.persist();
  return G.villagerData[id].lines.intro;
};

function nameOf(who) {
  if (who === 'buu') return 'Buu';
  if (who === 'letter') return 'Letter';
  return G.people[who]?.name || '';
}

G.teleportPlayer = spot => {
  G.player.pos.set(spot.x, spot.y, spot.z);
  G.player.vel.set(0, 0, 0);
  G.yaw = spot.yaw ?? G.yaw;
  G.pitch = 0;
  placeBuuBehind();
  updateCamera();
};

function placeBuuBehind() {
  const p = G.player.pos, b = G.buuBody, d = CONFIG.buuFollowDistance;
  for (const [ox, oz] of [[Math.sin(G.yaw) * d, Math.cos(G.yaw) * d], [d, 0], [-d, 0], [0, d], [0, -d], [0, 0]]) {
    if (!G.world.collides(p.x + ox, p.y, p.z + oz, b.r, b.h)) { b.pos.set(p.x + ox, p.y, p.z + oz); break; }
  }
  b.vel.set(0, 0, 0);
}

function requestLock(canvas) {
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* not allowed now */ }
}

// ---------- input ----------

const keys = new Set();

function setupInput(canvas) {
  G.lockedAt = 0;
  $('start').addEventListener('click', () => {
    if (!G.ready) return;
    $('start').hidden = true;
    G.started = true;
    G.paused = false;
    requestLock(canvas);
  });
  canvas.addEventListener('click', () => {
    if (G.started && !G.modalOpen()) requestLock(canvas);
  });
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (locked) { G.lockedAt = performance.now(); G.paused = false; $('start').hidden = true; return; }
    // Lost the lock with Esc while playing: pause until the next click.
    if (G.started && !G.modalOpen()) {
      G.paused = true;
      $('start').hidden = false;
    }
  });
  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement !== canvas) return;
    // Some browsers send one big jump right after the lock starts. Ignore it.
    if (performance.now() - G.lockedAt < 150 || Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
    G.yaw -= e.movementX * CONFIG.mouseSensitivity;
    G.pitch -= e.movementY * CONFIG.mouseSensitivity;
    G.pitch = Math.max(-1.5, Math.min(1.5, G.pitch));
  });
  addEventListener('keydown', e => onKey(e));
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
}

function onKey(e) {
  if (!G.started) return;
  const code = e.code;
  if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
  const held = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'];
  if (e.repeat && !held.includes(code) && !code.startsWith('Arrow')) return;

  if (code === 'Space' && G.dialog.open) { G.dialog.next(); return; }
  if (code === 'KeyR') { G.dialog.replay(); return; }
  if (code === 'Escape') { G.closePanels(); return; }

  if (G.picker.isOpen) {
    const n = Number(e.key);
    if (n >= 1 && n <= 9) G.picker.pick(n - 1);
    if (code === 'KeyC' && G.picker.cfg?.calendarOnly) G.closePanels();
    return;
  }
  if (!G.bookEl.hidden) {
    if (code === 'KeyB') G.closePanels();
    return;
  }
  if (G.dialog.open) return;

  if (code === 'KeyE') interact();
  else if (code === 'KeyF') G.quest.trapKey();
  else if (code === 'KeyB') openBook();
  else if (code === 'KeyC') openCalendar();
  else keys.add(code);
  if (code === 'Space') jump();
}

function jump() {
  if (G.player.onGround) { G.player.vel.y = CONFIG.jumpSpeed; G.player.onGround = false; }
}

function openBook() {
  G.openPanel(() => {
    renderBook(G.bookEl, G.villagerList, G.state, LOST_TOTAL);
    G.bookEl.hidden = false;
  });
}

function openCalendar() {
  const q = G.quest.q;
  const { y, m } = q ? parseDate(q.date) : { y: 2024, m: 1 };
  G.openPanel(() => G.picker.open({ title: 'Calendar', cal: { y, m }, options: [], calendarOnly: true }));
}

// ---------- interaction ----------

function lookTarget() {
  G.raycaster.setFromCamera(new THREE.Vector2(0, 0), G.camera);
  G.raycaster.far = CONFIG.talkDistance + 0.5;
  const hit = G.raycaster.intersectObjects(G.targets, false).find(h => h.object.parent?.visible !== false);
  if (!hit || !hit.object.userData.kind) return null;
  // Walls block the view.
  const from = G.camera.position.clone();
  const to = hit.point.clone().lerp(from, 0.05);
  if (!G.world.lineOfSight(from, to)) return null;
  return hit.object.userData;
}

function hintFor(t) {
  if (!t) return '';
  if (t.kind === 'letter') return 'E to read';
  if (t.kind === 'calendar') return 'E to look';
  if (t.kind === 'item') return 'E to pick up';
  if (t.kind === 'headmaster') return 'E to talk';
  if (t.kind === 'villager' && G.quest.stage === 'take' && G.quest.q?.liar === t.id) return 'E to take';
  return 'E to talk';
}

function interact() {
  const t = lookTarget();
  if (!t) return;
  if (t.kind === 'buu') return G.quest.talkBuu();
  if (t.kind === 'letter') return readLetter(t.houseId);
  if (t.kind === 'calendar') return openCalendar();
  if (t.kind === 'item') return pickItem(t.name);
  if (t.kind === 'headmaster') {
    const hl = G.people.headmaster.lines;
    return G.dialog.say(G.dayNight.isNight ? hl.talkNight : hl.talkDay);
  }
  if (t.kind === 'villager') {
    if (G.quest.talkVillager(t.id)) return;
    const v = G.villagerData[t.id];
    const intro = G.meet(t.id);
    const line = v.lines.talk[Math.floor(Math.random() * v.lines.talk.length)];
    G.dialog.say(intro.length ? intro : [...v.lines.again, line]);
  }
}

function pickItem(name) {
  if (G.state.found.includes(name)) return;
  G.state.found.push(name);
  G.persist();
  const it = G.world.items.find(i => i.name === name);
  if (it) it.group.visible = false;
  const n = G.state.found.length;
  const B = G.buuLines;
  const lines = [B.lost[name], B.lostCount[n - 1]];
  if (n === LOST_TOTAL) lines.push(B.lostAll);
  G.dialog.say(lines);
}

function readLetter(houseId) {
  if (!G.dayNight.isNight) {
    G.dialog.say([G.buuLines.letterDay]);
    return;
  }
  if (!G.state.lettersRead.includes(houseId)) { G.state.lettersRead.push(houseId); G.persist(); }
  G.dialog.say(G.letters[houseId]);
}

// ---------- update ----------

function updateCamera() {
  const p = G.player;
  G.camera.position.set(p.pos.x, p.pos.y + 1.6, p.pos.z);
  G.camera.rotation.set(G.pitch, G.yaw, 0);
}

function update(dt) {
  G.clock += dt;
  const p = G.player;
  const frozen = G.dialog.open || G.modalOpen();

  // Movement
  let fx = 0, fz = 0;
  if (!frozen) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) fz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fz -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1;
    if (keys.has('Space')) { jump(); keys.delete('Space'); }
  }
  const len = Math.hypot(fx, fz) || 1;
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? CONFIG.runSpeed : CONFIG.walkSpeed;
  const sin = Math.sin(G.yaw), cos = Math.cos(G.yaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  p.vel.x = (fx * cos - fz * sin) / len * speed;
  p.vel.z = (-fx * sin - fz * cos) / len * speed;
  G.world.moveBody(p, dt, CONFIG.gravity);
  updateCamera();

  // Who is speaking right now
  const speaker = G.dialog.current?.who || '';
  updateBuu(dt);
  G.buu.talking = speaker === 'buu';
  for (const [id, npc] of Object.entries(G.villagers)) {
    const d = npc.group.position.distanceTo(p.pos);
    if (d < 7) npc.lookAt(p.pos.x, p.pos.z);
    npc.talking = speaker === id;
    npc.animate(dt, false, G.clock);
    npc.label.visible = d < 14;
  }
  const hm = G.headmaster.npc;
  hm.talking = speaker === 'headmaster';
  hm.label.visible = hm.group.position.distanceTo(p.pos) < 14;
  G.buu.label.visible = G.buuBody.pos.distanceTo(p.pos) < 10;

  for (const it of G.world.items) {
    if (!it.group.visible) continue;
    it.group.rotation.y += dt * 0.8;
    const r = it.group.userData.ring;
    if (r) r.material.opacity = 0.35 + Math.sin(G.clock * 3) * 0.25;
  }

  G.dayNight.update(dt);
  const wasNight = G.lastNight;
  G.lastNight = G.dayNight.isNight;
  if (wasNight !== undefined && wasNight !== G.lastNight) {
    G.dialog.say([G.lastNight ? G.buuLines.night : G.buuLines.morning]);
  }
  // Room light when inside a house
  const house = houseAt(p.pos.x, p.pos.z);
  if (house) {
    G.roomLight.position.set(house.x, 2.6, house.z);
    G.roomLight.intensity = 3 + 5 * (1 - G.dayNight.light);
  } else G.roomLight.intensity = 0;

  G.headmaster.update(dt);
  G.quest.update(dt);

  const t = frozen ? null : lookTarget();
  const hint = hintFor(t);
  $('hint').textContent = hint;
  $('hint').hidden = !hint;
  G.lookingAt = t;
}

function updateBuu(dt) {
  const b = G.buuBody, p = G.player.pos;
  const dx = p.x - b.pos.x, dz = p.z - b.pos.z;
  const dist = Math.hypot(dx, dz);
  const want = CONFIG.buuFollowDistance;
  let moving = false;
  if (dist > 20) {
    placeBuuBehind();
  } else if (dist > want + 0.4) {
    const speed = Math.min(CONFIG.runSpeed * 1.1, (dist - want) * 2.5 + 1.5);
    b.vel.x = dx / dist * speed;
    b.vel.z = dz / dist * speed;
    moving = true;
  } else {
    b.vel.x = 0; b.vel.z = 0;
  }
  const before = b.pos.clone();
  G.world.moveBody(b, dt, CONFIG.gravity);
  // Blocked by a wall: hop, and teleport if stuck for long.
  if (moving && before.distanceTo(b.pos) < 0.5 * dt) {
    if (b.onGround) b.vel.y = CONFIG.jumpSpeed * 0.8;
    G.buuStuck += dt;
    if (G.buuStuck > 2 && dist > want + 1.5) { placeBuuBehind(); G.buuStuck = 0; }
  } else G.buuStuck = 0;
  G.buu.group.position.copy(b.pos);
  G.buu.faceToward(p.x, p.z);
  G.buu.animate(dt, moving, G.clock);
}

init().catch(err => {
  console.error(err);
  $('start').querySelector('.loading').textContent = `Error: ${err.message}`;
});
