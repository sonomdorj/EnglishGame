// Small browser stand-ins so game modules can run in Node.
// Canvas 2D: every method is a no-op; a few return what the code reads.

function ctx2d() {
  const gradient = { addColorStop() {} };
  const special = {
    measureText: t => ({ width: String(t).length * 20 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  };
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in special) return special[k];
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

export class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.hidden = false;
    this.textContent = '';
    this._html = '';
    this.listeners = {};
    this.parts = {};
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; if (v === '') this.children = []; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  click() { for (const fn of this.listeners.click || []) fn({ type: 'click' }); }
  querySelector(sel) { return this.parts[sel] ??= new FakeElement(); }
  getContext() { return this._ctx ??= ctx2d(); }
}

export function installDom() {
  if (globalThis.document?.__fake) return globalThis.document;
  const doc = {
    __fake: true,
    createElement: tag => {
      const el = new FakeElement(tag);
      if (tag === 'canvas') { el.width = 300; el.height = 150; }
      return el;
    },
  };
  globalThis.document = doc;
  return doc;
}

// Fake localStorage. `fail` makes every call throw (blocked storage).
export function fakeStorage({ fail = false } = {}) {
  const m = new Map();
  const guard = () => { if (fail) throw new Error('storage blocked'); };
  return {
    map: m,
    getItem: k => { guard(); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { guard(); m.set(k, String(v)); },
    removeItem: k => { guard(); m.delete(k); },
    clear: () => { guard(); m.clear(); },
  };
}
