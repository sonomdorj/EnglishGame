import { CONFIG } from './config.js';

// Dialog box at the bottom of the screen. One sentence at a time. Space = next.
// Each line plays its voice file. The text appears CONFIG.textDelaySec after the voice starts.
// R replays the last line.
export class Dialog {
  constructor(root, voice, nameOf) {
    this.root = root;
    this.voice = voice;
    this.nameOf = nameOf;
    this.nameEl = root.querySelector('.d-name');
    this.textEl = root.querySelector('.d-text');
    this.queue = [];
    this.current = null;
    this.warnings = [];
    this.timer = null;
    this.shownAt = 0;
  }

  get open() { return this.current !== null; }
  get textVisible() { return this.textEl.style.visibility !== 'hidden'; }

  // lines: array of { who, text, audio }. onDone runs after the last line is dismissed.
  say(lines, onDone) {
    const items = lines.filter(Boolean).map(l => ({ ...l }));
    if (!items.length) { onDone?.(); return; }
    items[items.length - 1].onDone = onDone;
    for (const it of items) {
      if (it.who === 'buu' && it.text.split(/\s+/).length > 8) {
        const msg = `Buu line longer than 8 words: "${it.text}"`;
        this.warnings.push(msg);
        console.warn(msg);
      }
    }
    this.queue.push(...items);
    if (!this.current) this.showNext();
  }

  showNext() {
    clearTimeout(this.timer);
    this.current = this.queue.shift() || null;
    if (!this.current) {
      this.root.hidden = true;
      this.voice.stop();
      return;
    }
    const line = this.current;
    this.root.hidden = false;
    const name = this.nameOf(line.who);
    this.nameEl.textContent = name;
    this.nameEl.hidden = !name;
    this.textEl.innerHTML = escapeHtml(line.text).replace(/\*(.+?)\*/g, '<b>$1</b>');
    this.hideText();
    this.voice.play(line, () => this.revealLater(line));
  }

  hideText() {
    clearTimeout(this.timer);
    this.textEl.style.visibility = 'hidden';
  }

  revealLater(line) {
    clearTimeout(this.timer);
    this.voiceStartAt = performance.now();
    this.timer = setTimeout(() => {
      if (this.current === line) {
        this.textEl.style.visibility = 'visible';
        this.shownAt = performance.now();
      }
    }, CONFIG.textDelaySec * 1000);
  }

  // R key
  replay() {
    if (this.current) {
      this.hideText();
      this.voice.play(this.current, () => this.revealLater(this.current));
    } else {
      this.voice.replay();
    }
  }

  next() {
    if (!this.current) return;
    const done = this.current.onDone;
    this.showNext();
    done?.();
  }

  clear() {
    clearTimeout(this.timer);
    this.queue = [];
    this.current = null;
    this.root.hidden = true;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
