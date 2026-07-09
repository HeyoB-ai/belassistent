// Gedeelde TTS-helpers voor de Netlify Functions (speak.js + conversation.js).
// Bevat de uitspraak-normalisatie en een niet-streaming ElevenLabs-generatie met
// eigen timeout, zodat conversation.js server-side kan beslissen: ElevenLabs of Polly.

const BASE_URL = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';

// ── Uitspraak-normalisatie ────────────────────────────────────────────────
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
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

export function normalizeForSpeech(text) {
  if (!text) return text;
  const emails = [];
  let out = text.replace(EMAIL_RE, (m) => {
    emails.push(spokenEmail(m));
    return PH_OPEN + (emails.length - 1) + PH_CLOSE;
  });
  out = out.replace(/\d{4,}/g, (m) => spokenDigits(m));
  out = out.replace(PH_RESTORE, (_, i) => emails[Number(i)]);
  return out;
}

// ── ElevenLabs generatie (niet-streaming, volledige bytes) ────────────────
// Geeft { ok: true, audio: ArrayBuffer } of { ok: false, error } terug. Gebruikt een
// eigen AbortController-timeout zodat een trage/falende TTS de beurt niet laat hangen.
export async function generateTts(text, voice, timeoutMs) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, error: 'ELEVENLABS_API_KEY ontbreekt' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(
      `${BASE_URL}/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
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
      }
    );
    if (!resp.ok) return { ok: false, error: `status ${resp.status}` };
    const audio = await resp.arrayBuffer();
    if (!audio || audio.byteLength === 0) return { ok: false, error: 'lege response' };
    return { ok: true, audio };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}
