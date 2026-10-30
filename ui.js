import { WEEKDAYS, MONTHS, daysInMonth, weekdayIndex, parseDMY, formatFull } from './dates.js';

// Center panel: a title, an optional calendar, and answer buttons.
export class Picker {
  constructor(root) {
    this.root = root;
    this.titleEl = root.querySelector('.p-title');
    this.bodyEl = root.querySelector('.p-body');
    this.optEl = root.querySelector('.p-options');
    this.cfg = null;
  }

  get isOpen() { return !this.root.hidden; }

  // cfg: { title, cal: {y, m} | null, options: [label], onPick(index, button), extra: [{ label, onClick }], onClose }
  open(cfg) {
    this.cfg = cfg;
    this.root.hidden = false;
    this.titleEl.textContent = cfg.title;
    this.bodyEl.innerHTML = '';
    if (cfg.cal) {
      this.calY = cfg.cal.y; this.calM = cfg.cal.m;
      this.calEl = document.createElement('div');
      this.bodyEl.appendChild(this.calEl);
      this.renderCal();
    }
    for (const ex of cfg.extra || []) {
      const b = document.createElement('button');
      b.textContent = ex.label;
      b.addEventListener('click', ex.onClick);
      const wrap = document.createElement('div');
      wrap.style.textAlign = 'center';
      wrap.appendChild(b);
      this.bodyEl.appendChild(wrap);
    }
    this.optEl.innerHTML = '';
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

  close() {
    if (this.root.hidden) return;
    this.root.hidden = true;
    const cb = this.cfg?.onClose;
    this.cfg = null;
    cb?.();
  }

  renderCal() {
    const y = this.calY, m = this.calM;
    const first = weekdayIndex(1, m, y);
    const n = daysInMonth(y, m);
    let html = `<div class="cal-nav"><button data-d="-1">&lt;</button>
      <span class="cal-month">${MONTHS[m - 1]} ${y}</span><button data-d="1">&gt;</button></div>
      <div class="cal-nav"><button data-d="-120">-10 years</button><button data-d="-12">-1 year</button>
      <button data-d="12">+1 year</button><button data-d="120">+10 years</button></div>
      <table class="cal"><tr>${WEEKDAYS.map(w => `<th>${w}</th>`).join('')}</tr><tr>`;
    for (let c = 0; c < first; c++) html += '<td></td>';
    for (let d = 1; d <= n; d++) {
      html += `<td>${d}</td>`;
      if ((first + d) % 7 === 0 && d < n) html += '</tr><tr>';
    }
    const tail = (7 - ((first + n) % 7)) % 7;
    for (let c = 0; c < tail; c++) html += '<td></td>';
    html += '</tr></table>';
    this.calEl.innerHTML = html;
    this.calEl.querySelectorAll('button[data-d]').forEach(b => b.addEventListener('click', () => {
      let idx = this.calY * 12 + (this.calM - 1) + Number(b.dataset.d);
      idx = Math.max(1900 * 12, Math.min(2099 * 12 + 11, idx));
      this.calY = Math.floor(idx / 12); this.calM = idx % 12 + 1;
      this.renderCal();
    }));
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
    html += `<div class="person">
      <div class="pname">${v.name}</div>
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
