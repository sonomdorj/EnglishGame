// Grammar gate. Never shown to the player.
// Forms: present (always), past (arc 4+), cause = because/so (arc 5+).
// A new form unlocks only after 5 correct answers in a row while its arc is reached.
// Quest lines that use a locked form have a "plain" version, which is said instead.

export const ARC_LIMIT = { 1: 3, 2: 5, 3: 7, 4: 10, 5: 12 };

const PAST_WORDS = new Set(('was were did had paid took said ate gave made went came saw lost sang fed bought sold told got ' +
  'found broke wrote ran met sat left stole hid knew thought brought felt kept slept swam threw won wore drank drove flew ' +
  'grew heard held led meant began chose forgot became born').split(' '));
const NOT_PAST = new Set(['bed', 'red', 'need', 'feed', 'seed', 'speed', 'hundred', 'shed', 'weed']);

export function tokens(text) {
  return (text.toLowerCase().replace(/'s\b/g, '').match(/[a-z]+/g) || []);
}

export function hasPast(text) {
  return tokens(text).some(w => PAST_WORDS.has(w) || (/ed$/.test(w) && !NOT_PAST.has(w)));
}

export function hasCause(text) {
  return tokens(text).some(w => w === 'because' || w === 'so');
}

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export class Grammar {
  constructor(G) {
    this.G = G;
    G.state.grammar ??= { past: false, cause: false, streak: 0 };
  }

  get s() { return this.G.state.grammar; }

  arc() { return this.G.quest?.q?.arc || this.G.quests?.[Math.min(this.G.state.questsDone, this.G.quests.length - 1)]?.arc || 1; }

  record(correct) {
    const s = this.s, arc = this.arc();
    s.streak = correct ? s.streak + 1 : 0;
    if (s.streak >= 5) {
      if (arc >= 4 && !s.past) { s.past = true; s.streak = 0; }
      else if (arc >= 5 && s.past && !s.cause) { s.cause = true; s.streak = 0; }
    }
    this.G.persist();
  }

  allows(text) {
    return (!hasPast(text) || this.s.past) && (!hasCause(text) || this.s.cause);
  }

  // The line to say: the line itself, or its plain version if its form is still locked.
  pick(line) {
    if (!line || !line.form) return line;
    if (line.form === 'past' && this.s.past) return line;
    if (line.form === 'cause' && this.s.cause && this.s.past) return line;
    return line.plain || line;
  }
}
