// A small game object (G) for testing quest, power and night code without main.js.
import { installDom, FakeElement } from './fake-dom.js';
import { readJSON } from './data.js';

installDom();
const THREE = await import('three');
const { Picker } = await import('../../ui.js');
const { Learner } = await import('../../learn.js');
const { Grammar } = await import('../../grammar.js');

// Dialog stand-in. say() records lines; finish() dismisses everything (runs onDone callbacks in order).
export class FakeDialog {
  constructor() { this.said = []; this.waiting = []; this.cleared = 0; }
  get open() { return this.waiting.length > 0; }
  say(lines, onDone) {
    const ls = lines.filter(Boolean);
    this.said.push(...ls);
    if (!ls.length) { onDone?.(); return; }
    this.waiting.push(onDone || null);
  }
  finish() {
    for (let guard = 0; this.waiting.length && guard < 100; guard++) this.waiting.shift()?.();
  }
  clear() { this.waiting = []; this.cleared++; }
  get texts() { return this.said.map(l => l.text); }
  get last() { return this.said.at(-1); }
  reset() { this.said = []; }
}

export const data = {
  people: readJSON('villagers.json'),
  quests: readJSON('quests.json'),
  words: readJSON('words.json'),
  buu: readJSON('buu.json'),
  letters: readJSON('letters.json'),
};

export function npcStub(x = 0, z = 0) {
  return {
    group: new THREE.Group(), item: undefined, moving: false, torso: new THREE.Group(),
    setItem(c) { this.item = c; },
    faceToward(tx, tz) { const p = this.group.position; this.group.rotation.y = Math.atan2(tx - p.x, tz - p.z); },
    animate() {},
    init() { this.group.position.set(x, 0, z); this.home = { x, z }; return this; },
  }.init();
}

// Builds G. Pass parts to replace (power, dialog, headmaster...).
export function makeG(over = {}) {
  let saves = 0;
  const G = {
    started: true, clock: 0,
    people: Object.fromEntries(data.people.map(p => [p.id, p])),
    villagerData: Object.fromEntries(data.people.filter(p => p.house).map(p => [p.id, p])),
    quests: data.quests,
    buuLines: data.buu,
    state: { questsDone: 0, met: [], items: [], lettersRead: [], found: [], introDone: true },
    dialog: new FakeDialog(),
    reports: [], spawned: [], cleared: 0, dropped: 0, carrying: null,
    player: { pos: new THREE.Vector3(0, 0, 48) },
    dayNight: { t: 60, isNight: false },
  };
  G.persist = () => { saves++; };
  G.saves = () => saves;
  const pickerRoot = new FakeElement();
  pickerRoot.hidden = true;
  G.picker = new Picker(pickerRoot);
  G.openPanel = show => { G.closePanels(); show(); };
  G.closePanels = () => G.picker.close();
  G.modalOpen = () => G.picker.isOpen;
  G.meet = id => {
    if (!G.villagerData[id] || G.state.met.includes(id)) return [];
    G.state.met.push(id);
    return G.villagerData[id].lines.intro;
  };
  G.villagers = Object.fromEntries(data.people.filter(p => p.house).map((p, i) => [p.id, npcStub(i % 2 ? 11 : -11, 30 - i * 8)]));
  G.headmaster = { npc: npcStub(3, -31.5), daySpot: { x: 3, z: -31.5 } };
  G.spawnFetch = names => { G.spawned.push(names); };
  G.clearFetch = () => { G.cleared++; G.carrying = null; };
  G.dropCarried = () => { G.dropped++; G.carrying = null; };
  G.writeReport = (q, answers) => G.reports.push({ quest: q.id, answers: { ...answers } });
  G.power = { caught: [], onCatch(id, done) { this.caught.push(id); done(); }, lineFor: l => l };
  G.learner = new Learner(data.words, G.state, G.persist);
  Object.assign(G, over);
  G.grammar = over.grammar || new Grammar(G);
  G.learner.onRecord = ok => {
    G.grammar.record(ok);
    if (G.quest?.answers) G.quest.answers[ok ? 'correct' : 'wrong']++;
  };
  return G;
}

// Text of the open picker's buttons.
export const pickerOptions = G => G.picker.buttons.map(b => b.textContent);
export const pickOption = (G, label) => {
  const i = pickerOptions(G).indexOf(label);
  if (i < 0) throw new Error(`no option ${label}: ${pickerOptions(G)}`);
  G.picker.pick(i);
};
