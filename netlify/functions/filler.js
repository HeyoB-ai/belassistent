import { getStore } from '@netlify/blobs';

// GET /api/filler?i=<index>&voice=<voiceId>
// Levert een kort, natuurlijk vulwoord als MP3. Het fragment wordt de eerste keer
// via ElevenLabs Flash v2.5 gegenereerd en gecachet in Netlify Blobs; daarna komt het
// direct uit de cache (geen generatietijd), zodat het de stilte kan maskeren terwijl
// het echte antwoord wordt gemaakt.
//
// Houd FILLER_TEXTS in sync met FILLER_COUNT in conversation.js.
const FILLER_TEXTS = ['Ja, momentje.', 'Even kijken.', 'Momentje alstublieft.', 'Oké, ik kijk het na.'];

const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_AI || '21m00Tcm4TlvDq8ikWAM';
const BASE_URL = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';

export default async function handler(req) {
  const url = new URL(req.url);
  const rawIndex = parseInt(url.searchParams.get('i') || '0', 10);
  const index = Number.isFinite(rawIndex)
    ? ((rawIndex % FILLER_TEXTS.length) + FILLER_TEXTS.length) % FILLER_TEXTS.length
    : 0;
  const voice = url.searchParams.get('voice') || DEFAULT_VOICE;
  const text = FILLER_TEXTS[index];

  const store = getStore('fillers');
  const key = `filler_${voice}_${index}`;

  // 1) Uit cache (snelste pad — geen generatie).
  const cached = await store.get(key, { type: 'arrayBuffer' });
  if (cached) {
    return audioResponse(cached);
  }

  // 2) Eerste keer: genereren via ElevenLabs Flash v2.5 en cachen.
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response('ELEVENLABS_API_KEY ontbreekt op de server.', { status: 500 });
  }

  const elevenUrl = `${BASE_URL}/v1/text-to-speech/${voice}?output_format=mp3_44100_128`;

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
    return new Response(`ElevenLabs status ${resp.status}: ${detail}`.trim(), { status: 502 });
  }

  const audio = await resp.arrayBuffer();
  await store.set(key, audio); // cachen voor volgende keren

  return audioResponse(audio);
}

function audioResponse(audio) {
  return new Response(Buffer.from(audio), {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=604800',
    },
  });
}

export const config = {
  path: '/api/filler',
};
