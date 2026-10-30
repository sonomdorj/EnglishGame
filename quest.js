import { CONFIG } from './config.js';
import { WEEKDAYS, parseDate } from './dates.js';
import { speak } from './tts.js';
import { shuffle } from './learn.js';

const ITEM_COLORS = { iron: 0x8a8f99, fish: 0x5aa0c8, pencil: 0xf2c94c, carrot: 0xf08a24, potato: 0xb08850,
  eraser: 0xf29bb4, net: 0x6b8e6b, rod: 0x7a5432, egg: 0xfaf6e8, wheat: 0xe5c76b, hammer: 0x555b66,
  horseshoe: 0x9aa0a8, kite: 0xd64545, bread: 0xc98a3e, shell: 0xf5e1c8 };

function itemColor(penalty) {
  for (const [k, c] of Object.entries(ITEM_COLORS)) if (penalty.includes(k)) return c;
  return 0xffffff;
}

function highlight(sentence, word) {
  const re = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
  return re.test(sentence) ? sentence.replace(re, '*$1*') : `${sentence} (*${word}*)`;
}

// Judge quest flow:
// Buu announces -> villager A claim -> villager B claim -> pick weekday -> verdict
// -> take penalty from liar -> word check -> "Correct. Next."
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
  first(id) { return this.G.villagerData[id].name.split(' ')[0]; }

  buu(lines, onDone) {
    this.G.dialog.say(lines.map(t => ['Buu', t]), onDone);
  }

  update(dt) {
    const G = this.G;
    if (this.stage === 'idle' && !G.dialog.open && !G.picker.isOpen && G.started) {
      if (!G.state.introDone) {
        this.stage = 'intro';
        this.buu([
          'I am Buu. I follow you.',
          'People here lie about days.',
          'You are the judge.',
          'C opens the calendar.',
          'B opens the Family Book.',
          'Lost things hide in the village.',
          'Sometimes I say a wrong day.',
          'Then press F.',
        ], () => { G.state.introDone = true; G.persist(); this.stage = 'idle'; this.timer = 0; });
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
    this.buu([
      `New case. Talk to ${this.first(this.q.a)}.`,
      `New words: ${this.newWords.map(w => w.word).join(', ')}.`,
      this.q.trap.line,
    ]);
  }

  wordLines(who, part) {
    const half = Math.ceil(this.newWords.length / 2);
    const ws = part === 0 ? this.newWords.slice(0, half) : this.newWords.slice(half);
    return ws.map(w => [who, highlight(w.sentence, w.word)]);
  }

  // Returns true if the quest handled this talk.
  talkVillager(id) {
    const G = this.G, q = this.q;
    const name = G.villagerData[id].name;
    const intro = G.meet(id);
    if (!q) return false;
    if (this.stage === 'toA' && id === q.a) {
      G.dialog.say([...intro, [name, q.claimA], ...this.wordLines(name, 0)], () => {
        this.stage = 'toB';
        this.buu([`Now talk to ${this.first(q.b)}.`]);
      });
      return true;
    }
    if (this.stage === 'toA' && id === q.b) {
      G.dialog.say(intro);
      this.buu([`Talk to ${this.first(q.a)} first.`]);
      return true;
    }
    if (this.stage === 'toB' && id === q.b) {
      G.dialog.say([...intro, [name, q.claimB], ...this.wordLines(name, 1)], () => {
        this.stage = 'ask';
        this.askWeekday();
      });
      return true;
    }
    if ((this.stage === 'toB' || this.stage === 'ask') && id === q.a) {
      G.dialog.say([...intro, [name, q.claimA]]);
      return true;
    }
    if (this.stage === 'ask' && id === q.b) {
      G.dialog.say([...intro, [name, q.claimB]]);
      return true;
    }
    if (this.stage === 'take' && id === q.liar) {
      G.dialog.say([...intro, ['', `You take ${q.penalty}.`]], () => {
        G.state.items.push(q.penalty);
        G.villagers[id].setItem(null);
        G.persist();
        this.stage = 'words';
        this.buu(['Word check. Listen.'], () => this.wordQuiz(0));
      });
      return true;
    }
    return false;
  }

  talkBuu() {
    const q = this.q;
    switch (this.stage) {
      case 'toA': return this.buu([`Talk to ${this.first(q.a)}.`]);
      case 'toB': return this.buu([`Talk to ${this.first(q.b)}.`]);
      case 'ask': return this.askWeekday();
      case 'take': return this.buu([`Take ${q.penalty} from ${this.first(q.liar)}.`]);
      case 'words': return this.buu(['Word check. Listen.'], () => this.wordQuiz(this.wordIndex || 0));
      default:
        if (this.G.state.questsDone >= this.list.length) return this.buu(['No more cases. Read letters at night.']);
        return this.buu(['Wait. A new case comes soon.']);
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
          this.buu(['No. Look again.']);
        }
      },
    }));
  }

  askWeekday() {
    const q = this.q;
    this.buu([`Which day was ${q.date}?`], () => {
      if (this.stage !== 'ask') return;
      this.weekdayPicker(`Which day was ${q.date}?`, q.date, q.weekday, () => {
        this.stage = 'take';
        this.G.villagers[q.liar].setItem(itemColor(q.penalty));
        this.buu([`${q.weekday}. ${this.first(q.liar)} lied.`, `Take ${q.penalty} from ${this.first(q.liar)}.`]);
      });
    });
  }

  // F key: the player says Buu used a wrong weekday.
  trapKey() {
    const q = this.q;
    if (this.trapCaught) return this.buu(['You caught me already.']);
    if (!this.trapActive || !q) return this.buu(['I said nothing wrong.']);
    this.weekdayPicker(`Buu said: "${q.trap.line}" Which day was it?`, q.trap.date, q.trap.weekday, () => {
      this.trapActive = false;
      this.trapCaught = true;
      this.buu(['You are right. I am a silly panda.']);
    });
  }

  // Listen and pick the written word.
  wordQuiz(i) {
    const G = this.G;
    this.wordIndex = i;
    if (i >= this.newWords.length) return this.finish();
    const target = this.newWords[i];
    const options = shuffle([target, ...G.learner.distractors(target, 3)]);
    G.openPanel(() => G.picker.open({
      title: 'Listen. Which word?',
      cal: null,
      extra: [{ label: 'Listen again', onClick: () => speak(target.word) }],
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
          this.buu(['No. Listen again.']);
          speak(target.word, { queue: true });
        }
      },
    }));
    speak(target.word);
  }

  finish() {
    const G = this.G;
    this.stage = 'done';
    this.trapActive = false;
    this.buu(['Correct. Next.'], () => {
      G.state.questsDone++;
      G.persist();
      this.q = null;
      this.stage = 'idle';
      this.timer = CONFIG.nextCaseDelaySec;
      if (G.state.questsDone >= this.list.length) this.buu(['All cases closed.', 'Read the letters at night.']);
    });
  }
}
