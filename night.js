import * as THREE from 'three';
import { CONFIG } from './config.js';
import { HOUSES, GATE_SPAWN } from './world.js';
import { Human } from './npc.js';

const DAY_SKY = new THREE.Color(0x8ccff0);
const NIGHT_SKY = new THREE.Color(0x0b1026);

// Day: CONFIG.dayLengthSec, then night: CONFIG.nightLengthSec.
export class DayNight {
  constructor(scene, hemi, sun) {
    this.scene = scene; this.hemi = hemi; this.sun = sun;
    this.t = 0;
    this.light = 1;
    const pts = [];
    for (let i = 0; i < 400; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) + 0.05;
      pts.push(v.normalize().multiplyScalar(180));
    }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0 }));
    scene.add(this.stars);
  }

  get cycle() { return CONFIG.dayLengthSec + CONFIG.nightLengthSec; }
  get isNight() { return this.t >= CONFIG.dayLengthSec; }

  update(dt) {
    this.t = (this.t + dt) % this.cycle;
    const fade = 8;
    const d = CONFIG.dayLengthSec;
    let light;
    if (this.t < fade) light = this.t / fade;                     // dawn
    else if (this.t < d - fade) light = 1;
    else if (this.t < d) light = (d - this.t) / fade;             // dusk
    else light = 0;
    // Start of the game is full day.
    if (this.firstDay !== false && this.t < fade) light = 1;
    if (this.t >= fade) this.firstDay = false;
    this.light = light;
    const sky = NIGHT_SKY.clone().lerp(DAY_SKY, light);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    this.hemi.intensity = 0.25 + 0.75 * light;
    this.sun.intensity = 0.1 + 0.9 * light;
    this.stars.material.opacity = 1 - light;
  }
}

const PATROL_ORDER = ['h2', 'h5', 'h3', 'h6', 'h1', 'h4'];
const LINES = [
  'Children must sleep at night. Go home.',
  'It is too late to walk around. Go home.',
  'I see you. Back to the gate, please.',
  'The village is closed at night. Go home.',
];
const DAY_SPOT = { x: 5.5, z: 25.5 };

// Headmaster Batsaikhan Erdene: patrols houses at night.
export class Headmaster {
  constructor(G) {
    this.G = G;
    this.npc = new Human({ id: 'headmaster', name: 'Batsaikhan Erdene', shirt: 0x2b2f3a, pants: 0x1c1f26, hair: 0x9a9a9a });
    this.lantern = new THREE.PointLight(0xffc870, 0, 9);
    this.lantern.position.set(0.45, 1.0, 0.35);
    this.npc.group.add(this.lantern);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.18), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    lamp.position.copy(this.lantern.position);
    this.npc.group.add(lamp);
    G.scene.add(this.npc.group);

    this.patrolCount = 3;
    this.catches = [];         // times (G.clock) when the player was caught
    this.lastChange = 0;       // last time the patrol got bigger (or last catch)
    this.easy = false;
    this.wp = 0;
    this.wait = 0;
    this.cooldown = 0;
    this.wasNight = false;
    this.toDaySpot();
    this.buildRoute();
  }

  get speed() { return this.easy ? 1.4 : 2.2; }
  get sight() { return this.easy ? 5 : 9; }

  toDaySpot() {
    this.npc.group.position.set(DAY_SPOT.x, 0, DAY_SPOT.z);
    this.npc.faceToward(0, 0);
  }

  buildRoute() {
    this.route = [];
    for (const id of PATROL_ORDER.slice(0, this.patrolCount)) {
      const h = HOUSES.find(x => x.id === id);
      this.route.push({ x: 0, z: h.front.z }, { x: h.front.x, z: h.front.z, wait: 2 }, { x: 0, z: h.front.z });
    }
    this.wp %= this.route.length;
  }

  adapt() {
    const now = this.G.clock;
    // Caught 3+ times in 5 minutes: slower and shorter sight.
    this.easy = this.catches.filter(t => now - t < 300).length >= 3;
    // 0 catches in 10 minutes: patrol one more house.
    if (now - this.lastChange >= 600) {
      this.lastChange = now;
      if (this.patrolCount < 6) { this.patrolCount++; this.buildRoute(); }
    }
  }

  update(dt) {
    const G = this.G;
    const night = G.dayNight.isNight;
    this.adapt();
    this.lantern.intensity = night ? 2.5 : 0;
    if (night !== this.wasNight) {
      this.wasNight = night;
      if (!night) this.toDaySpot();
      else { this.wp = 0; this.npc.group.position.set(0, 0, 24); }
    }
    if (this.cooldown > 0) this.cooldown -= dt;
    if (!night) { this.npc.animate(dt, false, G.clock); return; }

    // Walk the route.
    const p = this.npc.group.position;
    let moving = false;
    if (this.wait > 0) this.wait -= dt;
    else {
      const t = this.route[this.wp];
      const dx = t.x - p.x, dz = t.z - p.z;
      const dist = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (dist <= step) {
        p.x = t.x; p.z = t.z;
        this.wait = t.wait || 0;
        this.wp = (this.wp + 1) % this.route.length;
      } else {
        p.x += dx / dist * step; p.z += dz / dist * step;
        this.npc.group.rotation.y = Math.atan2(dx, dz);
        moving = true;
      }
    }
    this.npc.animate(dt, moving, G.clock);

    if (this.cooldown <= 0 && !G.dialog.open && !G.picker.isOpen && this.sees(G.player.pos)) this.catchPlayer();
  }

  sees(pp) {
    const p = this.npc.group.position;
    const dx = pp.x - p.x, dz = pp.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.sight) return false;
    const yaw = this.npc.group.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (dist > 1.2 && (dx * fx + dz * fz) / dist < Math.cos(THREE.MathUtils.degToRad(50))) return false;
    return this.G.world.lineOfSight(new THREE.Vector3(p.x, 1.7, p.z), new THREE.Vector3(pp.x, pp.y + 1.5, pp.z));
  }

  catchPlayer() {
    const G = this.G;
    this.catches.push(G.clock);
    this.lastChange = G.clock;
    this.cooldown = 4;
    const line = LINES[(this.catches.length - 1) % LINES.length];
    G.teleportPlayer(GATE_SPAWN);
    G.dialog.say([['Batsaikhan Erdene', line]]);
  }
}
