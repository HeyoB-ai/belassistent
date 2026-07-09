// GET /api/speak?text=...&voice=<voiceId>
// Zet tekst om naar spraak via ElevenLabs Flash v2.5 (snelste model, ~75ms) en streamt
// de MP3-bytes direct door naar Twilio, zodat afspelen begint terwijl er nog gegenereerd
// wordt. Geen volledige buffering.
//
// Stemmen overschrijfbaar via env vars ELEVENLABS_VOICE_AI / ELEVENLABS_VOICE_AGENT.
// Base URL overschrijfbaar via ELEVENLABS_BASE_URL (bv. https://api.us.elevenlabs.io als
// je dicht bij het US-cluster zit — Netlify draait meestal in de VS).
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_AI || '21m00Tcm4TlvDq8ikWAM';
const BASE_URL = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';

export default async function handler(req) {
  const url = new URL(req.url);
  // Tekst kort houden (< 1000 tekens) voor de snelste generatie.
  const text = (url.searchParams.get('text') || '').slice(0, 1000);
  const voice = url.searchParams.get('voice') || DEFAULT_VOICE;

  if (!text) {
    return new Response('Missing "text" query parameter.', { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response('ELEVENLABS_API_KEY ontbreekt op de server.', { status: 500 });
  }

  // Streaming endpoint + optimize_streaming_latency=3 voor de laagste TTFB.
  const elevenUrl = `${BASE_URL}/v1/text-to-speech/${voice}/stream?optimize_streaming_latency=3&output_format=mp3_44100_128`;

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
        model_id: 'eleven_flash_v2_5',
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

  // Stream de response-body rechtstreeks door naar Twilio — geen buffering.
  return new Response(resp.body, {
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
