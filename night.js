import * as THREE from 'three';
import { CONFIG } from './config.js';
import { HOUSES, GATE_SPAWN, SCHOOL } from './world.js';
import { Human } from './npc.js';

const DAY_TOP = new THREE.Color(0x3f7fd0), DAY_HORIZON = new THREE.Color(0xcfe6f5);
const DUSK_HORIZON = new THREE.Color(0xf0a060);
const NIGHT_TOP = new THREE.Color(0x05081a), NIGHT_HORIZON = new THREE.Color(0x1a2240);

// Day: CONFIG.dayLengthSec, then night: CONFIG.nightLengthSec.
export class DayNight {
  constructor(G) {
    this.G = G;
    this.t = 60; // start in the morning
    this.light = 1;
    const scene = G.scene;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: DAY_TOP.clone() }, horizon: { value: DAY_HORIZON.clone() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.6)), 1.0); }',
    }));
    scene.add(this.sky);
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }));
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe8ecf4, fog: false }));
    scene.add(this.sunDisc, this.moon);
    const pts = [];
    for (let i = 0; i < 700; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) + 0.05;
      pts.push(v.normalize().multiplyScalar(360));
    }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    scene.add(this.stars);
  }

  get cycle() { return CONFIG.dayLengthSec + CONFIG.nightLengthSec; }
  get isNight() { return this.t >= CONFIG.dayLengthSec; }

  update(dt) {
    const G = this.G;
    this.t = (this.t + dt) % this.cycle;
    const fade = 10, d = CONFIG.dayLengthSec;
    let light;
    if (this.t < fade) light = this.t / fade;
    else if (this.t < d - fade) light = 1;
    else if (this.t < d) light = (d - this.t) / fade;
    else light = 0;
    this.light = light;

    // Sun goes across the sky during the day. Moon at night.
    const dayPart = Math.min(1, this.t / d);
    const a = Math.PI * (0.15 + 0.7 * dayPart);
    const sunDir = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.9 + 0.1, -0.35).normalize();
    const p = G.player.pos;
    G.sun.position.copy(p).addScaledVector(sunDir, 80);
    G.sun.target.position.copy(p);
    G.sun.target.updateMatrixWorld();
    this.sunDisc.position.copy(G.camera.position).addScaledVector(sunDir, 340);
    this.moon.position.copy(G.camera.position).addScaledVector(new THREE.Vector3(-0.5, 0.6, 0.4).normalize(), 340);
    this.sky.position.copy(G.camera.position);
    this.stars.position.copy(G.camera.position);
    this.sunDisc.visible = light > 0.05;
    this.moon.visible = light < 0.6;

    const low = 1 - Math.min(1, Math.abs(dayPart - 0.5) * 2.2);  // 1 at noon
    const horizonDay = DUSK_HORIZON.clone().lerp(DAY_HORIZON, Math.min(1, low * 1.6));
    const top = NIGHT_TOP.clone().lerp(DAY_TOP, light);
    const horizon = NIGHT_HORIZON.clone().lerp(horizonDay, light);
    this.sky.material.uniforms.top.value.copy(top);
    this.sky.material.uniforms.horizon.value.copy(horizon);
    G.scene.fog.color.copy(horizon);
    G.hemi.intensity = 0.25 + 0.85 * light;
    G.hemi.color.set(0xb8c8ff).lerp(new THREE.Color(0xffffff), light);
    G.sun.intensity = 0.05 + 2.4 * light;
    G.sun.color.set(0xffd0a0).lerp(new THREE.Color(0xfff6e8), Math.min(1, low * 1.6));
    this.stars.material.opacity = 1 - light;
    G.world.setNight(1 - light);
  }
}

const PATROL_ORDER = ['h2', 'h5', 'h3', 'h6', 'h1', 'h4'];
const LINES = [
  'Children must sleep at night. Go home.',
  'It is too late to walk around. Go home.',
  'I see you. Back to the gate, please.',
  'The village is closed at night. Go home.',
];
const DAY_SPOT = { x: SCHOOL.x + 3, z: SCHOOL.z + SCHOOL.d / 2 + 2.5 };

// Headmaster Batsaikhan Erdene: patrols houses at night.
export class Headmaster {
  constructor(G) {
    this.G = G;
    this.npc = new Human({ id: 'headmaster', name: 'Batsaikhan Erdene', kind: 'headmaster', shirt: 0x2b2f3a, pants: 0x1c1f26,
      hair: 0x8a8a8a, skin: 0xcf9f7a, extras: ['glasses', 'mustache', 'tie', 'longSleeves'], scale: 1.08 });
    this.lantern = new THREE.PointLight(0xffc870, 0, 14, 1.5);
    this.lantern.position.set(0, -0.42, 0.12);
    this.npc.armR.el.add(this.lantern);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 10), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    lamp.position.copy(this.lantern.position);
    this.npc.armR.el.add(lamp);
    this.lamp = lamp;
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
      // Walk on the road beside the well (x = 1.8), then to the door.
      this.route.push({ x: 1.8, z: h.front.z }, { x: h.front.x, z: h.front.z, wait: 2 }, { x: 1.8, z: h.front.z });
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
    this.lantern.intensity = night ? 6 : 0;
    this.lamp.visible = night;
    if (night !== this.wasNight) {
      this.wasNight = night;
      if (!night) this.toDaySpot();
      else { this.wp = 0; this.npc.group.position.set(0, 0, SCHOOL.z + SCHOOL.d / 2 + 4); }
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
