import { audioId } from './audioid.js';

// Plays pre-made voice files from audio/<id>.mp3.
// audio_manifest.json lists the files that exist, so missing files are never requested.
export class Voice {
  constructor() {
    this.available = new Set();
    this.el = new Audio();
    this.el.preload = 'auto';
    this.last = null;
    this.log = []; // ids played, for tests
  }

  async load() {
    try {
      const r = await fetch('audio_manifest.json');
      if (r.ok) this.available = new Set(await r.json());
    } catch (e) { /* no audio: text only */ }
  }

  idFor(line) {
    return line.audio || audioId(line.who || 'narrator', line.text);
  }

  // Calls onStart() when the sound really starts (or at once if there is no file).
  play(line, onStart) {
    const id = this.idFor(line);
    this.last = line;
    this.log.push(id);
    if (this.log.length > 300) this.log.shift();
    this.el.pause();
    if (!this.available.has(id)) { onStart?.(false); return; }
    let started = false;
    const start = () => { if (!started) { started = true; onStart?.(true); } };
    this.el.onplaying = start;
    this.el.onerror = start;
    this.el.src = `audio/${id}.mp3`;
    this.el.currentTime = 0;
    const p = this.el.play();
    if (p && p.catch) p.catch(start);
  }

  replay(onStart) {
    if (this.last) this.play(this.last, onStart);
  }

  stop() { this.el.pause(); }
}
