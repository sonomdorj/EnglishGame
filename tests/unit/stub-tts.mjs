// Preload for scripts/make_audio.js tests: replaces fetch, so no request leaves the machine.
// STUB_TTS=ok  -> every request returns a tiny fake mp3 (bytes: 0xff 0xfb + voice name or voice ID)
// STUB_TTS=401 -> every request fails with 401
// Every request is checked like the real API would check it.
const mode = process.env.STUB_TTS || 'ok';
const fail = msg => { throw new Error(`stub: ${msg}`); };
globalThis.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  let voice;
  if (url === 'https://api.openai.com/v1/audio/speech') {
    if (opts.headers.Authorization !== `Bearer ${process.env.OPENAI_API_KEY}`) fail('no OpenAI key header');
    if (!body.input || !body.voice || body.model !== 'tts-1' || body.response_format !== 'mp3') fail('bad OpenAI body');
    voice = body.voice;
  } else if (url === 'https://api.fish.audio/v1/tts') {
    if (opts.headers.Authorization !== `Bearer ${process.env.FISH_API_KEY}`) fail('no Fish key header');
    if (opts.headers['Content-Type'] !== 'application/json' || !opts.headers.model) fail('bad Fish headers');
    if (!body.text || !body.reference_id || body.format !== 'mp3' || !(body.prosody?.speed > 0)) fail('bad Fish body');
    if (/^REPLACE_ME/.test(body.reference_id)) fail('placeholder voice ID sent');
    voice = body.reference_id;
  } else fail(`unexpected request: ${url}`);
  if (mode === '401') return new Response('bad key', { status: 401 });
  return new Response(new Uint8Array([0xff, 0xfb, ...Buffer.from(voice)]), { status: 200 });
};
