import * as THREE from 'three';

const matCache = new Map();
function mat(color, rough = 0.8) {
  const key = color + ':' + rough;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough }));
  return matCache.get(key);
}

function mesh(geo, m, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  if (parent) parent.add(o);
  return o;
}
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 12);
const sphere = (r, a = 20, b = 14) => new THREE.SphereGeometry(r, a, b);

export function makeLabel(text, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  const font = 'bold 44px system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 40;
  canvas.width = w; canvas.height = 64;
  g.font = font;
  g.fillStyle = 'rgba(20, 24, 32, 0.55)';
  g.beginPath(); g.roundRect(0, 0, w, 64, 18); g.fill();
  g.fillStyle = color;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
  sprite.scale.set(w / 340, 64 / 340, 1);
  return sprite;
}

function hitBox(w, h, d, y, data) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.y = y;
  m.userData = data;
  return m;
}

// A person with joints, a face and simple clothes.
// opts: id, name, shirt, pants, skin, hair, hairStyle (short|long|bun|bald), extras [apron|glasses|cap|beard|mustache|tie|skirt], scale
export class Human {
  constructor(o) {
    this.id = o.id;
    this.name = o.name;
    const skin = mat(o.skin ?? 0xd9a882, 0.7), shirt = mat(o.shirt ?? 0x777777), pants = mat(o.pants ?? 0x334455);
    const hair = mat(o.hair ?? 0x1b1410, 0.9), shoe = mat(o.shoes ?? 0x2a2420, 0.6);
    const extras = new Set(o.extras || []);
    const s = o.scale ?? 1;
    this.group = new THREE.Group();
    const root = this.root = new THREE.Group();
    root.scale.setScalar(s);
    this.group.add(root);

    const hips = this.hips = new THREE.Group();
    hips.position.y = 0.92;
    root.add(hips);
    mesh(capsule(0.15, 0.08), pants, 0, 0.02, 0, hips).scale.set(1.1, 1, 0.75);

    const leg = side => {
      const top = new THREE.Group();
      top.position.set(side * 0.09, 0, 0);
      hips.add(top);
      mesh(capsule(0.07, 0.32), pants, 0, -0.22, 0, top);
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      top.add(knee);
      mesh(capsule(0.058, 0.32), pants, 0, -0.2, 0, knee);
      mesh(new THREE.BoxGeometry(0.11, 0.08, 0.25), shoe, 0, -0.44, 0.045, knee);
      return { top, knee };
    };
    this.legL = leg(-1); this.legR = leg(1);
    if (extras.has('skirt')) mesh(new THREE.CylinderGeometry(0.17, 0.3, 0.5, 16), pants, 0, -0.22, 0, hips);

    const torso = this.torso = new THREE.Group();
    hips.add(torso);
    this.chest = mesh(capsule(0.16, 0.3), shirt, 0, 0.3, 0, torso);
    this.chest.scale.set(1.12, 1, 0.68);
    mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), skin, 0, 0.6, 0, torso);
    if (extras.has('apron')) {
      mesh(new THREE.BoxGeometry(0.3, 0.62, 0.02), mat(o.apronColor ?? 0xf2efe6), 0, 0.12, 0.12, torso);
    }
    if (extras.has('tie')) mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), mat(0x8a1f2a), 0, 0.38, 0.115, torso);

    const arm = side => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.22, 0.52, 0);
      torso.add(sh);
      mesh(capsule(0.05, 0.22), shirt, 0, -0.14, 0, sh);
      const el = new THREE.Group();
      el.position.y = -0.29;
      sh.add(el);
      mesh(capsule(0.044, 0.2), extras.has('longSleeves') ? shirt : skin, 0, -0.12, 0, el);
      const hand = mesh(sphere(0.05, 12, 10), skin, 0, -0.27, 0, el);
      hand.scale.set(0.8, 1.1, 0.6);
      return { sh, el, hand };
    };
    this.armL = arm(-1); this.armR = arm(1);
    this.armL.sh.rotation.z = -0.08; this.armR.sh.rotation.z = 0.08;

    // Head and face
    const head = this.head = new THREE.Group();
    head.position.y = 0.66;
    torso.add(head);
    mesh(sphere(0.12), skin, 0, 0.11, 0, head).scale.set(0.88, 1.08, 0.98);
    for (const side of [-1, 1]) {
      mesh(sphere(0.025, 8, 6), skin, side * 0.105, 0.11, -0.005, head).scale.set(0.5, 1, 0.8);
      const eye = mesh(sphere(0.02, 10, 8), mat(0xffffff, 0.3), side * 0.04, 0.13, 0.1, head);
      eye.scale.set(1.2, 0.8, 0.5);
      mesh(sphere(0.011, 8, 6), mat(0x2a1a10, 0.3), side * 0.04, 0.13, 0.112, head);
      mesh(new THREE.BoxGeometry(0.045, 0.01, 0.01), hair, side * 0.042, 0.163, 0.104, head).rotation.z = side * -0.12;
    }
    this.eyesY = 0.13;
    const nose = mesh(new THREE.ConeGeometry(0.018, 0.05, 8), skin, 0, 0.1, 0.12, head);
    nose.rotation.x = Math.PI / 2;
    this.mouth = mesh(new THREE.BoxGeometry(0.045, 0.008, 0.01), mat(0x8a3a3a, 0.5), 0, 0.055, 0.108, head);

    const style = o.hairStyle || 'short';
    if (style !== 'bald') {
      const cap = mesh(new THREE.SphereGeometry(0.128, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.12, -0.01, head);
      cap.scale.set(0.92, 1.12, 1.02);
      cap.rotation.x = -0.25;
    }
    if (style === 'long') mesh(new THREE.BoxGeometry(0.24, 0.3, 0.08), hair, 0, 0.0, -0.08, head);
    if (style === 'bun') mesh(sphere(0.06), hair, 0, 0.2, -0.1, head);
    if (extras.has('beard')) mesh(sphere(0.08, 12, 8), hair, 0, 0.04, 0.06, head).scale.set(1, 0.8, 0.7);
    if (extras.has('mustache')) mesh(new THREE.BoxGeometry(0.07, 0.015, 0.015), hair, 0, 0.072, 0.11, head);
    if (extras.has('glasses')) {
      const gm = mat(0x222222, 0.4);
      for (const side of [-1, 1]) mesh(new THREE.TorusGeometry(0.025, 0.004, 6, 16), gm, side * 0.042, 0.13, 0.118, head);
      mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), gm, 0, 0.135, 0.118, head);
    }
    if (extras.has('cap')) {
      mesh(new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(o.capColor ?? 0x2a4a6a), 0, 0.15, 0, head);
      mesh(new THREE.BoxGeometry(0.16, 0.012, 0.1), mat(o.capColor ?? 0x2a4a6a), 0, 0.155, 0.14, head);
    }

    if (o.label !== false) {
      this.label = makeLabel(o.name);
      this.label.position.y = 2.05 * s;
      this.group.add(this.label);
    }
    // Full height even for children, so looking straight ahead still works.
    this.hit = hitBox(0.7, Math.max(1.9, 1.9 * s), 0.7, Math.max(0.95, 0.95 * s), { kind: o.kind || 'villager', id: o.id });
    this.group.add(this.hit);
    this.item = null;
    this.walk = 0;
    this.talking = false;
    this.blink = Math.random() * 4;
    this.lookYaw = 0;
  }

  setItem(color) {
    if (this.item) { this.item.parent.remove(this.item); this.item = null; }
    if (color == null) return;
    this.item = mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), mat(color, 0.5), 0, -0.36, 0.05, this.armR.el);
  }

  faceToward(x, z) {
    const p = this.group.position;
    this.group.rotation.y = Math.atan2(x - p.x, z - p.z);
  }

  // Turn only the head toward a point (small angles).
  lookAt(x, z) {
    const p = this.group.position;
    let d = Math.atan2(x - p.x, z - p.z) - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.lookYaw += (Math.max(-1, Math.min(1, d)) - this.lookYaw) * 0.1;
    this.head.rotation.y = this.lookYaw;
  }

  animate(dt, moving, t) {
    if (moving) this.walk += dt * 7; else this.walk *= 0.85;
    const a = Math.sin(this.walk), amp = moving ? 0.55 : Math.min(0.55, Math.abs(a) * 0.55);
    const sw = Math.sin(this.walk) * amp;
    this.legL.top.rotation.x = sw; this.legR.top.rotation.x = -sw;
    this.legL.knee.rotation.x = Math.max(0, -Math.cos(this.walk)) * amp * 1.2;
    this.legR.knee.rotation.x = Math.max(0, Math.cos(this.walk)) * amp * 1.2;
    this.armL.sh.rotation.x = -sw * 0.8; this.armR.sh.rotation.x = sw * 0.8;
    this.armL.el.rotation.x = -0.25; this.armR.el.rotation.x = -0.25;
    if (this.item) this.armR.sh.rotation.x = -0.6;
    // Breathing
    const br = 1 + Math.sin(t * 2.2 + this.blink) * 0.012;
    this.chest.scale.y = br;
    this.hips.position.y = 0.92 + (moving ? Math.abs(Math.cos(this.walk)) * 0.03 : 0);
    // Mouth moves while talking
    this.mouth.scale.y = this.talking ? 1 + Math.abs(Math.sin(t * 16)) * 4 : 1;
    // Blink
    this.blink -= dt;
    const closed = this.blink < 0.12 && this.blink > 0;
    if (this.blink < 0) this.blink = 2 + Math.random() * 4;
    this.head.children.forEach(c => { if (c.geometry?.type === 'SphereGeometry' && Math.abs(c.position.y - this.eyesY) < 0.001) c.visible = !closed; });
  }
}

export class Panda {
  constructor() {
    const g = this.group = new THREE.Group();
    const W = mat(0xf6f5f0, 0.95), B = mat(0x1d1d1f, 0.9);
    this.body = new THREE.Group();
    g.add(this.body);
    mesh(sphere(0.5), W, 0, 0.62, -0.05, this.body).scale.set(0.95, 0.85, 1.25);
    mesh(sphere(0.5), B, 0, 0.66, 0.22, this.body).scale.set(1.0, 0.9, 0.45);
    this.legs = [];
    for (const [x, z] of [[-0.25, 0.32], [0.25, 0.32], [-0.25, -0.38], [0.25, -0.38]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.45, z);
      g.add(pivot);
      mesh(capsule(0.13, 0.22), B, 0, -0.22, 0, pivot);
      this.legs.push(pivot);
    }
    mesh(sphere(0.09, 10, 8), W, 0, 0.75, -0.66, this.body);
    const head = this.head = new THREE.Group();
    head.position.set(0, 1.0, 0.55);
    this.body.add(head);
    mesh(sphere(0.32), W, 0, 0, 0, head).scale.set(1.08, 0.95, 0.95);
    for (const side of [-1, 1]) {
      mesh(sphere(0.1, 12, 10), B, side * 0.24, 0.25, -0.04, head).scale.set(1, 1, 0.6);
      const patch = mesh(sphere(0.075, 12, 10), B, side * 0.11, 0.03, 0.26, head);
      patch.scale.set(0.9, 1.25, 0.5); patch.rotation.z = side * 0.5;
      mesh(sphere(0.025, 8, 6), mat(0xffffff, 0.2), side * 0.105, 0.05, 0.3, head);
      mesh(sphere(0.012, 8, 6), B, side * 0.105, 0.05, 0.322, head);
    }
    mesh(sphere(0.12, 14, 10), W, 0, -0.08, 0.25, head).scale.set(1, 0.75, 0.8);
    mesh(sphere(0.04, 10, 8), B, 0, -0.04, 0.35, head).scale.set(1.3, 0.8, 0.8);
    this.label = makeLabel('Buu');
    this.label.position.y = 1.65;
    g.add(this.label);
    this.hit = hitBox(1.0, 1.4, 1.5, 0.7, { kind: 'buu', id: 'buu' });
    g.add(this.hit);
    this.phase = 0;
    this.talking = false;
  }

  faceToward(x, z) {
    const p = this.group.position;
    const target = Math.atan2(x - p.x, z - p.z);
    let d = target - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * 0.12;
  }

  animate(dt, moving, t) {
    if (moving) {
      this.phase += dt * 9;
      const s = Math.sin(this.phase) * 0.5;
      this.legs[0].rotation.x = s; this.legs[3].rotation.x = s;
      this.legs[1].rotation.x = -s; this.legs[2].rotation.x = -s;
      this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.04;
      this.body.rotation.z = Math.sin(this.phase) * 0.04;
    } else {
      for (const l of this.legs) l.rotation.x *= 0.8;
      this.body.position.y = Math.sin(t * 2) * 0.012;
      this.body.rotation.z *= 0.9;
      this.head.rotation.z = Math.sin(t * 0.7) * 0.12;
    }
    this.head.rotation.x = this.talking ? Math.sin(t * 12) * 0.06 : 0;
  }
}
