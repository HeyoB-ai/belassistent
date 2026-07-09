// GET /api/speak?text=...&voice=<voiceId>
// Zet tekst om naar spraak via ElevenLabs en geeft de MP3-bytes rechtstreeks terug,
// zodat Twilio deze met <Play> kan afspelen.
//
// Standaard-stemmen zijn overschrijfbaar via env vars:
//   ELEVENLABS_VOICE_AI    — stem van de AI-assistent (wordt hier standaard gebruikt)
//   ELEVENLABS_VOICE_AGENT — stem voor medewerker-simulatie (bv. in demo's)
// De fallback-ID's hieronder zijn ElevenLabs-standaardstemmen; vervang ze door de
// Nederlandse/multilingual stemmen uit je eigen account via de env vars.
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_AI || '21m00Tcm4TlvDq8ikWAM';

export default async function handler(req) {
  const url = new URL(req.url);
  const text = url.searchParams.get('text');
  const voice = url.searchParams.get('voice') || DEFAULT_VOICE;

  if (!text) {
    return new Response('Missing "text" query parameter.', { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response('ELEVENLABS_API_KEY ontbreekt op de server.', { status: 500 });
  }

  const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voice}`;

  let resp;
  try {
    resp = await fetch(elevenUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
  } catch (err) {
    return new Response(`ElevenLabs-verbindingsfout: ${err.message}`, { status: 502 });
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return new Response(`ElevenLabs status ${resp.status}: ${detail}`.trim(), {
      status: 502,
    });
  }

  const audio = await resp.arrayBuffer();

  // Ruwe MP3-bytes met 200 + audio/mpeg, zodat Twilio <Play> ze kan afspelen.
  // Cache-Control laat identieke tekst (bv. herhaalde zinnen) via de CDN cachen.
  return new Response(Buffer.from(audio), {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export const config = {
  path: '/api/speak',
};
