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

// ── Uitspraak-normalisatie ────────────────────────────────────────────────
// Bereidt tekst voor op natuurlijke uitspraak in het Nederlands: lange cijferreeksen
// cijfer-voor-cijfer, e-mailadressen met "at"/"punt" en de extensie gespeld. Dit raakt
// ALLEEN de uitspraak — het transcript in de app toont de originele tekst.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

// Placeholder-wrappers met control-tekens (komen niet voor in echte tekst en de
// cijfer-stap raakt ze niet). NUL = \x00, STX = \x02.
const PH_OPEN = '\x00';
const PH_CLOSE = '\x02';
const PH_RESTORE = /\x00(\d+)\x02/g;

function spellLetters(s) {
  return s.split('').join(' ');
}

// Lange cijferreeks -> losse cijfers, gegroepeerd per 3 met een komma (lichte pauze).
function spokenDigits(digits) {
  const chars = digits.split('');
  const groups = [];
  for (let i = 0; i < chars.length; i += 3) {
    groups.push(chars.slice(i, i + 3).join(' '));
  }
  return groups.join(', ');
}

// "marcel@vos.nl" -> "marcel at vos punt n l"
function spokenEmail(email) {
  const at = email.indexOf('@');
  const local = email.slice(0, at).replace(/\./g, ' punt ');
  const parts = email.slice(at + 1).split('.');
  const domain = parts
    .map((p, i) => (i === parts.length - 1 ? spellLetters(p) : p)) // extensie spellen
    .join(' punt ');
  return `${local} at ${domain}`;
}

function normalizeForSpeech(text) {
  if (!text) return text;
  const emails = [];
  // 1) E-mailadressen eruit halen (botsvrije placeholder) zodat de cijfer-stap ze
  //    niet raakt.
  let out = text.replace(EMAIL_RE, (m) => {
    emails.push(spokenEmail(m));
    return PH_OPEN + (emails.length - 1) + PH_CLOSE;
  });
  // 2) Cijferreeksen van 4+ -> cijfer-voor-cijfer. Korte getallen (1-3) blijven met rust.
  out = out.replace(/\d{4,}/g, (m) => spokenDigits(m));
  // 3) E-mails terugzetten in gesproken vorm.
  out = out.replace(PH_RESTORE, (_, i) => emails[Number(i)]);
  return out;
}

export default async function handler(req) {
  const url = new URL(req.url);
  // Tekst kort houden (< 1000 tekens) voor de snelste generatie, daarna normaliseren
  // voor duidelijke uitspraak van cijferreeksen en e-mailadressen.
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
