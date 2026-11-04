import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeG, data, pickOption, pickerOptions } from './fake-game.js';
import { Power, MARKET_SPOT, MARKET_FROM, MARKET_TO } from '../../power.js';

function setup(state = {}) {
  const G = makeG();
  Object.assign(G.state, state);
  G.quest = { nicknameOpen: false };
  G.power = new Power(G);
  return G;
}
const run = (G, sec, dt = 0.1) => { for (let t = 0; t < sec; t += dt) G.power.update(dt); };
const at = (npc, [x, z]) => Math.hypot(npc.group.position.x - x, npc.group.position.z - z) < 1e-6;

test('constructor adds empty power state, keeps saved state', () => {
  const G = setup();
  assert.deepEqual(G.state.catches, {});
  assert.deepEqual(G.state.nicknames, {});
  assert.deepEqual(G.state.lockouts, {});
  assert.equal(G.state.day, 0);
  const S = setup({ catches: { batbayar: 2 }, day: 4 });
  assert.equal(S.power.count('batbayar'), 2);
  assert.equal(S.state.day, 4);
});

test('isAdult, count', () => {
  const G = setup();
  assert.equal(G.power.isAdult('batbayar'), true);
  assert.equal(G.power.isAdult('headmaster'), true);
  assert.equal(G.power.isAdult('oyunaa'), false);
  assert.equal(G.power.isAdult('nobody'), false);
  assert.equal(G.power.count('batbayar'), 0);
});

test('market spots: one per adult, all adults', () => {
  const adults = data.people.filter(p => p.adult).map(p => p.id).sort();
  assert.deepEqual(Object.keys(MARKET_SPOT).sort(), adults);
  assert.ok(MARKET_FROM < MARKET_TO);
});

test('lineFor: Buu says the chosen nickname', () => {
  const G = setup();
  const line = data.buu.talkTo.batbayar;
  assert.equal(G.power.lineFor(line), line);
  G.state.nicknames.batbayar = 'Iron Nose';
  assert.equal(G.power.lineFor(line).text, 'Talk to Iron Nose.');
  assert.equal(G.power.lineFor(data.buu.talkTo.dulamsuren), data.buu.talkTo.dulamsuren, 'other adult unchanged');
  const villagerLine = { who: 'batbayar', text: 'x', nick: { 'Iron Nose': { who: 'batbayar', text: 'y' } } };
  assert.equal(G.power.lineFor(villagerLine), villagerLine, 'only Buu uses nicknames');
  assert.equal(G.power.lineFor(null), null);
});

test('onCatch: children are not counted', () => {
  const G = setup();
  let done = 0;
  G.power.onCatch('oyunaa', () => done++);
  assert.equal(done, 1);
  assert.deepEqual(G.state.catches, {});
});

test('onCatch 1 and 2: counted, continue at once', () => {
  const G = setup();
  let done = 0;
  G.power.onCatch('batbayar', () => done++);
  G.power.onCatch('batbayar', () => done++);
  assert.equal(done, 2);
  assert.equal(G.state.catches.batbayar, 2);
  assert.ok(G.saves() >= 2);
});

test('onCatch 3: nickname panel that cannot be closed; pick = Buu remembers', () => {
  const G = setup({ catches: { batbayar: 2 } });
  let done = 0;
  G.power.onCatch('batbayar', () => done++);
  assert.equal(done, 0);
  assert.equal(G.picker.isOpen, true);
  assert.equal(G.quest.nicknameOpen, true);
  assert.equal(G.picker.titleEl.textContent, 'A name for Batbayar?');
  assert.deepEqual(pickerOptions(G), G.people.batbayar.nicknames);
  G.picker.close();
  assert.equal(G.picker.isOpen, true, 'not closable');
  pickOption(G, 'Mister Friday');
  assert.equal(G.picker.isOpen, false);
  assert.equal(G.quest.nicknameOpen, false);
  assert.equal(G.state.nicknames.batbayar, 'Mister Friday');
  assert.equal(G.dialog.last, data.buu.nickOk['Mister Friday']);
  G.dialog.finish();
  assert.equal(done, 1);
});

test('onCatch 5 in the day: locked out today; at night: locked out tomorrow', () => {
  const G = setup({ catches: { tsetseg: 4 }, day: 2 });
  let done = 0;
  G.power.onCatch('tsetseg', () => done++);
  assert.equal(G.state.lockouts.tsetseg, 2);
  assert.equal(G.power.isLocked('tsetseg'), true);
  assert.equal(G.dialog.last, data.buu.lockout.tsetseg);
  G.dialog.finish();
  assert.equal(done, 1);
  G.state.day = 3;
  assert.equal(G.power.isLocked('tsetseg'), false, 'only one day');

  const N = setup({ catches: { ganbold: 4 }, day: 2 });
  N.dayNight.isNight = true;
  N.power.onCatch('ganbold', () => {});
  assert.equal(N.state.lockouts.ganbold, 3);
  assert.equal(N.power.isLocked('ganbold'), false);
});

test('onCatch 4 and 6+: nothing special', () => {
  const G = setup({ catches: { ganbold: 3 } });
  let done = 0;
  G.power.onCatch('ganbold', () => done++);
  G.power.onCatch('ganbold', () => done++); // 5: lockout
  G.dialog.finish();
  G.power.onCatch('ganbold', () => done++);
  assert.equal(done, 3);
  assert.equal(G.state.catches.ganbold, 6);
  assert.equal(G.picker.isOpen, false);
});

test('day counter: +1 each time the cycle starts again', () => {
  const G = setup();
  G.dayNight.t = 300; G.power.update(0.1);
  G.dayNight.t = 350; G.power.update(0.1);
  assert.equal(G.state.day, 0);
  G.dayNight.t = 1; G.power.update(0.1);
  assert.equal(G.state.day, 1);
  G.dayNight.t = 2; G.power.update(0.1);
  assert.equal(G.state.day, 1);
});

test('market time: adults walk to the market by the road, and home after', () => {
  const G = setup();
  const npc = G.villagers.batbayar, home = { ...npc.home };
  G.dayNight.t = MARKET_FROM;
  G.power.update(0.1);
  assert.equal(npc.moving, true);
  const roadX = home.x < 0 ? -2 : 2;
  run(G, 4);
  assert.ok(Math.abs(npc.group.position.z - home.z) < 1e-6, 'first along x to the road');
  run(G, 40);
  assert.ok(at(npc, MARKET_SPOT.batbayar));
  assert.equal(npc.moving, false);
  G.dayNight.t = MARKET_TO;
  run(G, 40);
  assert.ok(at(npc, [home.x, home.z]));
  assert.equal(G.power.walkers.batbayar.goal, 'home');
  assert.ok(roadX);
});

test('market: everyone with a spot goes; the child stays home', () => {
  const G = setup();
  G.dayNight.t = MARKET_FROM + 1;
  run(G, 60);
  for (const id of Object.keys(MARKET_SPOT)) {
    const npc = id === 'headmaster' ? G.headmaster.npc : G.villagers[id];
    assert.ok(at(npc, MARKET_SPOT[id]), id);
  }
  assert.ok(at(G.villagers.oyunaa, [G.villagers.oyunaa.home.x, G.villagers.oyunaa.home.z]));
});

test('market: nobody moves while a dialog or panel is open', () => {
  const G = setup();
  G.dayNight.t = MARKET_FROM;
  G.dialog.say([{ who: 'buu', text: 'x' }]);
  const p = G.villagers.batbayar.group.position.clone();
  run(G, 5);
  assert.ok(G.villagers.batbayar.group.position.equals(p));
  G.dialog.finish();
  G.picker.open({ title: 't', options: [] });
  run(G, 5);
  assert.ok(G.villagers.batbayar.group.position.equals(p));
});

test('market: a locked-out adult stays home; the headmaster stays put at night', () => {
  const G = setup({ lockouts: { batbayar: 0 } });
  G.dayNight.t = MARKET_FROM;
  run(G, 60);
  const b = G.villagers.batbayar;
  assert.ok(at(b, [b.home.x, b.home.z]));
  const N = setup();
  N.dayNight.t = MARKET_FROM;
  N.dayNight.isNight = true;
  const hp = N.headmaster.npc.group.position.clone();
  run(N, 20);
  assert.ok(N.headmaster.npc.group.position.equals(hp));
  assert.ok(at(N.villagers.batbayar, [N.villagers.batbayar.home.x, N.villagers.batbayar.home.z]), 'no market at night');
});

test('route: empty when already there', () => {
  const G = setup();
  const npc = G.villagers.dulamsuren;
  assert.deepEqual(G.power.route('dulamsuren', npc.home, 'home'), []);
  assert.equal(G.power.route('dulamsuren', npc.home, 'market').length, 3);
  npc.group.position.set(...[MARKET_SPOT.dulamsuren[0], 0, MARKET_SPOT.dulamsuren[1]]);
  assert.deepEqual(G.power.route('dulamsuren', npc.home, 'market'), []);
  assert.deepEqual(G.power.route('dulamsuren', npc.home, 'home').at(-1), [npc.home.x, npc.home.z]);
});

test('headmaster bows to a player who caught him 3 times', () => {
  const G = setup({ catches: { headmaster: 3 } });
  const hm = G.headmaster.npc;
  G.player.pos.set(hm.group.position.x + 2, 0, hm.group.position.z);
  G.power.update(0.1);
  assert.equal(G.bows, 1);
  assert.ok(Math.abs(hm.group.rotation.y - Math.PI / 2) < 1e-6, 'faces the player');
  run(G, 0.7);
  assert.ok(hm.torso.rotation.x > 0.4);
  run(G, 1);
  assert.equal(hm.torso.rotation.x, 0);
  run(G, 5);
  assert.equal(G.bows, 1, 'cooldown 8 s');
  run(G, 3);
  assert.equal(G.bows, 2);
  assert.ok(G.bowMax > 0.55 && G.bowMax <= 0.6);
});

test('no bow: fewer than 3 catches, far away, or at night', () => {
  for (const [catches, dist, night] of [[2, 2, false], [3, 5, false], [3, 2, true]]) {
    const G = setup({ catches: { headmaster: catches } });
    G.dayNight.isNight = night;
    const p = G.headmaster.npc.group.position;
    G.player.pos.set(p.x + dist, 0, p.z);
    run(G, 2);
    assert.equal(G.bows, undefined, `${catches} ${dist} ${night}`);
  }
});
