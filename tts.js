import { CONFIG } from './config.js';

let voice = null;
function pickVoice() {
  try {
    const voices = speechSynthesis.getVoices();
    voice = voices.find(v => v.lang === CONFIG.ttsLang) ||
      voices.find(v => v.lang.replace('_', '-') === CONFIG.ttsLang) || null;
  } catch (e) { voice = null; }
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

// Last spoken lines, for debugging and tests.
export const spokenLog = [];

export function speak(text, { queue = false } = {}) {
  const clean = text.replace(/\*/g, '');
  spokenLog.push(clean);
  if (spokenLog.length > 200) spokenLog.shift();
  if (!('speechSynthesis' in window)) return;
  try {
    if (!queue) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = CONFIG.ttsLang;
    u.rate = CONFIG.ttsRate;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  } catch (e) { /* no speech on this device */ }
}
