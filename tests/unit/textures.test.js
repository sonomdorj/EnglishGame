import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './fake-dom.js';

installDom();
const THREE = await import('three');
const { TEX, textCanvasTexture } = await import('../../textures.js');

const ARGS = { plaster: [0xe6dcc6], wallpaper: [0xd9cfa9, 0xb79a6a], roof: [0x9e3b2c], checker: [0xc04040], rug: [0x4060a0] };

test('every texture is a repeating sRGB canvas texture', () => {
  for (const [name, fn] of Object.entries(TEX)) {
    const t = fn(...(ARGS[name] || []));
    assert.ok(t instanceof THREE.CanvasTexture, name);
    assert.equal(t.colorSpace, THREE.SRGBColorSpace, name);
    assert.equal(t.wrapS, THREE.RepeatWrapping, name);
    assert.equal(t.wrapT, THREE.RepeatWrapping, name);
    assert.ok(t.image.width > 0 && t.image.height > 0, name);
  }
});

test('textures are cached by name and color', () => {
  assert.equal(TEX.grass(), TEX.grass());
  assert.equal(TEX.roof(0x111111), TEX.roof(0x111111));
  assert.notEqual(TEX.roof(0x111111), TEX.roof(0x222222));
  assert.equal(TEX.plaster(), TEX.plaster(0xe6dcc6), 'default color');
});

test('wallpaper cache: different color pairs never share a texture', () => {
  assert.notEqual(TEX.wallpaper(1, 23), TEX.wallpaper(12, 3));
  assert.equal(TEX.wallpaper(5, 6), TEX.wallpaper(5, 6));
});

test('textCanvasTexture: size and options', () => {
  const t = textCanvasTexture(['Hello'], { w: 640, h: 128 });
  assert.ok(t instanceof THREE.CanvasTexture);
  assert.equal(t.image.width, 640);
  assert.equal(t.image.height, 128);
  const d = textCanvasTexture(['A', 'B']);
  assert.equal(d.image.width, 512);
  assert.equal(d.image.height, 256);
});

test('textCanvasTexture: long text gets a smaller font, never below 14px', () => {
  const fontOf = t => t.image.getContext('2d').font;
  assert.equal(fontOf(textCanvasTexture(['Hi'])), 'bold 56px Georgia, serif');
  const long = fontOf(textCanvasTexture(['A very long name for a small sign'], { w: 300 }));
  const size = Number(long.match(/(\d+)px/)[1]);
  assert.ok(size < 56 && size >= 14, long);
  const huge = fontOf(textCanvasTexture(['x'.repeat(500)], { w: 100 }));
  assert.match(huge, /^bold 14px/);
});
