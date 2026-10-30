import * as THREE from 'three';

// Voxel world. Cell (i, j, k) fills x in [i, i+1), y in [j, j+1), z in [k, k+1).
// Ground is 64 x 64 cells, top surface at y = 0.
export const HALF = 32;
export const GATE_SPAWN = { x: 0, y: 0, z: 26.5, yaw: 0 };

// Houses: 7 x 7 cells. i0/k0 = min corner cell. door = side the door faces.
export const HOUSES = [
  { id: 'h1', i0: -13, k0: 9, door: 'east', roof: 0xb83b3b },
  { id: 'h2', i0: -13, k0: -3, door: 'east', roof: 0x2f6fb5 },
  { id: 'h3', i0: -13, k0: -15, door: 'east', roof: 0xe0a526 },
  { id: 'h4', i0: 7, k0: 9, door: 'west', roof: 0x3d8b3d },
  { id: 'h5', i0: 7, k0: -3, door: 'west', roof: 0x8e44ad },
  { id: 'h6', i0: 7, k0: -15, door: 'west', roof: 0xe06a1f },
];
for (const h of HOUSES) {
  h.cz = h.k0 + 3;                             // door middle cell
  h.doorI = h.door === 'east' ? h.i0 + 6 : h.i0; // wall cell column with the door
  h.out = h.door === 'east' ? 1 : -1;          // +x or -x
  h.doorFaceX = h.door === 'east' ? h.i0 + 7 : h.i0;
  // Point on the ground in front of the door (outside).
  h.front = { x: h.doorFaceX + h.out * 1.5, z: h.cz + 0.5 };
  // Table inside, near the back wall.
  h.table = { i: h.door === 'east' ? h.i0 + 1 : h.i0 + 5, k: h.cz };
}

const TREES = [[-20, -20], [-24, 5], [-18, 22], [-26, -8], [20, -22], [24, 8], [19, 20], [27, -5],
  [-6, -24], [6, -25], [-28, 26], [27, 26], [-15, -27], [15, -27], [-22, -14], [22, -13], [-7, 21], [8, 21]];

const C = {
  grass: 0x6bb04a, grass2: 0x5fa043, dirt: 0x9b7653, dirt2: 0x8c6a49, wall: 0xe8dcc0, wall2: 0xd9ccae,
  wood: 0x7a5432, trunk: 0x6b4a2b, leaf: 0x3f8f3a, leaf2: 0x357d31, glass: 0x9fd3f0, table: 0x8a5a33, fence: 0x8b6b45,
};

function hash(i, k) {
  const n = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Cube faces: normal, 4 corners (counter-clockwise seen from outside), light factor.
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.9 },
];

function quadGeometry(quads) {
  const pos = new Float32Array(quads.length * 4 * 3);
  const nor = new Float32Array(quads.length * 4 * 3);
  const col = new Float32Array(quads.length * 4 * 3);
  const idx = new Uint32Array(quads.length * 6);
  const c = new THREE.Color();
  quads.forEach((q, n) => {
    c.setHex(q.color).multiplyScalar(q.face.shade);
    q.face.c.forEach((v, m) => {
      const o = (n * 4 + m) * 3;
      pos[o] = q.i + v[0]; pos[o + 1] = q.j + v[1]; pos[o + 2] = q.k + v[2];
      nor[o] = q.face.n[0]; nor[o + 1] = q.face.n[1]; nor[o + 2] = q.face.n[2];
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
    });
    const b = n * 4;
    idx.set([b, b + 1, b + 2, b, b + 2, b + 3], n * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.solid = new Set();
    this.blocks = [];
    this.letters = []; // { mesh, houseId }
    this.signs = [];
  }

  key(i, j, k) { return `${i},${j},${k}`; }

  isSolid(i, j, k) {
    if (i < -HALF || i >= HALF || k < -HALF || k >= HALF) return true; // world edge
    if (j < 0) return true;                                            // ground
    return this.solid.has(this.key(i, j, k));
  }

  add(i, j, k, color, solid = true) {
    this.blocks.push({ i, j, k, color });
    if (solid) this.solid.add(this.key(i, j, k));
  }

  isPath(i, k) {
    if (i >= -2 && i <= 1 && k >= -20 && k < HALF) return true; // main path
    for (const h of HOUSES) {
      if (Math.abs(k - h.cz) > 1) continue;
      if (h.door === 'east' && i >= h.i0 + 7 && i <= -3) return true;
      if (h.door === 'west' && i <= h.i0 - 1 && i >= 2) return true;
    }
    return false;
  }

  build() {
    this.buildGround();
    for (const h of HOUSES) this.buildHouse(h);
    for (const [x, z] of TREES) this.buildTree(x, z);
    this.buildGate();
    this.buildBlocks();
  }

  buildGround() {
    // Only the top face of each ground cell is visible.
    const quads = [];
    for (let i = -HALF; i < HALF; i++) {
      for (let k = -HALF; k < HALF; k++) {
        const r = hash(i, k);
        const color = this.isPath(i, k) ? (r > 0.5 ? C.dirt : C.dirt2) : (r > 0.5 ? C.grass : C.grass2);
        quads.push({ i, j: -1, k, face: FACES[2], color });
      }
    }
    const mesh = new THREE.Mesh(quadGeometry(quads), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.name = 'ground';
    this.scene.add(mesh);
  }

  buildHouse(h) {
    const { i0, k0 } = h;
    for (let di = 0; di < 7; di++) {
      for (let dk = 0; dk < 7; dk++) {
        const edge = di === 0 || di === 6 || dk === 0 || dk === 6;
        if (!edge) continue;
        const i = i0 + di, k = k0 + dk;
        for (let j = 0; j < 4; j++) {
          // Door: 3 wide, 3 high.
          if (i === h.doorI && Math.abs(k - h.cz) <= 1 && j <= 2) continue;
          const corner = (di === 0 || di === 6) && (dk === 0 || dk === 6);
          // Windows on the two side walls.
          const sideWindow = (dk === 0 || dk === 6) && (di === 2 || di === 4) && (j === 1 || j === 2);
          let color = corner ? C.wood : ((i + j + k) % 2 ? C.wall : C.wall2);
          if (sideWindow) color = C.glass;
          if (j === 3 && !corner) color = C.wood;
          this.add(i, j, k, color);
        }
      }
    }
    // Stepped roof.
    const roof = new THREE.Color(h.roof);
    const roofDark = roof.clone().multiplyScalar(0.8).getHex();
    for (let layer = 0; layer < 5; layer++) {
      const size = 9 - layer * 2;
      const start = -1 + layer;
      for (let a = 0; a < size; a++) {
        for (let b = 0; b < size; b++) {
          this.add(i0 + start + a, 4 + layer, k0 + start + b, (a + b) % 2 ? h.roof : roofDark);
        }
      }
    }
    // Table with a letter.
    this.add(h.table.i, 0, h.table.k, C.table);
    const letter = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.45),
      new THREE.MeshLambertMaterial({ color: 0xfaf6e8, side: THREE.DoubleSide }),
    );
    letter.rotation.x = -Math.PI / 2;
    letter.position.set(h.table.i + 0.5, 1.01, h.table.k + 0.5);
    letter.userData = { kind: 'letter', houseId: h.id };
    this.scene.add(letter);
    this.letters.push({ mesh: letter, houseId: h.id });
  }

  addSign(h, text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const g = canvas.getContext('2d');
    g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#f3e3c3'; g.fillRect(8, 8, 496, 112);
    g.fillStyle = '#2b1d10';
    g.font = 'bold 52px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 52;
    while (g.measureText(text).width > 470 && size > 20) { size -= 2; g.font = `bold ${size}px system-ui, sans-serif`; }
    g.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(h.doorFaceX + h.out * 0.02, 3.5, h.cz + 0.5);
    sign.rotation.y = h.out * Math.PI / 2;
    sign.name = `sign-${h.id}`;
    this.scene.add(sign);
    this.signs.push(sign);
  }

  buildTree(x, z) {
    for (let j = 0; j < 3; j++) this.add(x, j, z, C.trunk);
    for (let j = 3; j < 5; j++) {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        this.add(x + a, j, z + b, hash(x + a + j, z + b) > 0.5 ? C.leaf : C.leaf2);
      }
    }
    this.add(x, 5, z, C.leaf);
  }

  buildGate() {
    const k = 28;
    for (let j = 0; j < 4; j++) { this.add(-3, j, k, C.wood); this.add(2, j, k, C.wood); }
    for (let i = -2; i <= 1; i++) this.add(i, 3, k, C.wood);
    for (let i = -HALF; i < HALF; i++) {
      if (i >= -3 && i <= 2) continue;
      this.add(i, 0, k, C.fence);
    }
  }

  buildBlocks() {
    // One mesh with only the faces that touch air.
    const filled = new Set(this.blocks.map(b => this.key(b.i, b.j, b.k)));
    const quads = [];
    for (const b of this.blocks) {
      for (const face of FACES) {
        const [di, dj, dk] = face.n;
        if (b.j + dj < 0) continue;
        if (filled.has(this.key(b.i + di, b.j + dj, b.k + dk))) continue;
        quads.push({ i: b.i, j: b.j, k: b.k, face, color: b.color });
      }
    }
    const mesh = new THREE.Mesh(quadGeometry(quads), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.name = 'blocks';
    this.blockMesh = mesh;
    this.scene.add(mesh);
  }

  // Body: { pos: Vector3 (feet), vel: Vector3, r, h, onGround }
  collides(x, y, z, r, h) {
    const i0 = Math.floor(x - r), i1 = Math.floor(x + r - 1e-6);
    const j0 = Math.floor(y + 1e-4), j1 = Math.floor(y + h - 1e-6);
    const k0 = Math.floor(z - r), k1 = Math.floor(z + r - 1e-6);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
      if (this.isSolid(i, j, k)) return true;
    }
    return false;
  }

  moveBody(b, dt, gravity) {
    // Small steps so fast moves do not pass through blocks.
    const steps = Math.max(1, Math.ceil(dt / 0.02));
    const h = dt / steps;
    const p = b.pos;
    for (let s = 0; s < steps; s++) {
      const nx = p.x + b.vel.x * h;
      if (!this.collides(nx, p.y, p.z, b.r, b.h)) p.x = nx;
      const nz = p.z + b.vel.z * h;
      if (!this.collides(p.x, p.y, nz, b.r, b.h)) p.z = nz;
      b.vel.y -= gravity * h;
      const ny = p.y + b.vel.y * h;
      if (this.collides(p.x, ny, p.z, b.r, b.h)) {
        if (b.vel.y < 0) {
          const top = Math.floor(ny) + 1;
          if (!this.collides(p.x, top, p.z, b.r, b.h)) p.y = top;
          b.onGround = true;
        }
        b.vel.y = 0;
      } else {
        p.y = ny;
        b.onGround = false;
      }
    }
  }

  // True if nothing solid is between two points.
  lineOfSight(a, b) {
    const d = b.clone().sub(a);
    const len = d.length();
    const n = Math.ceil(len / 0.25);
    for (let s = 1; s < n; s++) {
      const t = s / n;
      const x = a.x + d.x * t, y = a.y + d.y * t, z = a.z + d.z * t;
      if (y >= 0 && this.isSolid(Math.floor(x), Math.floor(y), Math.floor(z))) return false;
    }
    return true;
  }

  houseAt(x, z) {
    return HOUSES.find(h => x >= h.i0 && x < h.i0 + 7 && z >= h.k0 && z < h.k0 + 7) || null;
  }
}
