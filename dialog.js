import { speak } from './tts.js';

// Dialog box at the bottom of the screen. One sentence at a time. Space = next.
// Every line is spoken when it is shown.
export class Dialog {
  constructor(root) {
    this.root = root;
    this.nameEl = root.querySelector('.d-name');
    this.textEl = root.querySelector('.d-text');
    this.queue = [];
    this.current = null;
    this.warnings = [];
  }

  get open() { return this.current !== null; }

  // lines: array of [who, text] or {who, text}. onDone runs after the last line is dismissed.
  say(lines, onDone) {
    const items = lines.map(l => Array.isArray(l) ? { who: l[0], text: l[1] } : { ...l });
    if (!items.length) { onDone?.(); return; }
    items[items.length - 1].onDone = onDone;
    for (const it of items) {
      if (it.who === 'Buu' && it.text.split(/\s+/).length > 8) {
        const msg = `Buu line longer than 8 words: "${it.text}"`;
        this.warnings.push(msg);
        console.warn(msg);
      }
    }
    this.queue.push(...items);
    if (!this.current) this.showNext();
  }

  showNext() {
    this.current = this.queue.shift() || null;
    if (!this.current) {
      this.root.hidden = true;
      return;
    }
    const { who, text } = this.current;
    this.root.hidden = false;
    this.nameEl.textContent = who || '';
    this.nameEl.hidden = !who;
    // *word* = highlighted new word
    this.textEl.innerHTML = escapeHtml(text).replace(/\*(.+?)\*/g, '<b>$1</b>');
    speak(text);
  }

  next() {
    if (!this.current) return;
    const done = this.current.onDone;
    this.showNext();
    done?.();
  }

  clear() {
    this.queue = [];
    this.current = null;
    this.root.hidden = true;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
