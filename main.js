import * as THREE from 'three';
import { CONFIG } from './config.js';
import { World, HOUSES, GATE_SPAWN } from './world.js';
import { Human, Panda } from './npc.js';
import { Dialog } from './dialog.js';
import { Picker, renderBook } from './ui.js';
import { Learner } from './learn.js';
import { QuestRunner } from './quest.js';
import { DayNight, Headmaster } from './night.js';
import { loadSave, writeSave } from './save.js';
import { spokenLog } from './tts.js';
import { parseDate } from './dates.js';

const $ = id => document.getElementById(id);
const SHIRTS = { batbayar: 0x5a5f6b, dulamsuren: 0xf2f2f2, oyunaa: 0xe86aa6, enkhjargal: 0x6f8f3a, tsetseg: 0x3b6fd6, ganbold: 0x2f9c9c };
const SMALL_TALK = {
  blacksmith: ['Iron is heavy. Fire is hot.', 'My hammer is old.'],
  baker: ['The oven is hot today.', 'I bake bread every morning.'],
  student: ['I like my teacher.', 'Buu is a silly panda.'],
  farmer: ['The wheat is tall this year.', 'My horse eats carrots.'],
  teacher: ['A week has seven days.', 'Read every day.'],
  fisherman: ['The lake is quiet today.', 'I caught three fish.'],
};

async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Cannot load ${path}`);
  return r.json();
}

const G = window.game = {
  started: false,
  paused: false,
  clock: 0,
};

async function init() {
  const [villagers, quests, words, letters] = await Promise.all(
    ['villagers.json', 'quests.json', 'words.json', 'letters.json'].map(loadJSON));
  G.villagerList = villagers;
  G.villagerData = Object.fromEntries(villagers.map(v => [v.id, v]));
  G.quests = quests;
  G.letters = Object.fromEntries(letters.map(l => [l.house, l.lines]));

  // Save data
  G.state = Object.assign({ questsDone: 0, met: [], items: [], lettersRead: [], introDone: false }, loadSave());
  G.persist = () => writeSave(G.state);
  G.learner = new Learner(words, G.state, G.persist);

  // Renderer and scene
  const canvas = $('view');
  const renderer = G.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  const scene = G.scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8ccff0, 30, 90);
  const camera = G.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 400);
  camera.rotation.order = 'YXZ';
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(30, 60, 20);
  scene.add(hemi, sun);
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
  for (const v of villagers) world.addSign(G.houseById[v.house], v.name);
  G.dayNight = new DayNight(scene, hemi, sun);

  // Player
  G.player = { pos: new THREE.Vector3(GATE_SPAWN.x, GATE_SPAWN.y, GATE_SPAWN.z), vel: new THREE.Vector3(), r: 0.3, h: 1.7, onGround: false };
  G.yaw = GATE_SPAWN.yaw; G.pitch = 0;

  // Villagers stand next to their door.
  G.villagers = {};
  for (const v of villagers) {
    const h = G.houseById[v.house];
    const npc = new Human({ id: v.id, name: v.name, shirt: SHIRTS[v.id] || 0x888888 });
    npc.group.position.set(h.front.x, 0, h.cz + 2.5);
    npc.faceToward(0, h.cz + 2.5);
    scene.add(npc.group);
    G.villagers[v.id] = npc;
  }

  // Buu
  const buu = G.buu = new Panda();
  G.buuBody = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.45, h: 1.2, onGround: false };
  G.buuBody.pos.set(1.5, 0, GATE_SPAWN.z + CONFIG.buuFollowDistance);
  buu.group.position.copy(G.buuBody.pos);
  scene.add(buu.group);
  G.buuStuck = 0;

  G.headmaster = new Headmaster(G);

  // UI
  G.dialog = new Dialog($('dialog'));
  G.picker = new Picker($('picker'));
  G.bookEl = $('book');
  G.quest = new QuestRunner(G);
  G.spoken = spokenLog;

  // Interaction targets
  G.targets = [world.blockMesh, buu.hit, ...Object.values(G.villagers).map(n => n.hit), ...world.letters.map(l => l.mesh)];
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
  const v = G.villagerData[id];
  return [[v.name, `Hello. I am ${v.name}.`], [v.name, `I am a ${v.job}.`]];
};

G.teleportPlayer = spot => {
  G.player.pos.set(spot.x, spot.y, spot.z);
  G.player.vel.set(0, 0, 0);
  G.yaw = spot.yaw ?? G.yaw;
  G.pitch = 0;
  G.buuBody.pos.set(spot.x + 1.5, 0, spot.z + CONFIG.buuFollowDistance);
};

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
  addEventListener('keydown', e => onKey(e, canvas));
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
}

function onKey(e, canvas) {
  if (!G.started) return;
  const code = e.code;
  if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat && code !== 'KeyW' && code !== 'KeyA' && code !== 'KeyS' && code !== 'KeyD') return;

  if (code === 'Space' && G.dialog.open) { G.dialog.next(); return; }
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
    renderBook(G.bookEl, G.villagerList, G.state);
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
  const hit = G.raycaster.intersectObjects(G.targets, false)[0];
  return hit && hit.object.userData.kind ? hit.object.userData : null;
}

function hintFor(t) {
  if (!t) return '';
  if (t.kind === 'letter') return 'E to read';
  if (t.kind === 'villager' && G.quest.stage === 'take' && G.quest.q?.liar === t.id) return 'E to take';
  return 'E to talk';
}

function interact() {
  const t = lookTarget();
  if (!t) return;
  if (t.kind === 'buu') return G.quest.talkBuu();
  if (t.kind === 'letter') return readLetter(t.houseId);
  if (t.kind === 'villager') {
    if (G.quest.talkVillager(t.id)) return;
    const v = G.villagerData[t.id];
    const intro = G.meet(t.id);
    const talk = SMALL_TALK[v.job];
    const line = talk[Math.floor(Math.random() * talk.length)];
    G.dialog.say(intro.length ? intro : [[v.name, 'Hello again.'], [v.name, line]]);
  }
}

function readLetter(houseId) {
  if (!G.dayNight.isNight) {
    G.dialog.say([['Buu', 'Read it at night. Not now.']]);
    return;
  }
  if (!G.state.lettersRead.includes(houseId)) { G.state.lettersRead.push(houseId); G.persist(); }
  G.dialog.say(G.letters[houseId].map(t => ['Letter', t]));
}

// ---------- update ----------

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
  const sin = Math.sin(G.yaw), cos = Math.cos(G.yaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  p.vel.x = (fx * cos - fz * sin) / len * CONFIG.walkSpeed;
  p.vel.z = (-fx * sin - fz * cos) / len * CONFIG.walkSpeed;
  G.world.moveBody(p, dt, CONFIG.gravity);

  G.camera.position.set(p.pos.x, p.pos.y + 1.6, p.pos.z);
  G.camera.rotation.set(G.pitch, G.yaw, 0);

  updateBuu(dt);
  for (const npc of Object.values(G.villagers)) {
    if (npc.group.position.distanceTo(p.pos) < 6) npc.faceToward(p.pos.x, p.pos.z);
    npc.animate(dt, false, G.clock);
  }

  G.dayNight.update(dt);
  const wasNight = G.lastNight;
  G.lastNight = G.dayNight.isNight;
  if (wasNight !== undefined && wasNight !== G.lastNight) {
    G.dialog.say([['Buu', G.lastNight ? 'It is night now. Be quiet.' : 'Morning. The headmaster went home.']]);
  }
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
  if (dist > 16) {
    // Too far: appear behind the player.
    b.pos.set(p.x + Math.sin(G.yaw) * want, p.y, p.z + Math.cos(G.yaw) * want);
    if (G.world.collides(b.pos.x, b.pos.y, b.pos.z, b.r, b.h)) b.pos.set(p.x, p.y, p.z);
    b.vel.set(0, 0, 0);
  } else if (dist > want + 0.4) {
    const speed = Math.min(CONFIG.walkSpeed * 1.2, (dist - want) * 2.5 + 1.5);
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
    if (b.onGround) b.vel.y = CONFIG.jumpSpeed;
    G.buuStuck += dt;
    if (G.buuStuck > 2 && dist > want + 2) { b.pos.set(p.x, p.y, p.z); G.buuStuck = 0; }
  } else G.buuStuck = 0;
  G.buu.group.position.copy(b.pos);
  G.buu.faceToward(p.x, p.z);
  G.buu.animate(dt, moving, G.clock);
}

init().catch(err => {
  console.error(err);
  $('start').querySelector('.loading').textContent = `Error: ${err.message}`;
});
