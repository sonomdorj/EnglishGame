// Preload for scripts/make_audio.js tests: replaces fetch, so no request leaves the machine.
// STUB_TTS=ok  -> every request returns a tiny fake mp3 (bytes: 0xff 0xfb + voice name)
// STUB_TTS=401 -> every request fails with 401
const mode = process.env.STUB_TTS || 'ok';
globalThis.fetch = async (url, opts) => {
  if (url !== 'https://api.openai.com/v1/audio/speech') throw new Error(`unexpected request: ${url}`);
  const body = JSON.parse(opts.body);
  if (opts.headers.Authorization !== `Bearer ${process.env.OPENAI_API_KEY}`) throw new Error('no key header');
  if (mode === '401') return new Response('bad key', { status: 401 });
  if (!body.input || !body.voice || body.model !== 'tts-1' || body.response_format !== 'mp3') throw new Error('bad body');
  return new Response(new Uint8Array([0xff, 0xfb, ...Buffer.from(body.voice)]), { status: 200 });
};
