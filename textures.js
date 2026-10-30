import * as THREE from 'three';

// Procedural canvas textures. No image files needed.

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function make(w, h, draw, seed = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function hex(c) { return '#' + new THREE.Color(c).getHexString(); }
function shade(c, f) { return hex(new THREE.Color(c).multiplyScalar(f)); }

function speckle(g, w, h, r, base, n, spread, size) {
  g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    g.fillStyle = shade(base, 1 + (r() - 0.5) * spread);
    const s = size * (0.5 + r());
    g.fillRect(r() * w, r() * h, s, s);
  }
}

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export const TEX = {
  grass: () => cached('grass', () => make(256, 256, (g, w, h, r) => {
    speckle(g, w, h, r, 0x5e9a3c, 5000, 0.5, 3);
    for (let i = 0; i < 900; i++) {
      g.strokeStyle = shade(0x6fae46, 0.8 + r() * 0.5);
      const x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 5); g.stroke();
    }
  }, 11)),
  dirt: () => cached('dirt', () => make(256, 256, (g, w, h, r) => {
    speckle(g, w, h, r, 0x8d6e4c, 6000, 0.45, 3);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = shade(0x9a9088, 0.8 + r() * 0.4);
      g.beginPath(); g.ellipse(r() * w, r() * h, 2 + r() * 4, 1.5 + r() * 3, r() * 3, 0, 7); g.fill();
    }
  }, 12)),
  sand: () => cached('sand', () => make(128, 128, (g, w, h, r) => speckle(g, w, h, r, 0xd8c49a, 3000, 0.25, 2), 13)),
  stone: () => cached('stone', () => make(256, 256, (g, w, h, r) => {
    g.fillStyle = '#6f6a62'; g.fillRect(0, 0, w, h);
    const s = 32;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      g.fillStyle = shade(0xa39d92, 0.8 + r() * 0.35);
      g.fillRect(x + 2, y + 2, s - 4, s - 4);
    }
  }, 14)),
  planks: () => cached('planks', () => make(256, 256, (g, w, h, r) => {
    const n = 8, s = h / n;
    for (let i = 0; i < n; i++) {
      const base = new THREE.Color(0x9a6b42).multiplyScalar(0.8 + r() * 0.35);
      g.fillStyle = hex(base); g.fillRect(0, i * s, w, s);
      for (let k = 0; k < 30; k++) {
        g.strokeStyle = hex(base.clone().multiplyScalar(0.85 + r() * 0.1));
        const y = i * s + r() * s;
        g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w / 3, y + r() * 4 - 2, 2 * w / 3, y + r() * 4 - 2, w, y); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, i * s, w, 2);
      g.fillRect(r() * w, i * s, 2, s);
    }
  }, 15)),
  plaster: (color = 0xe6dcc6) => cached('plaster' + color, () => make(256, 256, (g, w, h, r) => {
    speckle(g, w, h, r, color, 4000, 0.12, 4);
    for (let i = 0; i < 25; i++) {
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, 30);
      grd.addColorStop(0, 'rgba(90,80,60,0.12)'); grd.addColorStop(1, 'rgba(90,80,60,0)');
      g.save(); g.translate(r() * w, r() * h); g.fillStyle = grd; g.fillRect(-30, -30, 60, 60); g.restore();
    }
  }, 16)),
  wallpaper: (a, b) => cached(`wp${a}${b}`, () => make(256, 256, (g, w, h, r) => {
    speckle(g, w, h, r, a, 1500, 0.1, 3);
    g.fillStyle = hex(b);
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 * 16; x < w; x += 32) {
      g.beginPath();
      for (let p = 0; p < 4; p++) g.ellipse(x + 8, y + 8, 5, 2, p * Math.PI / 4, 0, 7);
      g.fill();
    }
    for (let i = 0; i < 12; i++) {
      g.fillStyle = 'rgba(80,70,50,0.07)';
      g.fillRect(r() * w, r() * h, 20 + r() * 50, 20 + r() * 80);
    }
  }, 17)),
  roof: (color) => cached('roof' + color, () => make(256, 256, (g, w, h, r) => {
    const rows = 8, s = h / rows, tw = 32;
    for (let i = 0; i < rows; i++) {
      for (let x = -tw; x < w + tw; x += tw) {
        g.fillStyle = shade(color, 0.75 + r() * 0.35);
        const ox = (i % 2) * tw / 2;
        g.fillRect(x + ox + 1, i * s, tw - 2, s - 2);
      }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, i * s + s - 3, w, 3);
    }
  }, 18)),
  brick: () => cached('brick', () => make(256, 256, (g, w, h, r) => {
    g.fillStyle = '#cfc6b5'; g.fillRect(0, 0, w, h);
    const bh = 16, bw = 48;
    for (let y = 0; y < h; y += bh) for (let x = -bw; x < w; x += bw) {
      g.fillStyle = shade(0x9c4a32, 0.75 + r() * 0.4);
      g.fillRect(x + ((y / bh) % 2) * bw / 2 + 2, y + 2, bw - 4, bh - 4);
    }
  }, 19)),
  bark: () => cached('bark', () => make(64, 256, (g, w, h, r) => {
    g.fillStyle = '#5b4330'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) { g.fillStyle = shade(0x5b4330, 0.6 + r() * 0.8); g.fillRect(r() * w, r() * h, 2 + r() * 3, 20 + r() * 40); }
  }, 20)),
  checker: (color) => cached('chk' + color, () => make(128, 128, (g, w, h) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = hex(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35));
    for (let i = 0; i < 8; i++) { g.fillRect(i * 16, 0, 8, h); g.fillRect(0, i * 16, w, 8); }
    g.fillStyle = hex(color);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) g.fillRect(x * 16, y * 16, 8, 8);
  })),
  rug: (color) => cached('rug' + color, () => make(128, 128, (g, w, h, r) => {
    speckle(g, w, h, r, color, 2000, 0.25, 2);
    g.strokeStyle = '#e8d9a8'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.lineWidth = 3; g.strokeRect(24, 24, w - 48, h - 48);
  }, 21)),
  tile: () => cached('tile', () => make(128, 128, (g, w, h, r) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = shade(0xc9cfc4, 0.9 + r() * 0.15); g.fillRect(x * 32, y * 32, 32, 32);
      g.strokeStyle = '#7f8a80'; g.strokeRect(x * 32 + 0.5, y * 32 + 0.5, 31, 31);
      g.strokeStyle = 'rgba(70,90,80,0.35)'; g.beginPath(); g.arc(x * 32 + 16, y * 32 + 16, 9, 0, 7); g.stroke();
    }
  }, 22)),
};

export function textCanvasTexture(lines, { w = 512, h = 256, bg = '#f3e3c3', fg = '#2b1d10', border = '#6b4a2b', font = 'bold 56px Georgia, serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = border; g.fillRect(0, 0, w, h);
  g.fillStyle = bg; g.fillRect(10, 10, w - 20, h - 20);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
  g.font = font;
  while (g.measureText(longest).width > w - 50 && size > 14) { size -= 2; g.font = font.replace(/\d+px/, size + 'px'); }
  const lh = size * 1.2;
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
