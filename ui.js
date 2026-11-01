import { WEEKDAYS, parseDMY, formatFull } from './dates.js';

export { WEEKDAYS };

// Center panel: a title and answer buttons.
export class Picker {
  constructor(root) {
    this.root = root;
    this.titleEl = root.querySelector('.p-title');
    this.bodyEl = root.querySelector('.p-body');
    this.optEl = root.querySelector('.p-options');
    this.cfg = null;
  }

  get isOpen() { return !this.root.hidden; }

  // cfg: { title, options: [label], onPick(index, button), onClose, closable }
  open(cfg) {
    this.cfg = cfg;
    this.root.hidden = false;
    this.titleEl.textContent = cfg.title;
    this.bodyEl.innerHTML = '';
    this.optEl.innerHTML = '';
    this.root.querySelector('.p-foot').hidden = cfg.closable === false;
    this.buttons = (cfg.options || []).map((label, i) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.index = i;
      b.addEventListener('click', () => this.pick(i));
      this.optEl.appendChild(b);
      return b;
    });
  }

  pick(i) {
    const b = this.buttons?.[i];
    if (!b || !this.cfg?.onPick) return;
    this.cfg.onPick(i, b);
  }

  close(force = false) {
    if (this.root.hidden) return;
    if (this.cfg?.closable === false && !force) return;
    this.root.hidden = true;
    const cb = this.cfg?.onClose;
    this.cfg = null;
    cb?.();
  }
}

// Family Book: villagers the player has met.
export function renderBook(root, villagers, state, lostTotal = 12) {
  const byId = Object.fromEntries(villagers.map(v => [v.id, v]));
  const met = villagers.filter(v => state.met.includes(v.id));
  let html = '<h2>Family Book</h2>';
  if (!met.length) html += '<p>You have not met anyone yet. Walk to a villager and press E.</p>';
  for (const v of met) {
    const kids = v.children.map(id => byId[id]?.name || id);
    const nick = state.nicknames?.[v.id];
    html += `<div class="person">
      <div class="pname">${v.name}${nick ? ` ("${nick}")` : ''}</div>
      <div>Job: ${v.job}</div>
      <div>Born: ${formatFull(parseDMY(v.birthday))}</div>
      <div>Father: ${v.father}</div>
      <div>Mother: ${v.mother}</div>
      <div>Children: ${kids.length ? kids.join(', ') : 'none'}</div>
    </div>`;
  }
  const notMet = villagers.length - met.length;
  html += '<div class="book-foot">';
  if (notMet) html += `<div>Not met yet: ${notMet} ${notMet === 1 ? 'person' : 'people'}.</div>`;
  if (state.items.length) html += `<div>Things you took: ${state.items.join(', ')}.</div>`;
  html += `<div>Letters read: ${state.lettersRead.length} of 6.</div>`;
  html += `<div>Lost things found: ${(state.found || []).length} of ${lostTotal}${state.found?.length ? ` (${state.found.join(', ')})` : ''}.</div>`;
  html += '<div>Press B or Esc to close.</div></div>';
  root.innerHTML = html;
}
