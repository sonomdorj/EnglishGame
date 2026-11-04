// Integration: the real game modules wired together the same way main.js does it
// (Dialog + Voice + Grammar + Power + Learner + QuestRunner + Picker + World + DayNight + Headmaster + save).
// Only the browser parts (DOM, audio element, localStorage) are fakes.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, FakeElement, fakeStorage } from '../unit/fake-dom.js';
import { readJSON, withRandom } from '../unit/data.js';

installDom();
globalThis.Audio = class { pause() {} play() { return Promise.resolve(); } };
const THREE = await import('three');
const { Dialog } = await import('../../dialog.js');
const { Voice } = await import('../../audio.js');
const { Picker } = await import('../../ui.js');
const { Learner } = await import('../../learn.js');
const { Grammar } = await import('../../grammar.js');
const { Power } = await import('../../power.js');
const { QuestRunner } = await import('../../quest.js');
const { DayNight, Headmaster } = await import('../../night.js');
const { World, HOUSES, GATE_SPAWN } = await import('../../world.js');
const { Human, Panda } = await import('../../npc.js');
const { loadSave, writeSave } = await import('../../save.js');
const { CONFIG } = await import('../../config.js');

const people = readJSON('villagers.json'), quests = readJSON('quests.json'), words = readJSON('words.json'), buu = readJSON('buu.json');

// One village for all tests (building it is the slow part).
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 1, 2);
const world = new World(scene);
world.build();

// Same wiring as init() in main.js.
function boot() {
  const G = { started: true, clock: 0, reports: [] };
  const villagers = people.filter(v => v.house);
  G.people = Object.fromEntries(people.map(v => [v.id, v]));
  G.buuLines = buu;
  G.voice = new Voice();
  G.villagerList = villagers;
  G.villagerData = Object.fromEntries(villagers.map(v => [v.id, v]));
  G.quests = quests;
  G.state = Object.assign({ questsDone: 0, met: [], items: [], lettersRead: [], found: [], introDone: false }, loadSave());
  G.persist = () => writeSave(G.state);
  G.learner = new Learner(words, G.state, G.persist);
  G.scene = scene;
  G.camera = new THREE.PerspectiveCamera();
  G.hemi = new THREE.HemisphereLight();
  G.sun = new THREE.DirectionalLight();
  G.world = world;
  G.houseById = Object.fromEntries(HOUSES.map(h => [h.id, h]));
  G.player = { pos: new THREE.Vector3(GATE_SPAWN.x, 0, GATE_SPAWN.z), vel: new THREE.Vector3(), r: 0.3, h: 1.7 };
  G.dayNight = new DayNight(G);
  G.villagers = {};
  for (const v of villagers) {
    const h = G.houseById[v.house];
    const npc = new Human({ id: v.id, name: v.name });
    npc.group.position.set(h.villagerSpot.x, 0, h.villagerSpot.z);
    npc.home = { ...h.villagerSpot };
    G.villagers[v.id] = npc;
  }
  G.buu = new Panda();
  G.headmaster = new Headmaster(G);
  const dialogRoot = new FakeElement();
  dialogRoot.hidden = true;
  G.dialog = new Dialog(dialogRoot, G.voice, w => G.people[w]?.name || '', line => G.power.lineFor(G.grammar.pick(line)));
  G.power = new Power(G);
  G.grammar = new Grammar(G);
  G.learner.onRecord = ok => {
    G.grammar.record(ok);
    if (G.quest.answers) G.quest.answers[ok ? 'correct' : 'wrong']++;
  };
  const pickerRoot = new FakeElement();
  pickerRoot.hidden = true;
  G.picker = new Picker(pickerRoot);
  G.bookEl = new FakeElement();
  G.bookEl.hidden = true;
  G.quest = new QuestRunner(G);
  G.modalOpen = () => G.picker.isOpen || !G.bookEl.hidden;
  G.openPanel = show => { G.closePanels(); show(); };
  G.closePanels = () => { G.picker.close(); G.bookEl.hidden = true; };
  G.meet = id => {
    if (!G.villagerData[id] || G.state.met.includes(id)) return [];
    G.state.met.push(id);
    G.persist();
    return G.villagerData[id].lines.intro;
  };
  G.writeReport = (q, answers) => G.reports.push({ quest: q.id, answers: { ...answers } });
  G.fetchItems = [];
  G.carrying = null;
  G.spawnFetch = names => { G.fetchItems = names.map(name => ({ name })); };
  G.clearFetch = () => { G.fetchItems = []; G.carrying = null; };
  G.dropCarried = () => { G.carrying = null; };
  G.teleportPlayer = spot => { G.player.pos.set(spot.x, spot.y, spot.z); G.teleported = (G.teleported || 0) + 1; };
  return G;
}

// Space until the dialog is closed. Returns the texts shown (as the player sees them).
function drain(G, max = 200) {
  const shown = [];
  for (let i = 0; i < max && G.dialog.open; i++) { shown.push(G.dialog.current.text); G.dialog.next(); }
  return shown;
}
const tick = (G, sec, dt = 0.1) => {
  for (let t = 0; t < sec; t += dt) { G.clock += dt; G.dayNight.update(dt); G.headmaster.update(dt); G.power.update(dt); G.quest.update(dt); }
};
const clickOption = (G, label) => G.picker.pick(G.picker.buttons.findIndex(b => b.textContent === label));

// Plays the current case like a player. Returns { q, shown }.
function playCase(G, { wrongFirst = 0, pickNick = 0 } = {}) {
  const shown = [];
  for (let i = 0; i < 100 && G.quest.stage !== 'toA'; i++) { tick(G, 0.5); shown.push(...drain(G)); }
  assert.equal(G.quest.stage, 'toA');
  const q = G.quest.q;
  G.quest.talkVillager(q.a); shown.push(...drain(G));
  G.quest.talkVillager(q.b); shown.push(...drain(G));
  assert.equal(G.picker.isOpen, true);
  const W = G.picker.buttons.map(b => b.textContent);
  for (let i = 0; i < wrongFirst; i++) { clickOption(G, W.find(w => w !== q.weekday)); shown.push(...drain(G)); }
  clickOption(G, q.weekday); shown.push(...drain(G));
  G.quest.talkVillager(q.liar); shown.push(...drain(G));
  if (G.quest.nicknameOpen) { G.picker.pick(pickNick); shown.push(...drain(G)); }
  assert.equal(G.quest.stage, 'fetch');
  G.carrying = G.quest.fetchWord;
  G.quest.talkBuu(); shown.push(...drain(G));
  return { q, shown };
}

beforeEach(() => { globalThis.localStorage = fakeStorage(); });

test('new game: intro, then case 1 to the end, saved', () => {
  const G = boot();
  withRandom([0.2, 0.6, 0.9, 0.4], () => {
    tick(G, 0.2);
    assert.equal(G.quest.stage, 'intro');
    const intro = drain(G);
    assert.deepEqual(intro, buu.intro.map(l => l.text));
    const { q, shown } = playCase(G);
    assert.equal(q.id, 1);
    // The player hears A's intro (first meeting), A's claim, B's claim, the verdict and "Correct. Next."
    for (const l of [...G.villagerData[q.a].lines.intro, ...q.lines.claimA, ...q.lines.claimB, ...q.lines.verdict]) assert.ok(shown.includes(l.text), l.text);
    assert.ok(shown.includes(buu.correctNext.text));
  });
  assert.equal(G.state.questsDone, 1);
  assert.deepEqual(G.state.items, ['bread']);
  assert.deepEqual(G.state.catches, { batbayar: 1 });
  assert.deepEqual(G.reports, [{ quest: 1, answers: { correct: 2, wrong: 0 } }]);
  // Saved to localStorage by persist().
  const saved = JSON.parse(localStorage.getItem('nameKeeper.save.v1'));
  assert.equal(saved.questsDone, 1);
  assert.equal(saved.introDone, true);
  assert.ok(saved.known.length >= quests[0].words.length);
  assert.equal(G.quest.timer, CONFIG.nextCaseDelaySec);
});

test('reload: the save restores progress and the next case starts', () => {
  const G = boot();
  withRandom([0.3, 0.8], () => { tick(G, 0.2); drain(G); playCase(G); });
  const known = [...G.state.known];
  const H = boot();
  assert.equal(H.state.questsDone, 1);
  assert.equal(H.state.introDone, true);
  assert.deepEqual(H.state.known, known);
  assert.deepEqual(H.state.met.sort(), [...G.state.met].sort());
  H.quest.timer = 0;
  tick(H, 0.2);
  assert.equal(H.quest.stage, 'toA');
  assert.equal(H.quest.q.id, 2);
});

test('broken save: a new game starts', () => {
  localStorage.setItem('nameKeeper.save.v1', '{oops');
  const G = boot();
  assert.equal(G.state.questsDone, 0);
  assert.equal(G.state.introDone, false);
});

test('3 catches: nickname picked, then every Buu line uses it', () => {
  localStorage.setItem('nameKeeper.save.v1', JSON.stringify({ introDone: true, catches: { batbayar: 2 } }));
  const G = boot();
  const nick = G.people.batbayar.nicknames[1];
  const { shown } = withRandom([0.5], () => playCase(G, { pickNick: 1 }));
  assert.equal(G.state.nicknames.batbayar, nick);
  assert.ok(shown.includes(buu.nickOk[nick].text));
  // Buu's line through the real dialog swap.
  G.dialog.say([buu.talkTo.batbayar]);
  assert.equal(G.dialog.current.text, `Talk to ${nick}.`);
  assert.equal(G.dialog.textEl.innerHTML, `Talk to ${nick}.`);
  drain(G);
  // Saved: after reload Buu still uses it.
  const H = boot();
  H.dialog.say([buu.talkTo.batbayar]);
  assert.equal(H.dialog.current.text, `Talk to ${nick}.`);
});

test('arc 4: past tense lines are said only after 5 correct answers in a row', () => {
  localStorage.setItem('nameKeeper.save.v1', JSON.stringify({ introDone: true, questsDone: 30 }));
  const G = boot();
  G.quest.timer = 0;
  tick(G, 0.2);
  assert.equal(G.quest.q.arc, 4);
  drain(G);
  const ask = G.quest.q.lines.ask[0];
  G.dialog.say([ask]);
  assert.match(G.dialog.current.text, /^What day is /);
  drain(G);
  for (let i = 0; i < 5; i++) G.learner.record(true);
  assert.equal(G.state.grammar.past, true);
  G.dialog.say([ask]);
  assert.match(G.dialog.current.text, /^What day was /);
  drain(G);
});

test('2 wrong weekday answers: level down and the next case reuses known words', () => {
  localStorage.setItem('nameKeeper.save.v1', JSON.stringify({ introDone: true, level: 3 }));
  const G = boot();
  withRandom([0.1, 0.5, 0.7], () => playCase(G, { wrongFirst: 2 }));
  assert.equal(G.state.level, 2);
  assert.deepEqual(G.reports[0].answers, { correct: 2, wrong: 2 });
  const known = new Set(G.state.known);
  const before = G.state.known.length;
  G.quest.timer = 0;
  tick(G, 0.2);
  assert.ok(G.quest.newWords.every(w => known.has(w.word)), 'only known words');
  assert.equal(G.state.known.length, before, 'no new words learned');
  assert.equal(G.state.reuseNext, false);
});

test('5 catches: the adult misses the market that day', () => {
  localStorage.setItem('nameKeeper.save.v1', JSON.stringify({ introDone: true, catches: { batbayar: 4 } }));
  const G = boot();
  const { shown } = withRandom([0.5], () => playCase(G));
  assert.ok(shown.includes(buu.lockout.batbayar.text));
  assert.equal(G.power.isLocked('batbayar'), true);
  G.dayNight.t = 101;
  for (let i = 0; i < 400; i++) { G.power.update(0.1); drain(G); }
  const b = G.villagers.batbayar, d = G.villagers.dulamsuren;
  assert.ok(b.group.position.distanceTo(new THREE.Vector3(b.home.x, 0, b.home.z)) < 0.01, 'stays home');
  assert.ok(Math.hypot(d.group.position.x + 5.5, d.group.position.z - 6.5) < 0.01, 'others go');
});

test('night in the real village: the headmaster catches a player on his road', () => {
  const G = boot();
  G.state.introDone = true;
  G.dayNight.t = CONFIG.dayLengthSec + 1;
  tick(G, 0.1);
  assert.equal(G.dayNight.isNight, true);
  assert.equal(G.headmaster.lantern.intensity, 6);
  // Stand on the road ahead of him.
  const first = G.headmaster.route[0];
  G.player.pos.set(first.x, 0, first.z);
  for (let i = 0; i < 600 && !G.teleported; i++) { drain(G); tick(G, 0.1); }
  assert.equal(G.teleported, 1);
  assert.ok(G.player.pos.equals(new THREE.Vector3(GATE_SPAWN.x, GATE_SPAWN.y, GATE_SPAWN.z)));
  assert.ok(G.people.headmaster.lines.caught.map(l => l.text).includes(G.dialog.current.text));
});

test('night in the real village: a player inside a house is safe', () => {
  const G = boot();
  G.dayNight.t = CONFIG.dayLengthSec + 1;
  const h = G.houseById.h2;
  G.player.pos.set(h.x - 2, 0, h.z - 2); // bedroom
  for (let i = 0; i < 400; i++) { tick(G, 0.1); drain(G); }
  assert.equal(G.teleported, undefined);
});

test('a full day-night cycle adds one game day', () => {
  const G = boot();
  G.state.introDone = true;
  G.quest.stage = 'done'; // no case starts
  const day0 = G.state.day;
  for (let i = 0; i < (CONFIG.dayLengthSec + CONFIG.nightLengthSec) / 0.5 + 2; i++) { tick(G, 0.5, 0.5); drain(G); }
  assert.equal(G.state.day, day0 + 1);
});
