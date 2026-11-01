import * as THREE from 'three';
import { CONFIG } from './config.js';

// Market hours inside the day (seconds from the start of the day).
const MARKET_FROM = 100, MARKET_TO = 190;
// Where each adult stands at the market.
const MARKET_SPOT = {
  batbayar: [-5.5, -6.5], dulamsuren: [-5.5, 6.5], enkhjargal: [5.5, 6.5],
  tsetseg: [5.5, -6.5], ganbold: [3.5, 8.6], headmaster: [-3.5, -8.6],
};

// Power over adults the player caught lying.
// 1 catch: the player takes one item (the penalty).
// 3 catches: the player picks a nickname. Buu uses it forever.
// 5 catches: the adult cannot go to the market for one game day.
// Headmaster with 3+ catches bows when the player passes.
export class Power {
  constructor(G) {
    this.G = G;
    const s = G.state;
    s.catches ??= {};
    s.nicknames ??= {};
    s.lockouts ??= {};
    s.day ??= 0;
    this.walkers = {};
    this.bow = { t: 0, cooldown: 0 };
  }

  isAdult(id) { return !!this.G.people[id]?.adult; }
  count(id) { return this.G.state.catches[id] || 0; }
  isLocked(id) { return this.G.state.lockouts[id] === this.G.state.day; }

  // Buu says a nickname instead of the real name, once the player picked one.
  lineFor(line) {
    if (!line || line.who !== 'buu' || !line.nick) return line;
    for (const n of Object.values(this.G.state.nicknames)) if (line.nick[n]) return line.nick[n];
    return line;
  }

  // Called after the player takes the penalty from a caught liar. done() continues the quest.
  onCatch(id, done) {
    const G = this.G, s = G.state;
    if (!this.isAdult(id)) return done();
    const n = s.catches[id] = this.count(id) + 1;
    G.persist();
    if (n === 3) return this.askNickname(id, done);
    if (n === 5) {
      s.lockouts[id] = G.dayNight.isNight ? s.day + 1 : s.day;
      G.persist();
      return G.dialog.say([G.buuLines.lockout[id]], done);
    }
    done();
  }

  askNickname(id, done) {
    const G = this.G;
    const p = G.people[id];
    G.quest.nicknameOpen = true;
    G.openPanel(() => G.picker.open({
      title: `A name for ${p.name.split(' ')[0]}?`,
      options: p.nicknames,
      closable: false,
      onPick: i => {
        G.state.nicknames[id] = p.nicknames[i];
        G.persist();
        G.quest.nicknameOpen = false;
        G.picker.close(true);
        G.dialog.say([G.buuLines.nickOk[p.nicknames[i]]], done);
      },
    }));
  }

  // ---- day counter and market visits ----
  update(dt) {
    const G = this.G, dn = G.dayNight;
    if (this.lastT !== undefined && dn.t < this.lastT) { G.state.day++; G.persist(); }
    this.lastT = dn.t;
    const marketTime = !dn.isNight && dn.t >= MARKET_FROM && dn.t < MARKET_TO;
    const paused = G.dialog.open || G.modalOpen();
    for (const id of Object.keys(MARKET_SPOT)) {
      const npc = id === 'headmaster' ? G.headmaster.npc : G.villagers[id];
      if (!npc || (id === 'headmaster' && dn.isNight)) continue;
      const home = id === 'headmaster' ? G.headmaster.daySpot : npc.home;
      const w = this.walkers[id] ??= { at: 'home', route: [], npc };
      const want = marketTime && !this.isLocked(id) ? 'market' : 'home';
      if (want !== w.goal) {
        w.goal = want;
        w.route = this.route(id, home, want);
      }
      npc.moving = false;
      if (paused || !w.route.length) continue;
      const p = npc.group.position, t = w.route[0];
      const dx = t[0] - p.x, dz = t[1] - p.z, d = Math.hypot(dx, dz), step = 2.0 * dt;
      if (d <= step) { p.x = t[0]; p.z = t[1]; w.route.shift(); }
      else { p.x += dx / d * step; p.z += dz / d * step; npc.group.rotation.y = Math.atan2(dx, dz); npc.moving = true; }
      if (!w.route.length) npc.faceToward(0, p.z);
    }
    this.updateBow(dt);
  }

  route(id, home, goal) {
    const spot = MARKET_SPOT[id];
    const roadX = home.x < 0 ? -2.0 : 2.0;
    const there = [[roadX, home.z], [roadX, spot[1]], [spot[0], spot[1]]];
    const back = [[roadX, spot[1]], [roadX, home.z], [home.x, home.z]];
    const npc = id === 'headmaster' ? this.G.headmaster.npc : this.G.villagers[id];
    const p = npc.group.position;
    if (goal === 'market') return Math.hypot(p.x - spot[0], p.z - spot[1]) < 0.1 ? [] : there;
    return Math.hypot(p.x - home.x, p.z - home.z) < 0.1 ? [] : back;
  }

  // Headmaster bows to a player who caught him 3 times or more.
  updateBow(dt) {
    const G = this.G, hm = G.headmaster.npc, b = this.bow;
    b.cooldown -= dt;
    if (b.t > 0) b.t -= dt;
    const near = hm.group.position.distanceTo(G.player.pos) < 4;
    if (this.count('headmaster') >= 3 && !G.dayNight.isNight && near && b.cooldown <= 0) {
      b.t = 1.4; b.cooldown = 8;
      hm.faceToward(G.player.pos.x, G.player.pos.z);
      G.bows = (G.bows || 0) + 1;
    }
    hm.torso.rotation.x = b.t > 0 ? Math.sin((1.4 - b.t) / 1.4 * Math.PI) * 0.6 : 0;
  }
}

export { MARKET_SPOT, MARKET_FROM, MARKET_TO };
void THREE; void CONFIG;
