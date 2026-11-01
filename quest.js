import { CONFIG } from './config.js';
import { WEEKDAYS } from './dates.js';
import { shuffle } from './learn.js';
import { FETCH_WORDS } from './world.js';
import { ARC_LIMIT, wordCount } from './grammar.js';

const ITEM_COLORS = { iron: 0x8a8f99, fish: 0x5aa0c8, pencil: 0xf2c94c, carrot: 0xf08a24, potato: 0xb08850,
  eraser: 0xf29bb4, net: 0x6b8e6b, rod: 0x7a5432, egg: 0xfaf6e8, wheat: 0xe5c76b, hammer: 0x555b66,
  horseshoe: 0x9aa0a8, kite: 0xd64545, bread: 0xc98a3e, shell: 0xf5e1c8 };

function itemColor(penalty) {
  for (const [k, c] of Object.entries(ITEM_COLORS)) if (penalty.includes(k)) return c;
  return 0xffffff;
}

// Word lesson line: the example sentence from words.json, new word marked with *...*.
// If the sentence is too long for the arc, or uses grammar that is still locked, only the word is said.
function wordLine(w, arc, grammar) {
  if (wordCount(w.sentence) > ARC_LIMIT[arc] || !grammar.allows(w.sentence)) return { who: 'word', text: `*${w.word}*`, audio: w.audio };
  const re = new RegExp(`\\b(${w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
  const text = re.test(w.sentence) ? w.sentence.replace(re, '*$1*') : w.sentence;
  return { who: 'word', text, audio: w.sentenceAudio };
}

// Judge quest flow. All spoken lines come from quests.json and buu.json.
export class QuestRunner {
  constructor(G) {
    this.G = G;
    this.stage = 'idle'; // idle | intro | toA | toB | ask | take | fetch | done
    this.timer = 1;
    this.q = null;
    this.newWords = [];
    this.trapActive = false;
    this.trapCaught = false;
  }

  get list() { return this.G.quests; }
  get B() { return this.G.buuLines; }

  update(dt) {
    const G = this.G;
    if (this.stage === 'idle' && !G.dialog.open && !G.picker.isOpen && G.started) {
      if (!G.state.introDone) {
        this.stage = 'intro';
        G.dialog.say(this.B.intro, () => { G.state.introDone = true; G.persist(); this.stage = 'idle'; this.timer = 0; });
        return;
      }
      if (G.state.questsDone >= this.list.length) return;
      this.timer -= dt;
      if (this.timer <= 0) this.start();
    }
  }

  start() {
    const G = this.G;
    this.q = this.list[G.state.questsDone];
    this.answers = { correct: 0, wrong: 0 };
    this.newWords = G.learner.pickWords(this.q.words.length);
    this.stage = 'toA';
    this.trapActive = true;
    this.trapCaught = false;
    G.dialog.say(this.q.lines.announce);
  }

  wordLines(part) {
    const half = Math.ceil(this.newWords.length / 2);
    const ws = part === 0 ? this.newWords.slice(0, half) : this.newWords.slice(half);
    return ws.map(w => wordLine(w, this.q.arc, this.G.grammar));
  }

  // Returns true if the quest handled this talk.
  talkVillager(id) {
    const G = this.G, q = this.q;
    const intro = G.meet(id);
    if (!q) return false;
    const L = q.lines;
    if (this.stage === 'toA' && id === q.a) {
      G.dialog.say([...intro, ...L.claimA, ...this.wordLines(0)], () => {
        this.stage = 'toB';
        G.dialog.say(L.toB);
      });
      return true;
    }
    if (this.stage === 'toA' && id === q.b) {
      G.dialog.say([...intro, ...L.wrongOrder]);
      return true;
    }
    if (this.stage === 'toB' && id === q.b) {
      G.dialog.say([...intro, ...L.claimB, ...this.wordLines(1)], () => {
        this.stage = 'ask';
        this.askWeekday();
      });
      return true;
    }
    if ((this.stage === 'toB' || this.stage === 'ask') && id === q.a) { G.dialog.say([...intro, ...L.claimA]); return true; }
    if (this.stage === 'ask' && id === q.b) { G.dialog.say([...intro, ...L.claimB]); return true; }
    if (this.stage === 'take' && id === q.liar) {
      G.dialog.say([...intro, ...L.take], () => {
        G.state.items.push(q.penalty);
        G.villagers[id]?.setItem(null);
        G.headmaster.npc.setItem(null);
        G.persist();
        G.power.onCatch(id, () => this.startFetch());
      });
      return true;
    }
    return false;
  }

  talkBuu() {
    const q = this.q, G = this.G;
    switch (this.stage) {
      case 'toA': return G.dialog.say([this.B.talkTo[q.a]]);
      case 'toB': return G.dialog.say([this.B.talkTo[q.b]]);
      case 'ask': return this.askWeekday();
      case 'take': return G.dialog.say([q.lines.verdict[1]]);
      case 'fetch': return this.giveToBuu();
      default:
        if (G.state.questsDone >= this.list.length) return G.dialog.say([this.B.noMore]);
        return G.dialog.say([this.B.wait]);
    }
  }

  // Weekday question: 7 buttons, no hints. Wrong: Buu says "No." and waits.
  weekdayPicker(title, answer, onCorrect) {
    const G = this.G;
    G.openPanel(() => G.picker.open({
      title,
      options: WEEKDAYS,
      onPick: i => {
        if (WEEKDAYS[i] === answer) {
          G.learner.record(true);
          G.closePanels();
          G.dialog.clear();
          onCorrect();
        } else {
          G.learner.record(false);
          G.dialog.clear();
          G.dialog.say([this.B.no]);
        }
      },
    }));
  }

  askWeekday() {
    const q = this.q;
    this.G.dialog.say(q.lines.ask, () => {
      if (this.stage !== 'ask') return;
      this.weekdayPicker(q.date, q.weekday, () => {
        this.stage = 'take';
        (q.liar === 'headmaster' ? this.G.headmaster.npc : this.G.villagers[q.liar]).setItem(itemColor(q.penalty));
        this.G.dialog.say(q.lines.verdict);
      });
    });
  }

  // F key: the player says Buu used a wrong weekday.
  trapKey() {
    const q = this.q, G = this.G;
    if (this.trapCaught) return G.dialog.say([this.B.caughtAlready]);
    if (!this.trapActive || !q) return G.dialog.say([this.B.nothingWrong]);
    this.weekdayPicker(q.trap.date, q.trap.weekday, () => {
      this.trapActive = false;
      this.trapCaught = true;
      G.dialog.say([this.B.silly]);
    });
  }

  // "Bring me the X": the player finds the thing on the plaza, picks it up, and gives it to Buu.
  chooseFetchWord() {
    const G = this.G;
    const fromQuest = this.newWords.map(w => w.word).filter(w => FETCH_WORDS.includes(w));
    if (fromQuest.length) return shuffle(fromQuest)[0];
    const level = G.learner.level;
    const byLevel = FETCH_WORDS.filter(w => (G.learner.byWord.get(w)?.level ?? 1) <= level);
    const fresh = byLevel.filter(w => !G.state.known.includes(w));
    return shuffle(fresh.length ? fresh : byLevel.length ? byLevel : FETCH_WORDS)[0];
  }

  startFetch() {
    const G = this.G;
    this.stage = 'fetch';
    this.fetchWord = this.chooseFetchWord();
    if (!G.state.known.includes(this.fetchWord)) { G.state.known.push(this.fetchWord); G.persist(); }
    const others = shuffle(FETCH_WORDS.filter(w => w !== this.fetchWord)).slice(0, 2);
    G.spawnFetch(shuffle([this.fetchWord, ...others]));
    G.dialog.say([this.B.bring[this.fetchWord]]);
  }

  giveToBuu() {
    const G = this.G;
    if (!G.carrying) return G.dialog.say([this.B.bring[this.fetchWord]]);
    if (G.carrying === this.fetchWord) {
      G.learner.record(true);
      G.carrying = null;
      G.clearFetch();
      return this.finish();
    }
    G.learner.record(false);
    G.dropCarried();
    G.dialog.say([this.B.no, this.B.bring[this.fetchWord]]);
  }

  finish() {
    const G = this.G;
    this.stage = 'done';
    this.trapActive = false;
    G.dialog.say([this.B.correctNext], () => {
      G.state.questsDone++;
      G.persist();
      G.writeReport(this.q, this.answers);
      this.q = null;
      this.stage = 'idle';
      this.timer = CONFIG.nextCaseDelaySec;
      if (G.state.questsDone >= this.list.length) G.dialog.say(this.B.allClosed);
    });
  }
}
