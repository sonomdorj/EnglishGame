import { CONFIG } from './config.js';
import { WEEKDAYS, parseDate } from './dates.js';
import { shuffle } from './learn.js';

const ITEM_COLORS = { iron: 0x8a8f99, fish: 0x5aa0c8, pencil: 0xf2c94c, carrot: 0xf08a24, potato: 0xb08850,
  eraser: 0xf29bb4, net: 0x6b8e6b, rod: 0x7a5432, egg: 0xfaf6e8, wheat: 0xe5c76b, hammer: 0x555b66,
  horseshoe: 0x9aa0a8, kite: 0xd64545, bread: 0xc98a3e, shell: 0xf5e1c8 };

function itemColor(penalty) {
  for (const [k, c] of Object.entries(ITEM_COLORS)) if (penalty.includes(k)) return c;
  return 0xffffff;
}

// Word lesson line: the example sentence from words.json, new word marked with *...*.
function wordLine(w) {
  const re = new RegExp(`\\b(${w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
  const text = re.test(w.sentence) ? w.sentence.replace(re, '*$1*') : w.sentence;
  return { who: 'word', text, audio: w.sentenceAudio };
}

// Judge quest flow. All spoken lines come from quests.json and buu.json.
export class QuestRunner {
  constructor(G) {
    this.G = G;
    this.stage = 'idle'; // idle | intro | toA | toB | ask | take | words | done
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
    this.newWords = G.learner.pickWords(this.q.words.length);
    this.stage = 'toA';
    this.trapActive = true;
    this.trapCaught = false;
    G.dialog.say(this.q.lines.announce);
  }

  wordLines(part) {
    const half = Math.ceil(this.newWords.length / 2);
    const ws = part === 0 ? this.newWords.slice(0, half) : this.newWords.slice(half);
    return ws.map(wordLine);
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
        G.villagers[id].setItem(null);
        G.persist();
        this.stage = 'words';
        G.dialog.say([this.B.wordCheck], () => this.wordQuiz(0));
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
      case 'words': return G.dialog.say([this.B.wordCheck], () => this.wordQuiz(this.wordIndex || 0));
      default:
        if (G.state.questsDone >= this.list.length) return G.dialog.say([this.B.noMore]);
        return G.dialog.say([this.B.wait]);
    }
  }

  // Weekday question with a calendar. Wrong answers: "No. Look again." No limit.
  weekdayPicker(title, dateStr, answer, onCorrect) {
    const G = this.G;
    const { m, y } = parseDate(dateStr);
    G.openPanel(() => G.picker.open({
      title,
      cal: { y, m },
      options: WEEKDAYS,
      onPick: (i, btn) => {
        if (WEEKDAYS[i] === answer) {
          G.learner.record(true);
          G.closePanels();
          onCorrect();
        } else {
          G.learner.record(false);
          btn.classList.add('wrong');
          G.dialog.clear();
          G.dialog.say([this.B.noLook]);
        }
      },
    }));
  }

  askWeekday() {
    const q = this.q;
    this.G.dialog.say(q.lines.ask, () => {
      if (this.stage !== 'ask') return;
      this.weekdayPicker(`Which day was ${q.date}?`, q.date, q.weekday, () => {
        this.stage = 'take';
        this.G.villagers[q.liar].setItem(itemColor(q.penalty));
        this.G.dialog.say(q.lines.verdict);
      });
    });
  }

  // F key: the player says Buu used a wrong weekday.
  trapKey() {
    const q = this.q, G = this.G;
    if (this.trapCaught) return G.dialog.say([this.B.caughtAlready]);
    if (!this.trapActive || !q) return G.dialog.say([this.B.nothingWrong]);
    this.weekdayPicker(`Buu said: "${q.lines.announce[2].text}" Which day was it?`, q.trap.date, q.trap.weekday, () => {
      this.trapActive = false;
      this.trapCaught = true;
      G.dialog.say([this.B.silly]);
    });
  }

  // Listen and pick the written word.
  wordQuiz(i) {
    const G = this.G;
    this.wordIndex = i;
    if (i >= this.newWords.length) return this.finish();
    const target = this.newWords[i];
    const options = shuffle([target, ...G.learner.distractors(target, 3)]);
    const say = () => G.voice.play({ who: 'word', text: target.word, audio: target.audio });
    G.openPanel(() => G.picker.open({
      title: 'Listen. Which word?',
      cal: null,
      extra: [{ label: 'Listen again', onClick: say }],
      options: options.map(w => w.word),
      onPick: (k, btn) => {
        if (options[k] === target) {
          G.learner.record(true);
          G.closePanels();
          G.dialog.clear();
          this.wordQuiz(i + 1);
        } else {
          G.learner.record(false);
          btn.classList.add('wrong');
          G.dialog.clear();
          G.dialog.say([this.B.noListen]);
        }
      },
    }));
    say();
  }

  finish() {
    const G = this.G;
    this.stage = 'done';
    this.trapActive = false;
    G.dialog.say([this.B.correctNext], () => {
      G.state.questsDone++;
      G.persist();
      this.q = null;
      this.stage = 'idle';
      this.timer = CONFIG.nextCaseDelaySec;
      if (G.state.questsDone >= this.list.length) G.dialog.say(this.B.allClosed);
    });
  }
}
