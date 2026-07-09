import { getStore } from '@netlify/blobs';
import { normalizeForSpeech } from '../shared/tts.js';

// GET /api/speak
//   ?key=<blobKey>  -> serveert vooraf gegenereerde, gecachete antwoord-audio (uit de
//                      'tts'-store; door conversation.js gezet als ElevenLabs slaagde).
//   ?text=...&voice -> genereert live via ElevenLabs Flash v2.5 (streaming) — voor losse
//                      berichten (bijv. afsluiter). Tekst wordt genormaliseerd.
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_AI || '21m00Tcm4TlvDq8ikWAM';
const BASE_URL = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';

function audioResponse(body) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export default async function handler(req) {
  const url = new URL(req.url);

  // ── Cache-pad: vooraf gegenereerde antwoord-audio ────────────────────────
  const key = url.searchParams.get('key');
  if (key) {
    const cached = await getStore('tts').get(key, { type: 'arrayBuffer' });
    if (cached) return audioResponse(Buffer.from(cached));
    return new Response('cache miss', { status: 404 });
  }

  // ── Live-streaming-pad (losse berichten) ─────────────────────────────────
  const raw = (url.searchParams.get('text') || '').slice(0, 1000);
  const text = normalizeForSpeech(raw);
  const voice = url.searchParams.get('voice') || DEFAULT_VOICE;

  if (!text) {
    return new Response('Missing "text" query parameter.', { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response('ELEVENLABS_API_KEY ontbreekt op de server.', { status: 500 });
  }

  const elevenUrl = `${BASE_URL}/v1/text-to-speech/${voice}/stream?optimize_streaming_latency=3&output_format=mp3_44100_128`;

  // Eigen fetch-timeout (5s) op de time-to-first-byte, gewist zodra de headers binnen zijn.
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 5000);
  const elStart = Date.now();

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
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(abortTimer);
    return new Response(`ElevenLabs-verbindingsfout: ${err.message}`, { status: 502 });
  }
  clearTimeout(abortTimer);
  console.log(`[speak] ElevenLabs=${Date.now() - elStart}ms voice=${voice}`);

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return new Response(`ElevenLabs status ${resp.status}: ${detail}`.trim(), {
      status: 502,
    });
  }

  // Stream de response-body rechtstreeks door naar Twilio — geen buffering.
  return audioResponse(resp.body);
}

export const config = {
  path: '/api/speak',
};
