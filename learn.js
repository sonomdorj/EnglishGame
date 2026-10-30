// Adaptive learning. The level is never shown to the player.
// 5 correct in a row -> level +1 (max 10).
// 2 wrong in a row  -> level -1 (min 1), and the next quest reuses only known words.

const MIN_LEVEL = 1;
const MAX_LEVEL = 10;

export class Learner {
  // state: saved object with level, known, correctStreak, wrongStreak, reuseNext
  constructor(words, state, onChange = () => {}) {
    this.words = words;
    this.byWord = new Map(words.map(w => [w.word, w]));
    this.s = state;
    this.s.level ??= 1;
    this.s.known ??= [];
    this.s.correctStreak ??= 0;
    this.s.wrongStreak ??= 0;
    this.s.reuseNext ??= false;
    this.onChange = onChange;
  }

  get level() { return this.s.level; }

  record(correct) {
    const s = this.s;
    if (correct) {
      s.wrongStreak = 0;
      s.correctStreak++;
      if (s.correctStreak >= 5) {
        s.level = Math.min(MAX_LEVEL, s.level + 1);
        s.correctStreak = 0;
      }
    } else {
      s.correctStreak = 0;
      s.wrongStreak++;
      if (s.wrongStreak >= 2) {
        s.level = Math.max(MIN_LEVEL, s.level - 1);
        s.wrongStreak = 0;
        s.reuseNext = true;
      }
    }
    this.onChange();
  }

  // Pick n words for the next quest. Returns word objects { word, level, sentence }.
  pickWords(n) {
    const s = this.s;
    const known = s.known.map(w => this.byWord.get(w)).filter(Boolean);
    let picked;
    if (s.reuseNext && known.length >= n) {
      picked = shuffle(known).slice(0, n);
    } else {
      const fresh = l => shuffle(this.words.filter(w => w.level === l && !s.known.includes(w.word)));
      picked = fresh(s.level);
      // Level used up: borrow from the next levels, then from known words.
      for (let l = s.level + 1; picked.length < n && l <= MAX_LEVEL; l++) picked = picked.concat(fresh(l));
      for (let l = s.level - 1; picked.length < n && l >= MIN_LEVEL; l--) picked = picked.concat(fresh(l));
      if (picked.length < n) picked = picked.concat(shuffle(known));
      picked = picked.slice(0, n);
      for (const w of picked) if (!s.known.includes(w.word)) s.known.push(w.word);
    }
    s.reuseNext = false;
    this.onChange();
    return picked;
  }

  // k wrong options for a word quiz, from the same level when possible.
  distractors(target, k) {
    const same = this.words.filter(w => w.word !== target.word && w.level === target.level);
    const near = this.words.filter(w => w.word !== target.word && Math.abs(w.level - target.level) === 1);
    return shuffle(same).concat(shuffle(near)).slice(0, k);
  }
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
