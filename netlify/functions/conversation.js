import twilio from 'twilio';
import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '@netlify/blobs';

const MODEL = 'claude-sonnet-4-6';
const VoiceResponse = twilio.twiml.VoiceResponse;

// ElevenLabs-stemmen (overschrijfbaar via env vars; fallback = standaardstemmen).
const VOICE_AI = process.env.ELEVENLABS_VOICE_AI || '21m00Tcm4TlvDq8ikWAM';
const VOICE_AGENT = process.env.ELEVENLABS_VOICE_AGENT || 'ErXwobaYiN019PkySvjV';

// Bouwt de /api/speak-URL voor <Play>. Tekst wordt URL-encoded zodat spaties en
// leestekens goed doorkomen; de twilio-lib escaped daarna de & naar &amp; in de TwiML.
function speakUrl(text, voice = VOICE_AI) {
  return `${process.env.URL}/api/speak?voice=${voice}&text=${encodeURIComponent(text)}`;
}

// Volledige taalnamen voor de samenvattingsprompt.
const LANGUAGE_NAMES = {
  nl: 'Nederlands',
  tr: 'Turks',
  ar: 'Arabisch',
  pl: 'Pools',
  en: 'Engels',
  es: 'Spaans',
  fr: 'Frans',
  zh: 'Chinees',
};

// Terminale Twilio-statussen — hierbij genereren we de samenvatting.
const TERMINAL = ['completed', 'busy', 'no-answer', 'failed', 'canceled'];

// POST /api/conversation — Twilio webhook.
// Drie situaties:
//   a) helpdesk neemt op, geen SpeechResult  -> AI opent het gesprek
//   b) helpdesk zegt iets (SpeechResult)     -> AI reageert
//   c) CallStatus is terminaal               -> genereer samenvatting
export default async function handler(req) {
  const params = await parseBody(req);
  const callSid = params.get('CallSid');
  const callStatus = params.get('CallStatus') || '';
  const speech = (params.get('SpeechResult') || '').trim();

  if (!callSid) {
    return twiml(hangupResponse('Er ging iets mis. Tot ziens.'));
  }

  const store = getStore('calls');
  const state = await store.get(callSid, { type: 'json' });

  if (!state) {
    // Geen bekende state: netjes ophangen zonder crash.
    return twiml(hangupResponse('Dit gesprek kan niet worden voortgezet. Tot ziens.'));
  }

  const webhookUrl = `${process.env.URL}/api/conversation`;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Situatie c) — terminale status: samenvatting genereren, geen TwiML nodig.
  if (TERMINAL.includes(callStatus)) {
    if (state.status !== 'completed') {
      state.status = 'completed';
      state.outcome = await generateSummary(anthropic, state);
      await store.setJSON(callSid, state);
    }
    return new Response('', { status: 204 });
  }

  // Situatie a) & b) — voice-webhook: het gesprek loopt.
  state.status = 'in-progress';

  if (speech) {
    // b) medewerker heeft iets gezegd
    state.messages.push({ speaker: 'agent', text: speech });
  }

  // Bouw de gespreksgeschiedenis voor Claude. De medewerker = user, de AI = assistant.
  // We starten altijd met een synthetische user-turn zodat de reeks geldig alterneert.
  const claudeMessages = [
    { role: 'user', content: '[De medewerker van de helpdesk heeft de telefoon opgenomen.]' },
  ];
  for (const m of state.messages) {
    if (m.speaker === 'system') continue;
    claudeMessages.push({
      role: m.speaker === 'ai' ? 'assistant' : 'user',
      content: m.text,
    });
  }

  let reply;
  try {
    reply = await callClaude(anthropic, buildSystemPrompt(state), claudeMessages);
  } catch (err) {
    state.messages.push({ speaker: 'system', text: `Fout bij AI: ${err.message}` });
    await store.setJSON(callSid, state);
    return twiml(hangupResponse('Er ging iets mis met de assistent. Ik hang op. Tot ziens.'));
  }

  // Detecteer of Claude aangeeft dat het gesprek klaar is.
  const done = /\[EINDE\]/i.test(reply);
  const spoken = reply.replace(/\[EINDE\]/gi, '').trim() || 'Dank u wel. Tot ziens.';

  state.messages.push({ speaker: 'ai', text: spoken });
  await store.setJSON(callSid, state);

  const vr = new VoiceResponse();
  vr.play(speakUrl(spoken));

  if (done) {
    vr.hangup();
  } else {
    vr.gather({
      input: 'speech',
      language: 'nl-NL',
      speechTimeout: 'auto',
      action: webhookUrl,
      method: 'POST',
    });
    // Als er niets wordt gezegd binnen de gather, ronden we het gesprek netjes af.
    vr.play(speakUrl('Ik hoor niets meer. Bedankt en tot ziens.'));
    vr.hangup();
  }

  return twiml(vr.toString());
}

// --- Claude ---------------------------------------------------------------

function buildSystemPrompt(state) {
  const goalInstructie = state.goal
    ? `Het uiteindelijke doel van de gebruiker is: ${state.goal}. Werk gericht naar dit doel toe en neem geen genoegen met minder; als de medewerker iets biedt dat het doel niet haalt, vraag beleefd door naar een betere oplossing of alternatief. `
    : '';
  const emailInstructie = state.email
    ? `Als er een bevestiging, mail of document verstuurd kan worden, vraag de medewerker dit te sturen naar: ${state.email}. `
    : '';

  return `Je bent een professionele AI-belassistent die namens een gebruiker naar een helpdesk belt. Het gesprek verloopt volledig in het Nederlands. De taak van de gebruiker is: ${state.task} (bedrijf: ${state.company}). ${goalInstructie}${emailInstructie}Voer het gesprek beleefd, kort en doelgericht. Stel je voor als AI die namens een klant belt. Reageer natuurlijk op wat de medewerker zegt. Geef per beurt alleen wat je zou zeggen, kort. Als het gewenste doel bereikt is of het gesprek logisch eindigt, geef dan als laatste regel exact [EINDE].`;
}

async function callClaude(anthropic, system, messages) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system,
    messages,
  });
  return msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

async function generateSummary(anthropic, state) {
  const languageName = LANGUAGE_NAMES[state.language] || 'Nederlands';

  const transcript = state.messages
    .filter((m) => m.speaker !== 'system')
    .map((m) => `${m.speaker === 'ai' ? 'AI' : 'Medewerker'}: ${m.text}`)
    .join('\n');

  const system = `Je vat een telefoongesprek samen dat een AI-belassistent namens een klant met een helpdesk voerde. De taak was: ${state.task} (bedrijf: ${state.company}).

Geef UITSLUITEND geldige JSON terug (geen tekst eromheen, geen markdown, geen codeblok) met exact deze velden:
{
  "status": "opgelost" of "lopend" of "terugbellen",
  "samenvatting": "<korte samenvatting in het ${languageName}>",
  "referentienummer": "<referentie/casenummer als genoemd, anders null>",
  "vervolgstap": "<de vervolgstap in het ${languageName}, anders null>"
}

De waarde van "status" is altijd exact een van: opgelost, lopend, terugbellen. De teksten in "samenvatting" en "vervolgstap" schrijf je in het ${languageName}.`;

  const userContent = transcript
    ? `Transcript van het gesprek:\n\n${transcript}`
    : 'Er is geen gesprek tot stand gekomen (de helpdesk nam niet op of het gesprek mislukte).';

  let raw;
  try {
    raw = await callClaude(anthropic, system, [{ role: 'user', content: userContent }]);
  } catch (err) {
    return {
      status: 'lopend',
      samenvatting: `Kon geen samenvatting genereren: ${err.message}`,
      referentienummer: null,
      vervolgstap: null,
    };
  }

  return parseSummary(raw);
}

// Parseert de JSON van Claude robuust (haalt zo nodig het JSON-blok uit ruwe tekst).
function parseSummary(raw) {
  const fallback = {
    status: 'lopend',
    samenvatting: raw || 'Geen samenvatting beschikbaar.',
    referentienummer: null,
    vervolgstap: null,
  };
  if (!raw) return fallback;

  let text = raw.trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }

  try {
    const parsed = JSON.parse(text);
    return {
      status: parsed.status || 'lopend',
      samenvatting: parsed.samenvatting || 'Geen samenvatting beschikbaar.',
      referentienummer: parsed.referentienummer ?? null,
      vervolgstap: parsed.vervolgstap ?? null,
    };
  } catch {
    return fallback;
  }
}

// --- Helpers --------------------------------------------------------------

// Twilio verstuurt application/x-www-form-urlencoded. Lees en parse het body.
async function parseBody(req) {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    return new URLSearchParams(text);
  }
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const params = new URLSearchParams();
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') params.set(k, v);
    }
    return params;
  }
  // Fallback: probeer als urlencoded te lezen.
  try {
    return new URLSearchParams(await req.text());
  } catch {
    return new URLSearchParams();
  }
}

function twiml(xml) {
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

function hangupResponse(message) {
  const vr = new VoiceResponse();
  vr.play(speakUrl(message));
  vr.hangup();
  return vr.toString();
}

export const config = {
  path: '/api/conversation',
};
