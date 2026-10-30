import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TEX, textCanvasTexture } from './textures.js';

// Units are meters. Ground is at y = 0. The village is inside |x| < 57, -57 < z < 52.
export const BOUND = { minX: -56.5, maxX: 56.5, minZ: -56.5, maxZ: 51.5 };
export const GATE_SPAWN = { x: 0, y: 0, z: 48, yaw: 0 };

// Houses: front (door side) faces the main road.
// rot +90°: front faces +x (west side of the road). rot -90°: front faces -x.
const HOUSE_DEFS = [
  { id: 'h1', x: -14, z: 34, rot: 90, roof: 0x9e3b2c, wall: 0xe6dcc6, wp: [0xd9cfa9, 0xb79a6a], wp2: [0xc9d3c0, 0x8ea585] },
  { id: 'h2', x: -14, z: 18, rot: 90, roof: 0x34588c, wall: 0xf0e2c8, wp: [0xe8d6c0, 0xc08a6a], wp2: [0xd4cbe0, 0x9787b0] },
  { id: 'h3', x: -14, z: -18, rot: 90, roof: 0xc28a2a, wall: 0xe9e4d6, wp: [0xf0d8e0, 0xd08aa6], wp2: [0xd6e6f0, 0x86a6c0] },
  { id: 'h4', x: 14, z: 34, rot: -90, roof: 0x4a7a3a, wall: 0xe2d4b8, wp: [0xdcd3b0, 0x9c8a50], wp2: [0xe0d0c0, 0xa08060] },
  { id: 'h5', x: 14, z: 18, rot: -90, roof: 0x6a3f86, wall: 0xece6dc, wp: [0xd8e0d0, 0x90a888], wp2: [0xe8dcc8, 0xb09070] },
  { id: 'h6', x: 14, z: -18, rot: -90, roof: 0xb4561c, wall: 0xdcd6c8, wp: [0xc8d8e0, 0x6a90a8], wp2: [0xd8d0c0, 0x988870] },
];
const HW = 10, HD = 8, HH = 3;

function houseMatrix(h) {
  return new THREE.Matrix4().makeTranslation(h.x, 0, h.z).multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(h.rot)));
}
function toWorld(h, lx, ly, lz) { return new THREE.Vector3(lx, ly, lz).applyMatrix4(houseMatrix(h)); }

export const HOUSES = HOUSE_DEFS.map(d => {
  const h = { ...d };
  const door = toWorld(h, 0, 0, HD / 2);
  const front = toWorld(h, 0, 0, HD / 2 + 1.6);
  const stand = toWorld(h, 2.2, 0, HD / 2 + 1.6);
  h.door = { x: door.x, z: door.z };
  h.front = { x: front.x, z: front.z };
  h.villagerSpot = { x: stand.x, z: stand.z };
  h.road = { x: 0, z: h.z };
  return h;
});

export function houseAt(x, z) {
  return HOUSES.find(h => Math.abs(x - h.x) < HD / 2 && Math.abs(z - h.z) < HW / 2) || null;
}

export const SCHOOL = { x: 0, z: -40, w: 20, d: 12, h: 4 };
export const LAKE = { x: 40, z: -16, rx: 12, rz: 14 };
export const FARM = { x0: 28, x1: 50, z0: 22, z1: 44 };

// Lost things the player can find.
export const ITEMS = [
  { name: 'key', x: 1.6, y: 0, z: 1.2 },
  { name: 'cup', x: -7, y: 0.95, z: -7.2 },
  { name: 'shoe', x: 31, y: 0.35, z: -15.4 },
  { name: 'ball', x: 35, y: 0, z: 39.5 },
  { name: 'spoon', x: -3.6, y: 0.8, z: 21.6 },
  { name: 'book', x: -6, y: 0.78, z: -43.2 },
  { name: 'hat', x: 5.5, y: 0, z: 49.5 },
  { name: 'bell', x: -42, y: 0, z: -40 },
  { name: 'coin', x: 22, y: 0, z: 3 },
  { name: 'comb', room: 'h3', lx: 0.4, ly: 0.77, lz: -3.4 },
  { name: 'glove', x: -30, y: 0, z: 46 },
  { name: 'candle', room: 'h5', lx: -3.25, ly: 0.55, lz: -3.3 },
];

// ---------- materials ----------

const MAT = {};
function std(key, opts, uv = 0) {
  if (!MAT[key]) {
    const { map, ...rest } = opts;
    MAT[key] = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...(map ? { map } : {}), ...rest });
    MAT[key].userData.uvScale = uv;
  }
  return MAT[key];
}
const mats = {
  grass: () => std('grass', { map: TEX.grass() }, 3),
  dirt: () => std('dirt', { map: TEX.dirt() }, 3),
  sand: () => std('sand', { map: TEX.sand() }, 2),
  stone: () => std('stone', { map: TEX.stone() }, 2),
  planks: () => std('planks', { map: TEX.planks() }, 2),
  wood: () => std('wood', { map: TEX.planks(), color: 0xb08a68 }, 1.2),
  darkWood: () => std('darkWood', { map: TEX.planks(), color: 0x6a4a34 }, 1.2),
  plaster: c => std('plaster' + c, { map: TEX.plaster(c) }, 2.5),
  wallpaper: (a, b) => std(`wp${a}-${b}`, { map: TEX.wallpaper(a, b) }, 1.2),
  roof: c => std('roof' + c, { map: TEX.roof(c) }, 2),
  brick: () => std('brick', { map: TEX.brick() }, 1.5),
  bark: () => std('bark', { map: TEX.bark() }, 1),
  tile: () => std('tile', { map: TEX.tile() }, 1),
  white: () => std('white', { color: 0xf4f2ee, roughness: 0.5 }),
  ceiling: () => std('ceiling', { color: 0xece8e0 }),
  black: () => std('black', { color: 0x222222, roughness: 0.6 }),
  metal: () => std('metal', { color: 0x6c7078, roughness: 0.4, metalness: 0.7 }),
  gold: () => std('gold', { color: 0xd8a83a, roughness: 0.35, metalness: 0.8 }),
  glass: () => std('glass', { color: 0x9fc4d8, roughness: 0.1, metalness: 0.2, emissive: 0xffc070, emissiveIntensity: 0 }),
  lamp: () => std('lamp', { color: 0xfff0c0, emissive: 0xffd080, emissiveIntensity: 0.2 }),
  fire: () => std('fire', { color: 0xff8a2a, emissive: 0xff6a10, emissiveIntensity: 1.5 }),
  water: () => std('water', { color: 0x3f7fa8, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.85 }),
  leaf: () => std('leaf', { color: 0x4a8a3a, flatShading: true }),
  leaf2: () => std('leaf2', { color: 0x3a7432, flatShading: true }),
  pine: () => std('pine', { color: 0x2f5e34, flatShading: true }),
  rock: () => std('rock', { color: 0x8a867e, flatShading: true }),
  mountain: () => std('mountain', { color: 0x6f8a6a, flatShading: true }),
  snow: () => std('snow', { color: 0xf2f4f6, flatShading: true }),
  cloth: c => std('cloth' + c, { color: c, roughness: 1 }),
  checker: c => std('chk' + c, { map: TEX.checker(c) }, 0.4),
  rug: c => std('rug' + c, { map: TEX.rug(c) }),
  paper: () => std('paper', { color: 0xfaf6e8, side: THREE.DoubleSide }),
  hay: () => std('hay', { color: 0xd8b85a }),
  wheat: () => std('wheat', { color: 0xd9b84a, flatShading: true }),
  crop: () => std('crop', { color: 0x4f9a3a, flatShading: true }),
};
export { mats };

// World-space UVs so textures keep the same size on big and small boxes.
function worldUV(g, scale) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ---------- collision ----------

class Colliders {
  constructor() { this.boxes = []; this.grid = new Map(); this.cell = 4; }
  add(b) {
    this.boxes.push(b);
    const c = this.cell;
    for (let i = Math.floor(b.minX / c); i <= Math.floor(b.maxX / c); i++) {
      for (let k = Math.floor(b.minZ / c); k <= Math.floor(b.maxZ / c); k++) {
        const key = i * 1000 + k;
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(b);
      }
    }
  }
  near(x0, z0, x1, z1) {
    const c = this.cell, out = new Set();
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) {
      for (let k = Math.floor(z0 / c); k <= Math.floor(z1 / c); k++) {
        const list = this.grid.get(i * 1000 + k);
        if (list) for (const b of list) out.add(b);
      }
    }
    return out;
  }
}

// ---------- geometry builder ----------

const E = new THREE.Euler(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3();

class Builder {
  constructor(world) {
    this.world = world;
    this.buckets = new Map();
    this.parent = new THREE.Matrix4();
  }

  within(m, fn) {
    const prev = this.parent;
    this.parent = prev.clone().multiply(m);
    fn();
    this.parent = prev;
  }

  add(g, material, x, y, z, o = {}) {
    E.set(o.rx || 0, o.ry || 0, o.rz || 0);
    Q.setFromEuler(E);
    const sc = o.scale || [1, 1, 1];
    const local = new THREE.Matrix4().compose(V.set(x, y, z), Q, S.set(sc[0], sc[1], sc[2]));
    g.applyMatrix4(this.parent.clone().multiply(local));
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (material.userData.uvScale) worldUV(g, material.userData.uvScale);
    if (!this.buckets.has(material)) this.buckets.set(material, []);
    this.buckets.get(material).push(g);
    if (o.collide) {
      g.computeBoundingBox();
      const bb = g.boundingBox;
      this.world.colliders.add({ minX: bb.min.x, minY: bb.min.y, minZ: bb.min.z, maxX: bb.max.x, maxY: bb.max.y, maxZ: bb.max.z });
    }
    return g;
  }

  // Box standing on y (bottom), unless o.center.
  box(w, h, d, m, x, y, z, o = {}) {
    return this.add(new THREE.BoxGeometry(w, h, d), m, x, o.center ? y : y + h / 2, z, o);
  }
  cyl(rt, rb, h, seg, m, x, y, z, o = {}) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, o.center ? y : y + h / 2, z, o);
  }
  // Invisible collision box (bottom at y).
  solid(w, h, d, x, y, z) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(this.parent.clone().multiply(new THREE.Matrix4().makeTranslation(x, y + h / 2, z)));
    g.computeBoundingBox();
    const bb = g.boundingBox;
    this.world.colliders.add({ minX: bb.min.x, minY: bb.min.y, minZ: bb.min.z, maxX: bb.max.x, maxY: bb.max.y, maxZ: bb.max.z });
  }
  sphere(r, m, x, y, z, o = {}) {
    return this.add(new THREE.SphereGeometry(r, o.seg || 16, o.seg2 || 12), m, x, y, z, o);
  }

  flush(scene, { cast = true, receive = true } = {}) {
    for (const [material, geos] of this.buckets) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), material);
      mesh.castShadow = cast && !material.transparent;
      mesh.receiveShadow = receive;
      scene.add(mesh);
    }
    this.buckets.clear();
  }
}

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------- world ----------

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = new Colliders();
    this.letters = [];   // { mesh, houseId }
    this.calendars = []; // meshes
    this.items = [];     // { name, group, hit }
    this.reserved = [];  // rectangles with no trees
    this.b = new Builder(this);
  }

  reserve(x0, z0, x1, z1) { this.reserved.push([x0, z0, x1, z1]); }
  isReserved(x, z, pad = 0) {
    return this.reserved.some(([x0, z0, x1, z1]) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad);
  }

  build() {
    this.buildGround();
    for (const h of HOUSES) this.buildHouse(h);
    this.buildSchool();
    this.buildPlaza();
    this.buildLake();
    this.buildFarm();
    this.buildYards();
    this.buildGateAndFence();
    this.buildLamps();
    this.buildTrees();
    this.buildMountains();
    this.b.flush(this.scene);
    this.buildItems();
  }

  // ---- ground, roads ----
  buildGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mats.grass());
    ground.rotation.x = -Math.PI / 2;
    const uv = ground.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 200, uv.getY(i) * 200);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const strip = (x0, z0, x1, z1, m = mats.dirt(), y = 0.02) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      this.b.add(g, m, (x0 + x1) / 2, y, (z0 + z1) / 2, { rx: -Math.PI / 2 });
    };
    strip(-2.5, -34, 2.5, 70);                 // main road
    this.reserve(-3.5, -34, 3.5, 60);
    strip(-30, -1.8, 30, 1.8);                 // cross road
    this.reserve(-30, -2.5, 30, 2.5);
    strip(26, -1.8, 30, 1.8);
    for (const h of HOUSES) {                  // paths to doors
      const x0 = Math.min(h.door.x, 0), x1 = Math.max(h.door.x, 0);
      strip(x0, h.z - 0.9, x1, h.z + 0.9, mats.dirt(), 0.03);
    }
    const plaza = new THREE.CircleGeometry(10, 40);
    this.b.add(plaza, mats.stone(), 0, 0.045, 0, { rx: -Math.PI / 2 });
    this.reserve(-11, -11, 11, 11);
  }

  // ---- houses ----
  buildHouse(h) {
    const b = this.b;
    const wall = mats.plaster(h.wall), wpA = mats.wallpaper(...h.wp), wpB = mats.wallpaper(...h.wp2);
    const t = 0.2, W = HW, D = HD, H = HH;
    this.reserve(h.x - 6, h.z - 6.5, h.x + 6, h.z + 6.5);
    b.within(houseMatrix(h), () => {
      // Outer walls
      b.box(W, H, t, wall, 0, 0, -D / 2 + t / 2, { collide: true });
      b.box(t, H, D, wall, -W / 2 + t / 2, 0, 0, { collide: true });
      b.box(t, H, D, wall, W / 2 - t / 2, 0, 0, { collide: true });
      b.box(4.3, H, t, wall, -2.85, 0, D / 2 - t / 2, { collide: true });
      b.box(4.3, H, t, wall, 2.85, 0, D / 2 - t / 2, { collide: true });
      b.box(1.4, 0.8, t, wall, 0, 2.2, D / 2 - t / 2, { collide: true });
      // Inner wall between kitchen (front) and bedroom (back), doorway at x 2..3.2
      b.box(6.8, H, 0.15, wall, -1.4, 0, -0.5, { collide: true });
      b.box(1.6, H, 0.15, wall, 4.0, 0, -0.5, { collide: true });
      b.box(1.2, 0.8, 0.15, wall, 2.6, 2.2, -0.5, { collide: true });
      // Wallpaper linings
      const L = 0.02;
      b.box(L, H, 4.2, wpA, -4.79, 0, 1.69); b.box(L, H, 4.2, wpA, 4.79, 0, 1.69);
      b.box(6.8, H, L, wpA, -1.4, 0, -0.42); b.box(1.6, H, L, wpA, 4.0, 0, -0.42);
      b.box(4.1, H, L, wpA, -2.75, 0, 3.79); b.box(4.1, H, L, wpA, 2.75, 0, 3.79);
      b.box(L, H, 3.2, wpB, -4.79, 0, -2.2); b.box(L, H, 3.2, wpB, 4.79, 0, -2.2);
      b.box(9.6, H, L, wpB, 0, 0, -3.79);
      b.box(6.8, H, L, wpB, -1.4, 0, -0.58); b.box(1.6, H, L, wpB, 4.0, 0, -0.58);
      // Floors and ceiling
      b.box(9.6, 0.04, 4.2, mats.tile(), 0, 0, 1.69);
      b.box(9.6, 0.04, 3.2, mats.planks(), 0, 0, -2.2);
      b.box(W, 0.1, D, mats.ceiling(), 0, H, 0);
      // Roof
      const rise = 2.2, run = D / 2, over = 0.6;
      const len = Math.hypot(run + over, rise * (run + over) / run);
      const ang = Math.atan2(rise, run);
      const midZ = (run + over) / 2;
      const midY = H + rise - (rise * (run + over) / run) / 2;
      b.box(W + 1.2, 0.18, len, mats.roof(h.roof), 0, midY, midZ, { center: true, rx: ang });
      b.box(W + 1.2, 0.18, len, mats.roof(h.roof), 0, midY, -midZ, { center: true, rx: -ang });
      const gable = new THREE.Shape([new THREE.Vector2(-run, 0), new THREE.Vector2(run, 0), new THREE.Vector2(0, rise)]);
      for (const sx of [-1, 1]) {
        const g = new THREE.ExtrudeGeometry(gable, { depth: t, bevelEnabled: false });
        b.add(g, wall, sx * (W / 2) - (sx > 0 ? t : 0), H, 0, { ry: Math.PI / 2 });
      }
      b.box(0.7, 1.8, 0.7, mats.brick(), 2.8, H + 1.2, -1.6);
      // Windows: front and sides
      for (const x of [-3, 3]) this.window(x, 1.0, D / 2, 0, h.roof);
      this.window(-W / 2, 1.0, 1.7, -Math.PI / 2, h.roof);
      this.window(W / 2, 1.0, 1.7, Math.PI / 2, h.roof);
      this.window(-W / 2, 1.0, -2.2, -Math.PI / 2, h.roof);
      this.window(W / 2, 1.0, -2.2, Math.PI / 2, h.roof);
      // Open door leaf and step
      b.box(0.06, 2.15, 1.3, mats.darkWood(), -0.62, 0, D / 2 - 0.9);
      b.box(1.8, 0.1, 0.8, mats.stone(), 0, 0, D / 2 + 0.4);
      this.kitchen(h);
      this.bedroom(h);
    });
    // Name sign over the door (text is set later from villagers.json)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.55), new THREE.MeshStandardMaterial({ roughness: 0.8 }));
    sign.position.copy(toWorld(h, 0, 2.6, D / 2 + 0.03));
    sign.rotation.y = THREE.MathUtils.degToRad(h.rot);
    sign.name = `sign-${h.id}`;
    this.scene.add(sign);
    h.sign = sign;
  }

  setSignText(h, text) {
    h.sign.material.map = textCanvasTexture([text], { w: 640, h: 128, font: 'bold 60px Georgia, serif' });
    h.sign.material.needsUpdate = true;
  }

  window(x, y, z, ry, shutter) {
    const b = this.b;
    const m = new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(ry));
    b.within(m, () => {
      b.box(1.3, 1.2, 0.04, mats.glass(), 0, y, 0.02);
      b.box(1.3, 1.2, 0.03, mats.glass(), 0, y, -0.24);
      b.box(1.45, 0.08, 0.12, mats.white(), 0, y - 0.04, 0.06);
      b.box(1.45, 0.08, 0.12, mats.white(), 0, y + 1.2, 0.06);
      b.box(0.08, 1.2, 0.12, mats.white(), -0.68, y, 0.06);
      b.box(0.08, 1.2, 0.12, mats.white(), 0.68, y, 0.06);
      b.box(0.06, 1.2, 0.06, mats.white(), 0, y, 0.05);
      b.box(1.3, 0.06, 0.06, mats.white(), 0, y + 0.6, 0.05);
      b.box(0.55, 1.3, 0.05, mats.cloth(shutter), -1.0, y - 0.05, 0.05);
      b.box(0.55, 1.3, 0.05, mats.cloth(shutter), 1.0, y - 0.05, 0.05);
    });
  }

  kitchen(h) {
    const b = this.b;
    // Table with checked cloth, like a real kitchen.
    b.box(1.6, 0.05, 0.95, mats.wood(), -2.0, 0.72, 1.7);
    for (const [dx, dz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) b.box(0.07, 0.72, 0.07, mats.wood(), -2.0 + dx, 0, 1.7 + dz);
    b.box(1.75, 0.01, 1.1, mats.checker(0x3a6ab0), -2.0, 0.77, 1.7);
    b.solid(1.6, 0.78, 0.95, -2.0, 0, 1.7);
    for (const z of [0.85, 2.55]) this.chair(-2.0, z, z < 1.7 ? 0 : Math.PI);
    // Cabinets along the inner wall
    b.box(3.6, 0.88, 0.6, mats.wood(), -2.8, 0, -0.12, { collide: true });
    b.box(3.7, 0.05, 0.64, mats.stone(), -2.8, 0.88, -0.12);
    b.box(3.6, 0.7, 0.35, mats.wood(), -2.8, 1.6, -0.25);
    for (let i = 0; i < 4; i++) b.box(0.04, 0.12, 0.02, mats.metal(), -4.3 + i * 1.0, 0.6, 0.19);
    // Stove with a pot
    b.box(0.75, 0.9, 0.65, mats.white(), 4.35, 0, 2.6, { collide: true });
    b.box(0.6, 0.02, 0.5, mats.black(), 4.35, 0.9, 2.6);
    b.cyl(0.16, 0.16, 0.2, 14, mats.metal(), 4.3, 0.92, 2.5);
    b.box(0.6, 0.35, 0.02, mats.black(), 4.35, 0.25, 2.27);
    // Fridge
    b.box(0.7, 1.8, 0.7, mats.white(), 4.35, 0, 0.1, { collide: true });
    // Rug and pendant lamp
    b.box(2.4, 0.01, 1.8, mats.rug(0x8a3a2a), -2.0, 0.05, 1.7);
    b.cyl(0.01, 0.01, 0.6, 4, mats.black(), -2.0, 2.4, 1.7);
    b.cyl(0.08, 0.3, 0.25, 16, mats.darkWood(), -2.0, 2.2, 1.7);
    b.sphere(0.08, mats.lamp(), -2.0, 2.22, 1.7);
    // Picture on the left wall
    b.box(0.03, 0.6, 0.8, mats.darkWood(), -4.77, 1.4, 2.6);
    b.box(0.02, 0.5, 0.7, mats.cloth(0x6a8aa8), -4.75, 1.45, 2.6);
    // Letter on the table
    const letter = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.24), mats.paper());
    letter.rotation.set(-Math.PI / 2, 0, 0.3);
    letter.position.copy(toWorld(h, -1.6, 0.785, 1.55));
    letter.rotation.z += THREE.MathUtils.degToRad(h.rot);
    letter.userData = { kind: 'letter', houseId: h.id };
    letter.castShadow = false;
    this.scene.add(letter);
    this.letters.push({ mesh: letter, houseId: h.id });
    // Wall calendar
    const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ map: calendarTexture(), roughness: 0.9 }));
    cal.position.copy(toWorld(h, 0.9, 1.6, -0.405));
    cal.rotation.y = THREE.MathUtils.degToRad(h.rot);
    cal.userData = { kind: 'calendar' };
    this.scene.add(cal);
    this.calendars.push(cal);
  }

  chair(x, z, ry) {
    const b = this.b;
    const m = new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(ry));
    b.within(m, () => {
      b.box(0.45, 0.05, 0.45, mats.wood(), 0, 0.45, 0);
      for (const [dx, dz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) b.box(0.04, 0.45, 0.04, mats.wood(), dx, 0, dz);
      b.box(0.45, 0.5, 0.04, mats.wood(), 0, 0.5, -0.21);
      b.box(0.3, 0.25, 0.02, mats.cloth(0x6a90b0), 0, 0.62, -0.19);
    });
  }

  bedroom(h) {
    const b = this.b;
    b.box(1.1, 0.4, 2.0, mats.darkWood(), -4.15, 0, -2.6, { collide: true });
    b.box(1.05, 0.15, 1.95, mats.white(), -4.15, 0.4, -2.6);
    b.box(1.07, 0.06, 1.3, mats.cloth(h.roof), -4.15, 0.55, -2.25);
    b.box(0.7, 0.12, 0.35, mats.white(), -4.15, 0.56, -3.35);
    b.box(1.1, 0.9, 0.08, mats.darkWood(), -4.15, 0, -3.62);
    b.box(1.2, 2.0, 0.6, mats.darkWood(), 3.9, 0, -3.45, { collide: true });
    b.box(0.02, 1.8, 0.01, mats.black(), 3.9, 0.1, -3.14);
    b.box(0.45, 0.55, 0.4, mats.wood(), -3.25, 0, -3.45, { collide: true });
    b.cyl(0.05, 0.08, 0.25, 10, mats.metal(), -3.25, 0.55, -3.5);
    b.cyl(0.12, 0.18, 0.18, 12, mats.lamp(), -3.25, 0.8, -3.5);
    b.box(1.2, 0.05, 0.6, mats.wood(), 0.6, 0.74, -3.4);
    for (const [dx, dz] of [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]]) b.box(0.05, 0.74, 0.05, mats.wood(), 0.6 + dx, 0, -3.4 + dz);
    this.chair(0.6, -2.7, Math.PI);
    b.box(2.0, 0.01, 1.4, mats.rug(0x2a5a7a), -1.2, 0.05, -2.2);
    b.box(0.6, 0.8, 0.03, mats.darkWood(), -1.5, 1.3, -3.77);
    b.box(0.5, 0.7, 0.02, mats.cloth(0xb8a070), -1.5, 1.35, -3.75);
  }

  // ---- school ----
  buildSchool() {
    const b = this.b, s = SCHOOL, t = 0.25;
    const W = s.w, D = s.d, H = s.h;
    this.reserve(s.x - W / 2 - 2, s.z - D / 2 - 2, s.x + W / 2 + 2, s.z + D / 2 + 3);
    b.within(new THREE.Matrix4().makeTranslation(s.x, 0, s.z), () => {
      const wall = mats.brick();
      b.box(W, H, t, wall, 0, 0, -D / 2 + t / 2, { collide: true });
      b.box(t, H, D, wall, -W / 2 + t / 2, 0, 0, { collide: true });
      b.box(t, H, D, wall, W / 2 - t / 2, 0, 0, { collide: true });
      b.box(W / 2 - 1, H, t, wall, -(W / 4 + 0.5), 0, D / 2 - t / 2, { collide: true });
      b.box(W / 2 - 1, H, t, wall, W / 4 + 0.5, 0, D / 2 - t / 2, { collide: true });
      b.box(2, H - 2.6, t, wall, 0, 2.6, D / 2 - t / 2, { collide: true });
      b.box(W - 0.5, 0.04, D - 0.5, mats.planks(), 0, 0, 0);
      b.box(W, 0.12, D, mats.ceiling(), 0, H, 0);
      const pw = mats.plaster(0xd8e2d0);
      b.box(W - 0.6, 2.2, 0.02, pw, 0, 0, -D / 2 + t + 0.01);
      // Roof
      const rise = 2.6, run = D / 2, over = 0.7;
      const len = Math.hypot(run + over, rise * (run + over) / run);
      const ang = Math.atan2(rise, run);
      const midZ = (run + over) / 2, midY = H + rise - (rise * (run + over) / run) / 2;
      b.box(W + 1.4, 0.2, len, mats.roof(0x5a5f6a), 0, midY, midZ, { center: true, rx: ang });
      b.box(W + 1.4, 0.2, len, mats.roof(0x5a5f6a), 0, midY, -midZ, { center: true, rx: -ang });
      const gable = new THREE.Shape([new THREE.Vector2(-run, 0), new THREE.Vector2(run, 0), new THREE.Vector2(0, rise)]);
      for (const sx of [-1, 1]) b.add(new THREE.ExtrudeGeometry(gable, { depth: t, bevelEnabled: false }), wall, sx * W / 2 - (sx > 0 ? t : 0), H, 0, { ry: Math.PI / 2 });
      for (const x of [-7, -4, 4, 7]) this.window(x, 1.2, D / 2, 0, 0x3a4a5a);
      for (const x of [-7, -3, 3, 7]) this.window(x, 1.2, -D / 2, Math.PI, 0x3a4a5a);
      // Classroom: blackboard, desks, teacher desk
      b.box(5, 1.6, 0.06, mats.black(), 0, 1.0, -D / 2 + t + 0.03);
      b.box(5.2, 0.08, 0.15, mats.wood(), 0, 0.95, -D / 2 + t + 0.08);
      b.box(1.8, 0.78, 0.8, mats.darkWood(), -6, 0, -3.2, { collide: true });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        const x = -4.5 + c * 3, z = -1 + r * 2.2;
        b.box(1.0, 0.05, 0.55, mats.wood(), x, 0.7, z);
        b.box(0.9, 0.7, 0.04, mats.wood(), x, 0, z - 0.25, { collide: true });
        this.chair(x, z + 0.6, Math.PI);
      }
      b.box(2.6, 0.12, 1.2, mats.stone(), 0, 0, D / 2 + 0.6);
      b.box(0.3, 3.2, 0.3, mats.white(), -1.4, 0, D / 2 + 0.8, { collide: true });
      b.box(0.3, 3.2, 0.3, mats.white(), 1.4, 0, D / 2 + 0.8, { collide: true });
      b.box(3.4, 0.25, 1.3, mats.white(), 0, 3.2, D / 2 + 0.5);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.3),
      new THREE.MeshStandardMaterial({ map: textCanvasTexture(['Monday  Tuesday  Wednesday', 'Thursday  Friday  Saturday  Sunday'], { w: 1024, h: 288, bg: '#26332b', fg: '#f2f2ea', border: '#26332b', font: '48px "Comic Sans MS", cursive' }) }));
    board.position.set(s.x, 1.82, s.z - D / 2 + t + 0.07);
    this.scene.add(board);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.45), new THREE.MeshStandardMaterial({ map: textCanvasTexture(['SCHOOL'], { w: 512, h: 96 }) }));
    sign.position.set(s.x, 3.75, s.z + D / 2 + 0.02);
    this.scene.add(sign);
  }

  // ---- plaza: well, stalls, benches ----
  buildPlaza() {
    const b = this.b;
    b.cyl(1.2, 1.3, 0.9, 20, mats.stone(), 0, 0, 0, { collide: true });
    b.cyl(0.95, 0.95, 0.02, 20, mats.water(), 0, 0.75, 0);
    for (const x of [-1.1, 1.1]) b.box(0.15, 2.4, 0.15, mats.darkWood(), x, 0.9, 0);
    b.box(2.6, 0.12, 1.4, mats.roof(0x7a3a2a), 0, 3.0, 0.45, { rx: 0.45, center: true });
    b.box(2.6, 0.12, 1.4, mats.roof(0x7a3a2a), 0, 3.0, -0.45, { rx: -0.45, center: true });
    b.cyl(0.05, 0.05, 2.2, 8, mats.wood(), 0, 2.4, 0, { rz: Math.PI / 2, center: true });
    b.cyl(0.18, 0.15, 0.3, 12, mats.darkWood(), 0.3, 1.6, 0);
    const stalls = [[-7, -6.5, 0xc0392b], [7, -6.5, 0x2a7ab0], [-7, 6.5, 0x2f8a4a], [7, 6.5, 0xd4a020]];
    for (const [x, z, c] of stalls) {
      const face = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      b.within(new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(face)), () => {
        b.box(3, 0.95, 1.0, mats.wood(), 0, 0, 0, { collide: true });
        for (const dx of [-1.4, 1.4]) for (const dz of [-0.45, 0.45]) b.box(0.1, 2.5, 0.1, mats.darkWood(), dx, 0, dz);
        for (let i = 0; i < 6; i++) b.box(0.5, 0.06, 1.6, mats.cloth(i % 2 ? 0xf2f2ea : c), -1.25 + i * 0.5, 2.55, 0.1, { rx: -0.25 });
        for (let i = 0; i < 7; i++) b.sphere(0.1, mats.cloth([0xc8302a, 0xe0a020, 0x6aa03a][i % 3]), -1.2 + i * 0.4, 1.05, 0.15 * ((i % 2) - 0.5));
        b.box(0.5, 0.4, 0.5, mats.wood(), -1.6, 0, -0.9, { collide: true });
      });
    }
    for (const [x, z, ry] of [[-5, 9.5, 0], [5, 9.5, 0], [-5, -9.5, Math.PI], [5, -9.5, Math.PI]]) {
      b.within(new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(ry)), () => {
        b.box(1.8, 0.06, 0.45, mats.wood(), 0, 0.45, 0);
        b.box(1.8, 0.4, 0.05, mats.wood(), 0, 0.55, 0.22);
        for (const dx of [-0.8, 0.8]) b.box(0.08, 0.45, 0.4, mats.metal(), dx, 0, 0);
      });
    }
  }

  // ---- lake with a dock ----
  buildLake() {
    const b = this.b, L = LAKE;
    const sand = new THREE.CircleGeometry(1, 48);
    b.add(sand, mats.sand(), L.x, 0.015, L.z, { rx: -Math.PI / 2, scale: [L.rx + 2.5, L.rz + 2.5, 1] });
    const water = new THREE.CircleGeometry(1, 48);
    b.add(water, mats.water(), L.x, 0.06, L.z, { rx: -Math.PI / 2, scale: [L.rx, L.rz, 1] });
    this.reserve(L.x - L.rx - 3, L.z - L.rz - 3, L.x + L.rx + 3, L.z + L.rz + 3);
    // Dock from the west shore
    const dz = L.z;
    const dx = L.x - L.rx + 3;
    b.box(9, 0.12, 2, mats.planks(), dx, 0.23, dz);
    b.solid(9, 0.35, 2, dx, 0, dz);
    for (let i = 0; i < 5; i++) for (const s of [-0.9, 0.9]) b.cyl(0.1, 0.1, 1.3, 8, mats.darkWood(), dx - 4 + i * 2, -0.3, dz + s);
    // Rails on both sides and at the end
    for (const s of [-1, 1]) {
      b.box(9, 0.08, 0.08, mats.wood(), dx, 1.2, dz + s * 0.95);
      b.solid(9, 1.3, 0.1, dx, 0, dz + s * 1.0);
      b.solid(9, 1.5, 1.0, dx, 0, dz + s * 1.55);
    }
    b.box(0.08, 0.08, 2, mats.wood(), dx + 4.5, 1.2, dz);
    b.solid(0.1, 1.3, 2, dx + 4.55, 0, dz);
    // Boat
    b.box(2.6, 0.4, 1.0, mats.darkWood(), L.x - 2, 0.05, dz + 3);
    // Water blocks walking (except the dock).
    for (let x = L.x - L.rx; x < L.x + L.rx; x += 1.5) {
      for (let z = L.z - L.rz; z < L.z + L.rz; z += 1.5) {
        const cx = x + 0.75, cz = z + 0.75;
        if (((cx - L.x) / (L.rx - 0.6)) ** 2 + ((cz - L.z) / (L.rz - 0.6)) ** 2 > 1) continue;
        if (Math.abs(cz - dz) < 1.8 && cx < L.x - L.rx + 8) continue;
        this.colliders.add({ minX: x, minY: 0, minZ: z, maxX: x + 1.5, maxY: 1.5, maxZ: z + 1.5, water: true });
      }
    }
    // Fish drying rack
    b.within(new THREE.Matrix4().makeTranslation(L.x - L.rx - 4, 0, L.z + 6), () => {
      for (const x of [-1, 1]) b.box(0.1, 1.8, 0.1, mats.darkWood(), x, 0, 0);
      b.cyl(0.04, 0.04, 2.1, 6, mats.wood(), 0, 1.7, 0, { rz: Math.PI / 2, center: true });
      for (let i = 0; i < 5; i++) b.sphere(0.12, mats.metal(), -0.8 + i * 0.4, 1.45, 0, { scale: [0.5, 1.6, 0.3] });
    });
  }

  // ---- farm ----
  buildFarm() {
    const b = this.b, F = FARM;
    this.reserve(F.x0 - 1, F.z0 - 1, F.x1 + 1, F.z1 + 1);
    const soil = new THREE.PlaneGeometry(F.x1 - F.x0 - 2, F.z1 - F.z0 - 2);
    b.add(soil, mats.dirt(), (F.x0 + F.x1) / 2, 0.02, (F.z0 + F.z1) / 2, { rx: -Math.PI / 2 });
    const rail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      b.box(0.08, 0.1, len, mats.wood(), mx, 0.5, mz, { ry });
      b.box(0.08, 0.1, len, mats.wood(), mx, 0.95, mz, { ry });
      this.colliders.add({ minX: Math.min(x0, x1) - 0.1, minY: 0, minZ: Math.min(z0, z1) - 0.1, maxX: Math.max(x0, x1) + 0.1, maxY: 1.1, maxZ: Math.max(z0, z1) + 0.1 });
      for (let i = 0; i <= Math.round(len / 2); i++) {
        const t = i / Math.max(1, Math.round(len / 2));
        b.box(0.14, 1.15, 0.14, mats.darkWood(), x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t);
      }
    };
    rail(F.x0, F.z0, F.x1, F.z0); rail(F.x0, F.z1, F.x1, F.z1); rail(F.x1, F.z0, F.x1, F.z1);
    rail(F.x0, F.z0, F.x0, 31); rail(F.x0, 35, F.x0, F.z1);
    // Crops: wheat rows and cabbages
    const wheat = [], cabbage = [];
    for (let x = F.x0 + 2; x < F.x1 - 1; x += 1.2) {
      for (let z = F.z0 + 2; z < F.z1 - 1; z += 0.8) {
        if (x > 33 && x < 39 && z > 38) continue;
        (x < 40 ? wheat : cabbage).push([x, z]);
      }
    }
    this.instanced(new THREE.ConeGeometry(0.18, 0.9, 5), mats.wheat(), wheat.map(([x, z]) => [x, 0.45, z, 1]));
    this.instanced(new THREE.IcosahedronGeometry(0.28, 0), mats.crop(), cabbage.map(([x, z]) => [x, 0.22, z, 1]));
    // Scarecrow and hay
    b.within(new THREE.Matrix4().makeTranslation(36, 0, 41), () => {
      b.box(0.1, 2.0, 0.1, mats.darkWood(), 0, 0, 0);
      b.box(1.4, 0.08, 0.08, mats.darkWood(), 0, 1.45, 0);
      b.box(0.5, 0.6, 0.3, mats.cloth(0x7a5a3a), 0, 1.15, 0);
      b.sphere(0.2, mats.hay(), 0, 1.95, 0);
      b.cyl(0.35, 0.35, 0.04, 14, mats.hay(), 0, 2.08, 0);
      b.cyl(0.18, 0.2, 0.25, 14, mats.hay(), 0, 2.1, 0);
    });
    for (const [x, z] of [[25, 38], [25, 40], [24.6, 39]]) b.cyl(0.6, 0.6, 1.0, 16, mats.hay(), x, 0.6, z, { collide: true, rx: Math.PI / 2, center: true });
    // Barn
    b.within(new THREE.Matrix4().makeTranslation(46, 0, 50 - 3.5), () => {
      b.box(7, 3.5, 4, mats.plaster(0xa8442e), 0, 0, 0, { collide: true });
      b.box(7.6, 0.2, 2.6, mats.roof(0x5a3a2a), 0, 4.2, 1.0, { center: true, rx: 0.6 });
      b.box(7.6, 0.2, 2.6, mats.roof(0x5a3a2a), 0, 4.2, -1.0, { center: true, rx: -0.6 });
    });
  }

  // ---- job props next to houses ----
  buildYards() {
    const b = this.b;
    const h1 = HOUSES[0], h2 = HOUSES[1];
    // Blacksmith forge
    b.within(new THREE.Matrix4().makeTranslation(h1.x + 9, 0, h1.z + 3.8), () => {
      b.box(0.8, 0.5, 0.4, mats.metal(), 0, 0.35, 0, { collide: true });
      b.box(0.5, 0.35, 0.3, mats.darkWood(), 0, 0, 0);
      b.box(1.4, 1.0, 1.2, mats.brick(), -1.6, 0, 0.6, { collide: true });
      b.box(1.0, 0.1, 0.8, mats.fire(), -1.6, 1.0, 0.6);
      b.box(0.6, 2.2, 0.6, mats.brick(), -1.6, 1.0, 1.0);
      b.cyl(0.3, 0.3, 0.8, 12, mats.darkWood(), 1.4, 0, -0.6, { collide: true });
    });
    // Bread oven
    b.within(new THREE.Matrix4().makeTranslation(h2.x + 9, 0, h2.z + 3.8), () => {
      b.box(1.8, 0.7, 1.6, mats.stone(), 0, 0, 0, { collide: true });
      b.sphere(0.85, mats.brick(), 0, 0.7, 0, { scale: [1, 0.8, 0.9], seg: 14, seg2: 8 });
      b.box(0.5, 0.4, 0.05, mats.black(), 0, 0.8, 0.76);
      b.box(1.2, 0.05, 0.6, mats.wood(), 1.6, 0.75, 0);
      for (const dx of [-0.5, 0.5]) b.box(0.06, 0.75, 0.5, mats.wood(), 1.6 + dx, 0, 0);
      for (let i = 0; i < 3; i++) b.sphere(0.12, mats.hay(), 1.3 + i * 0.3, 0.86, 0, { scale: [1.4, 0.7, 0.9] });
    });
  }

  // ---- gate, fence ----
  buildGateAndFence() {
    const b = this.b;
    for (const x of [-3.6, 3.6]) b.box(0.5, 4.5, 0.5, mats.darkWood(), x, 0, 52.2, { collide: true });
    b.box(8.2, 0.4, 0.5, mats.darkWood(), 0, 4.1, 52.2);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.8), new THREE.MeshStandardMaterial({ map: textCanvasTexture(['Welcome to the village'], { w: 768, h: 128 }) }));
    sign.position.set(0, 3.5, 51.9); sign.rotation.y = Math.PI;
    this.scene.add(sign);
    const sign2 = sign.clone(); sign2.position.z = 52.5; sign2.rotation.y = 0; this.scene.add(sign2);
    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      for (const y of [0.45, 0.95, 1.4]) b.box(0.08, 0.1, len, mats.wood(), mx, y, mz, { ry });
      const n = Math.round(len / 2.5);
      for (let i = 0; i <= n; i++) b.box(0.15, 1.6, 0.15, mats.darkWood(), x0 + (x1 - x0) * i / n, 0, z0 + (z1 - z0) * i / n);
      this.colliders.add({ minX: Math.min(x0, x1) - 0.15, minY: 0, minZ: Math.min(z0, z1) - 0.15, maxX: Math.max(x0, x1) + 0.15, maxY: 1.7, maxZ: Math.max(z0, z1) + 0.15 });
    };
    fence(-57, 52.2, -3.9, 52.2); fence(3.9, 52.2, 57, 52.2);
    fence(-57, -57, 57, -57); fence(-57, -57, -57, 52.2); fence(57, -57, 57, 52.2);
  }

  buildLamps() {
    const b = this.b;
    this.lampSpots = [];
    for (let z = -28; z <= 46; z += 14) {
      for (const x of [-3.6, 3.6]) {
        b.cyl(0.07, 0.1, 3.4, 8, mats.black(), x, 0, z, { collide: true });
        b.box(0.35, 0.45, 0.35, mats.lamp(), x, 3.4, z);
        b.cyl(0.02, 0.3, 0.2, 4, mats.black(), x, 3.85, z, { ry: Math.PI / 4 });
        this.lampSpots.push([x, z]);
      }
    }
  }

  // ---- nature ----
  buildTrees() {
    const b = this.b, r = seeded(1234);
    const trees = [];
    let tries = 0;
    while (trees.length < 150 && tries++ < 6000) {
      const x = -55 + r() * 110, z = -55 + r() * 105;
      if (this.isReserved(x, z, 2)) continue;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < 17) continue;
      if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 3.5)) continue;
      trees.push([x, z]);
    }
    // Forest outside the fence
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2, d = 66 + r() * 40;
      trees.push([Math.cos(a) * d, Math.sin(a) * d]);
    }
    for (const [x, z] of trees) {
      const s = 0.8 + r() * 0.6;
      if (r() < 0.4) {
        b.cyl(0.18 * s, 0.25 * s, 2 * s, 7, mats.bark(), x, 0, z, { collide: true });
        for (let k = 0; k < 3; k++) b.add(new THREE.ConeGeometry((2.2 - k * 0.55) * s, 2.4 * s, 8), mats.pine(), x, (2.4 + k * 1.3) * s, z);
      } else {
        b.cyl(0.2 * s, 0.32 * s, 2.8 * s, 7, mats.bark(), x, 0, z, { collide: true });
        for (let k = 0; k < 4; k++) {
          const ox = (r() - 0.5) * 1.6 * s, oz = (r() - 0.5) * 1.6 * s, oy = (3.2 + r() * 1.4) * s;
          b.add(new THREE.IcosahedronGeometry((1.2 + r() * 0.6) * s, 1), k % 2 ? mats.leaf() : mats.leaf2(), x + ox, oy, z + oz);
        }
      }
    }
    // Bushes, rocks, grass and flowers
    const bushes = [], rocks = [], tufts = [], flowers = [[], [], []];
    for (let i = 0; i < 2500; i++) {
      const x = -56 + r() * 112, z = -56 + r() * 107;
      if (this.isReserved(x, z) || Math.hypot(x - LAKE.x, z - LAKE.z) < 15) continue;
      const k = r();
      if (k < 0.03) bushes.push([x, 0.3, z, 0.6 + r() * 0.6]);
      else if (k < 0.05) rocks.push([x, 0.1, z, 0.3 + r() * 0.5]);
      else if (k < 0.85) tufts.push([x, 0.15, z, 0.7 + r() * 0.6]);
      else flowers[Math.floor(r() * 3)].push([x, 0.25, z, 1]);
    }
    this.instanced(new THREE.IcosahedronGeometry(0.8, 1), mats.leaf2(), bushes);
    this.instanced(new THREE.DodecahedronGeometry(0.6, 0), mats.rock(), rocks);
    this.instanced(new THREE.ConeGeometry(0.08, 0.35, 3), mats.crop(), tufts, false);
    const fcol = [0xe8d23a, 0xe85a8a, 0xf2f2f2];
    flowers.forEach((list, i) => this.instanced(new THREE.SphereGeometry(0.07, 6, 4), std('flower' + i, { color: fcol[i] }), list, false));
  }

  instanced(geo, material, list, shadow = true) {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), r = seeded(77);
    list.forEach(([x, y, z, s], i) => {
      q.setFromEuler(new THREE.Euler(0, r() * 6.28, 0));
      m.compose(new THREE.Vector3(x, y * s, z), q, new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  buildMountains() {
    const r = seeded(99);
    const g = new THREE.Group();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + r() * 0.2, d = 170 + r() * 40;
      const h = 30 + r() * 45, rad = 35 + r() * 30;
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), mats.mountain());
      m.position.set(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d);
      g.add(m);
      if (h > 55) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.31, h * 0.28, 7), mats.snow());
        cap.position.set(m.position.x, h - 2 - h * 0.14, m.position.z);
        g.add(cap);
      }
    }
    this.scene.add(g);
  }

  // ---- lost things ----
  buildItems() {
    for (const it of ITEMS) {
      let pos;
      if (it.room) pos = toWorld(HOUSES.find(h => h.id === it.room), it.lx, it.ly, it.lz);
      else pos = new THREE.Vector3(it.x, it.y, it.z);
      const g = makeItem(it.name);
      g.position.copy(pos);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.25;
      hit.userData = { kind: 'item', name: it.name };
      g.add(hit);
      this.scene.add(g);
      this.items.push({ name: it.name, group: g, hit, baseY: pos.y });
    }
  }

  // ---- physics ----
  hit(x, y, z, r, h) {
    for (const b of this.colliders.near(x - r, z - r, x + r, z + r)) {
      if (b.minX < x + r && b.maxX > x - r && b.minZ < z + r && b.maxZ > z - r && b.minY < y + h && b.maxY > y + 0.01) return b;
    }
    return null;
  }

  collides(x, y, z, r, h) { return !!this.hit(x, y, z, r, h); }

  // Highest box top under the body footprint that is at most `maxTop`.
  topUnder(x, z, r, maxTop) {
    let top = 0;
    for (const b of this.colliders.near(x - r, z - r, x + r, z + r)) {
      if (b.water) continue;
      if (b.minX < x + r && b.maxX > x - r && b.minZ < z + r && b.maxZ > z - r && b.maxY <= maxTop) top = Math.max(top, b.maxY);
    }
    return top;
  }

  tryHorizontal(b, nx, nz) {
    const p = b.pos;
    if (!this.collides(nx, p.y, nz, b.r, b.h)) { p.x = nx; p.z = nz; return true; }
    // Step up onto low things (dock, steps).
    const top = this.topUnder(nx, nz, b.r, p.y + 0.4);
    if (top > p.y && !this.collides(nx, top, nz, b.r, b.h)) { p.x = nx; p.z = nz; p.y = top; return true; }
    return false;
  }

  // Body: { pos (feet), vel, r, h, onGround }
  moveBody(b, dt, gravity) {
    const steps = Math.max(1, Math.ceil(dt / 0.02));
    const h = dt / steps, p = b.pos;
    for (let s = 0; s < steps; s++) {
      this.tryHorizontal(b, p.x + b.vel.x * h, p.z);
      this.tryHorizontal(b, p.x, p.z + b.vel.z * h);
      p.x = Math.max(BOUND.minX, Math.min(BOUND.maxX, p.x));
      p.z = Math.max(BOUND.minZ, Math.min(BOUND.maxZ, p.z));
      b.vel.y -= gravity * h;
      const ny = p.y + b.vel.y * h;
      if (ny <= 0) { p.y = 0; b.vel.y = 0; b.onGround = true; continue; }
      if (this.collides(p.x, ny, p.z, b.r, b.h)) {
        if (b.vel.y < 0) { p.y = this.topUnder(p.x, p.z, b.r, p.y + 0.05); b.onGround = true; }
        b.vel.y = 0;
      } else {
        p.y = ny;
        b.onGround = false;
      }
    }
  }

  // True if no wall is between two points.
  lineOfSight(a, c) {
    const d = c.clone().sub(a);
    const boxes = this.colliders.near(Math.min(a.x, c.x), Math.min(a.z, c.z), Math.max(a.x, c.x), Math.max(a.z, c.z));
    for (const b of boxes) {
      if (b.water || b.maxY < 1.0) continue;
      let t0 = 0.001, t1 = 0.999;
      for (const [o, dd, lo, hi] of [[a.x, d.x, b.minX, b.maxX], [a.y, d.y, b.minY, b.maxY], [a.z, d.z, b.minZ, b.maxZ]]) {
        if (Math.abs(dd) < 1e-9) { if (o < lo || o > hi) { t0 = 2; break; } continue; }
        let ta = (lo - o) / dd, tb = (hi - o) / dd;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) break;
      }
      if (t0 <= t1) return false;
    }
    return true;
  }

  // Night look: lit windows and lamps.
  setNight(f) {
    mats.glass().emissiveIntensity = 0.9 * f;
    mats.lamp().emissiveIntensity = 0.2 + 2.2 * f;
  }
}

function calendarTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 360;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, 256, 360);
  g.fillStyle = '#b03a2e'; g.fillRect(0, 0, 256, 70);
  g.fillStyle = '#fff'; g.font = 'bold 44px Georgia, serif'; g.textAlign = 'center';
  g.fillText('CALENDAR', 128, 50);
  g.fillStyle = '#333'; g.font = '20px sans-serif';
  const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  days.forEach((d, i) => g.fillText(d, 22 + i * 35, 105));
  for (let n = 1; n <= 31; n++) {
    const i = (n + 2) % 7, row = Math.floor((n + 2) / 7);
    g.fillStyle = i >= 5 ? '#b03a2e' : '#333';
    g.fillText(String(n), 22 + i * 35, 145 + row * 40);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function itemMat(c, metal = 0) { return new THREE.MeshStandardMaterial({ color: c, roughness: metal ? 0.3 : 0.7, metalness: metal }); }

function makeItem(name) {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  const gold = itemMat(0xd8a83a, 0.8), silver = itemMat(0xc8ccd2, 0.8);
  switch (name) {
    case 'key': add(new THREE.TorusGeometry(0.06, 0.02, 8, 16), gold, 0, 0.06, 0, Math.PI / 2); add(new THREE.BoxGeometry(0.18, 0.025, 0.025), gold, 0.14, 0.06, 0); add(new THREE.BoxGeometry(0.02, 0.05, 0.025), gold, 0.2, 0.04, 0); break;
    case 'cup': add(new THREE.CylinderGeometry(0.06, 0.05, 0.11, 16), itemMat(0xf2f2f2), 0, 0.055, 0); add(new THREE.TorusGeometry(0.03, 0.01, 6, 12), itemMat(0xf2f2f2), 0.07, 0.06, 0); break;
    case 'shoe': add(new THREE.BoxGeometry(0.26, 0.08, 0.1), itemMat(0x5a3a22), 0, 0.04, 0); add(new THREE.BoxGeometry(0.1, 0.1, 0.1), itemMat(0x5a3a22), -0.08, 0.1, 0); break;
    case 'ball': add(new THREE.SphereGeometry(0.15, 20, 14), itemMat(0xd6342a), 0, 0.15, 0); break;
    case 'spoon': add(new THREE.BoxGeometry(0.18, 0.012, 0.025), silver, 0, 0.01, 0); add(new THREE.SphereGeometry(0.035, 10, 8), silver, 0.11, 0.012, 0).scale.set(1.3, 0.3, 1); break;
    case 'book': add(new THREE.BoxGeometry(0.22, 0.05, 0.3), itemMat(0x2a5a9a), 0, 0.025, 0); add(new THREE.BoxGeometry(0.2, 0.04, 0.29), itemMat(0xf4eedc), 0.012, 0.025, 0); break;
    case 'hat': add(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20), itemMat(0x2a2a2a), 0, 0.01, 0); add(new THREE.CylinderGeometry(0.11, 0.12, 0.15, 20), itemMat(0x2a2a2a), 0, 0.09, 0); break;
    case 'bell': add(new THREE.CylinderGeometry(0.03, 0.1, 0.15, 16, 1, true), gold, 0, 0.09, 0); add(new THREE.SphereGeometry(0.03, 8, 6), gold, 0, 0.18, 0); break;
    case 'coin': add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20), gold, 0, 0.006, 0); break;
    case 'comb': add(new THREE.BoxGeometry(0.16, 0.012, 0.04), itemMat(0x8a3a6a), 0, 0.006, 0); for (let i = 0; i < 8; i++) add(new THREE.BoxGeometry(0.008, 0.01, 0.04), itemMat(0x8a3a6a), -0.07 + i * 0.02, 0.006, 0.035); break;
    case 'glove': add(new THREE.BoxGeometry(0.12, 0.03, 0.16), itemMat(0x6a8a3a), 0, 0.015, 0); for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.022, 0.025, 0.08), itemMat(0x6a8a3a), -0.045 + i * 0.03, 0.013, 0.11); break;
    case 'candle': add(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 12), itemMat(0xf4eedc), 0, 0.08, 0); add(new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb030 }), 0, 0.18, 0).scale.set(1, 1.8, 1); break;
    default: add(new THREE.BoxGeometry(0.15, 0.15, 0.15), itemMat(0xffffff), 0, 0.075, 0);
  }
  // A soft glow ring so the player can spot it.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 24), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}
