// Same id in the browser and in scripts/make_audio.js.
// id = <speaker>-<FNV-1a hash of "speaker|clean text">
export function cleanText(text) {
  return text.replace(/\*/g, '').trim();
}

export function audioId(who, text) {
  const s = `${who}|${cleanText(text)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${who}-${h.toString(16).padStart(8, '0')}`;
}
