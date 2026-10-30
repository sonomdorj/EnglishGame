import * as THREE from 'three';

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}

export function makeLabel(text, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  const font = 'bold 44px system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 40;
  canvas.width = w; canvas.height = 72;
  g.font = font;
  g.fillStyle = 'rgba(20, 24, 32, 0.7)';
  g.fillRect(0, 0, w, 72);
  g.fillStyle = color;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, 38);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
  sprite.scale.set(w / 160, 72 / 160, 1);
  return sprite;
}

// Invisible box used for "look at to talk".
function hitBox(w, h, d, y, data) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.y = y;
  m.userData = data;
  return m;
}

export class Human {
  constructor({ id, name, shirt, pants = 0x334455, hair = 0x1b1410, skin = 0xe2b48c, label = true }) {
    this.id = id;
    this.name = name;
    const g = this.group = new THREE.Group();
    this.legL = box(0.25, 0.8, 0.25, pants, -0.15, 0.4, 0);
    this.legR = box(0.25, 0.8, 0.25, pants, 0.15, 0.4, 0);
    this.armL = box(0.2, 0.7, 0.2, shirt, -0.42, 1.15, 0);
    this.armR = box(0.2, 0.7, 0.2, shirt, 0.42, 1.15, 0);
    g.add(this.legL, this.legR, this.armL, this.armR);
    g.add(box(0.62, 0.72, 0.35, shirt, 0, 1.16, 0));
    g.add(box(0.46, 0.46, 0.46, skin, 0, 1.76, 0));
    g.add(box(0.48, 0.14, 0.48, hair, 0, 2.02, 0));
    g.add(box(0.08, 0.08, 0.02, 0x111111, -0.1, 1.8, 0.235));
    g.add(box(0.08, 0.08, 0.02, 0x111111, 0.1, 1.8, 0.235));
    if (label) {
      this.label = makeLabel(name);
      this.label.position.y = 2.45;
      g.add(this.label);
    }
    this.hit = hitBox(0.9, 2.2, 0.9, 1.1, { kind: 'villager', id });
    g.add(this.hit);
    this.item = null;
    this.walkPhase = 0;
  }

  setItem(color) {
    if (this.item) { this.group.remove(this.item); this.item = null; }
    if (color == null) return;
    this.item = box(0.3, 0.3, 0.3, color, 0.42, 0.75, 0.25);
    this.group.add(this.item);
  }

  faceToward(x, z) {
    const p = this.group.position;
    this.group.rotation.y = Math.atan2(x - p.x, z - p.z);
  }

  animate(dt, moving, t) {
    if (moving) this.walkPhase += dt * 8; else this.walkPhase *= 0.85;
    const s = Math.sin(this.walkPhase) * 0.5;
    this.legL.rotation.x = s; this.legR.rotation.x = -s;
    this.armL.rotation.x = -s; this.armR.rotation.x = s;
    if (this.item) this.item.position.y = 0.75 + Math.sin(t * 3) * 0.05;
  }
}

export class Panda {
  constructor() {
    const g = this.group = new THREE.Group();
    const W = 0xf4f4f0, B = 0x1a1a1a;
    this.body = new THREE.Group();
    g.add(this.body);
    this.legs = [];
    for (const [x, z] of [[-0.3, 0.35], [0.3, 0.35], [-0.3, -0.35], [0.3, -0.35]]) {
      const leg = box(0.28, 0.4, 0.28, B, x, 0.2, z);
      this.legs.push(leg);
      g.add(leg);
    }
    this.body.add(box(0.9, 0.6, 1.1, W, 0, 0.65, 0));
    this.body.add(box(0.92, 0.3, 0.4, B, 0, 0.72, 0.25)); // black shoulder band
    const head = this.head = new THREE.Group();
    head.position.set(0, 1.0, 0.6);
    head.add(box(0.62, 0.55, 0.55, W, 0, 0, 0));
    head.add(box(0.18, 0.18, 0.1, B, -0.25, 0.32, 0)); // ears
    head.add(box(0.18, 0.18, 0.1, B, 0.25, 0.32, 0));
    head.add(box(0.16, 0.14, 0.04, B, -0.14, 0.04, 0.28)); // eye patches
    head.add(box(0.16, 0.14, 0.04, B, 0.14, 0.04, 0.28));
    head.add(box(0.05, 0.05, 0.02, 0xffffff, -0.13, 0.06, 0.305));
    head.add(box(0.05, 0.05, 0.02, 0xffffff, 0.15, 0.06, 0.305));
    head.add(box(0.1, 0.07, 0.06, B, 0, -0.1, 0.3)); // nose
    this.body.add(head);
    this.label = makeLabel('Buu');
    this.label.position.y = 1.75;
    g.add(this.label);
    this.hit = hitBox(1.1, 1.5, 1.4, 0.75, { kind: 'buu', id: 'buu' });
    g.add(this.hit);
    this.phase = 0;
  }

  faceToward(x, z) {
    const p = this.group.position;
    const target = Math.atan2(x - p.x, z - p.z);
    let d = target - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * 0.15;
  }

  animate(dt, moving, t) {
    if (moving) {
      this.phase += dt * 10;
      const s = Math.sin(this.phase) * 0.45;
      this.legs[0].rotation.x = s; this.legs[3].rotation.x = s;
      this.legs[1].rotation.x = -s; this.legs[2].rotation.x = -s;
      this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.05;
      this.head.rotation.z = 0;
    } else {
      // Idle: slow breathing and a small head tilt.
      for (const l of this.legs) l.rotation.x *= 0.8;
      this.body.position.y = Math.sin(t * 2) * 0.02;
      this.head.rotation.z = Math.sin(t * 0.7) * 0.12;
    }
  }
}
