import twilio from 'twilio';
import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '@netlify/blobs';
import { normalizeForSpeech, generateTts } from '../shared/tts.js';

// Snel model voor de losse gespreksbeurten; krachtiger model voor de eind-samenvatting.
const MODEL_TURN = 'claude-haiku-4-5';
const MODEL_SUMMARY = 'claude-sonnet-4-6';
const VoiceResponse = twilio.twiml.VoiceResponse;

// ElevenLabs-stemmen (overschrijfbaar via env vars; fallback = standaardstemmen).
const VOICE_AI = process.env.ELEVENLABS_VOICE_AI || '21m00Tcm4TlvDq8ikWAM';
const VOICE_AGENT = process.env.ELEVENLABS_VOICE_AGENT || 'ErXwobaYiN019PkySvjV';

// Bouwt de /api/speak-URL voor <Play>. Tekst wordt URL-encoded zodat spaties en
// leestekens goed doorkomen; de twilio-lib escaped daarna de & naar &amp; in de TwiML.
function speakUrl(text, voice = VOICE_AI) {
  return `${process.env.URL}/api/speak?voice=${voice}&text=${encodeURIComponent(text)}`;
}

// Aantal vulwoorden in /api/filler (houd in sync met FILLER_TEXTS in filler.js).
// De filler-audio wordt gecachet, dus afspelen kost geen generatietijd — het maskeert
// de stilte terwijl Claude + ElevenLabs het echte antwoord maken.
const FILLER_COUNT = 4;
function fillerUrl(i) {
  return `${process.env.URL}/api/filler?voice=${VOICE_AI}&i=${i}`;
}

// Instelbare loop-beveiliging via env vars (per-request gelezen, met defaults).
function intEnv(name, def) {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}

// Bouwt een <Gather> die naar de helpdesk luistert (spraak én DTMF). De speechTimeout
// is instelbaar via de SPEECH_TIMEOUT env var (default 'auto' — vangt hele menu-opties op).
function addListenGather(vr, webhookUrl, speechTimeout = 'auto') {
  vr.gather({
    input: 'dtmf speech',
    language: 'nl-NL',
    speechTimeout,
    action: webhookUrl,
    method: 'POST',
  });
}

// Harde interne timeout: grijp RUIM vóór Netlify's ~10s in, zodat een beurt nooit
// tegen de function-timeout aanloopt en een 502 geeft.
const CLAUDE_TIMEOUT_MS = 6000;
const MAX_TURN_RETRY = 2; // aantal "moment"-fallbacks per beurt voordat we netjes afronden.
const WAITING_MARKER = 'In de wachtrij…';

// Verstreken tijd sinds de call is aangemaakt (voor de absolute wachttijd-bovengrens).
// Een normale wachtrij mag lang duren; dit dient alleen tegen een kapot nummer.
function holdElapsedMs(state) {
  const started = state && state.createdAt ? Date.parse(state.createdAt) : NaN;
  return Number.isFinite(started) ? Date.now() - started : 0;
}

// Verwijdert ALLE signalen/gedachten tussen haken ([WACHTEN], [DTMF:X], [EINDE] en
// eventuele meta-commentaar zoals "[Ik wacht op audio…]"). Wat overblijft is uitsluitend
// de echte, uit te spreken tekst. Wordt gebruikt vóór TTS én vóór het transcript, zodat
// er nooit interne signalen lekken.
function stripSignals(text) {
  return (text || '')
    .replace(/\[[^\]]*\]/g, ' ') // alle [ ... ]-segmenten
    .replace(/[[\]]/g, ' ') // losse haken
    .replace(/\s+/g, ' ')
    .trim();
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout na ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Houdt het gesprek levend als een beurt te lang dreigt te duren: korte Polly-melding
// (altijd geluid, geen externe afhankelijkheid) + retry van de generatie in de volgende
// beurt. Zo krijgt Twilio direct geldige TwiML en riskeren we nooit een 502.
function momentResponse(webhookUrl) {
  const vr = new VoiceResponse();
  vr.say({ voice: 'Polly.Ruben', language: 'nl-NL' }, 'Een moment alstublieft.');
  vr.redirect({ method: 'POST' }, `${webhookUrl}?step=retry`);
  return twiml(vr.toString());
}

// Kleine, dependency-vrije hash voor de cache-sleutel (geen node:crypto — dat kan door
// esbuild-bundling een runtime-stub worden die pas bij aanroep crasht).
function ttsKey(voice, text) {
  const s = `${voice}\n${text}`;
  let h1 = 2166136261; // FNV-1a
  let h2 = 5381; // djb2
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 = Math.imul(h2, 33) ^ c;
  }
  return `tts_${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}_${s.length}`;
}

// Echte fallback-keten voor een normaal antwoord: probeer ElevenLabs server-side; slaagt
// dat, cache de audio en speel <Play> uit die cache. Faalt het (timeout/error/leeg) OF
// gaat er iets mis, val dan voor DEZE ene beurt terug op Twilio <Say> (Polly, NL-stem)
// met dezelfde tekst. Zo is er altijd geluid en nooit dubbel (óf Play, óf Say).
// Deze functie gooit NOOIT — ze eindigt altijd met een verb op de VoiceResponse.
async function speakOrSay(vr, text, budgetLeftMs) {
  const normalized = normalizeForSpeech(text).slice(0, 1000) || 'Momentje.';
  try {
    const timeoutMs = Math.min(5000, Math.max(1500, budgetLeftMs));
    const ttsStart = Date.now();
    const result = await generateTts(normalized, VOICE_AI, timeoutMs);
    console.log(
      `[conv] ElevenLabs(inline)=${Date.now() - ttsStart}ms ok=${result.ok}${result.ok ? '' : ` (${result.error})`}`
    );
    if (result.ok) {
      const key = ttsKey(VOICE_AI, normalized);
      await getStore('tts').set(key, result.audio);
      vr.play(`${process.env.URL}/api/speak?key=${key}`);
      return;
    }
  } catch (err) {
    console.log(`[conv] speakOrSay-fout, val terug op Polly: ${err && err.stack ? err.stack : err}`);
  }
  // Vangnet: Polly met dezelfde tekst.
  vr.say({ voice: 'Polly.Ruben', language: 'nl-NL' }, normalized);
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
async function handleTurn(req) {
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

  // Situatie c) — terminale status: bewaar de ECHTE status (completed/busy/no-answer/
  // failed/canceled). Alleen bij 'completed' een samenvatting genereren; bij een
  // mislukte status was er geen gesprek en toont de frontend een "opnieuw proberen".
  if (TERMINAL.includes(callStatus)) {
    if (!state.finalized) {
      state.finalized = true;
      state.status = callStatus;
      state.phase = 'done';
      if (callStatus === 'completed') {
        state.outcome = await generateSummary(anthropic, state);
      }
      await store.setJSON(callSid, state);
    }
    return new Response('', { status: 204 });
  }

  // Voice-webhook: het gesprek loopt.
  state.status = 'in-progress';

  // Instelbaar via env (per-request; defaults: auto / 5 / 10 min).
  const speechTimeout = process.env.SPEECH_TIMEOUT || 'auto';
  const maxDtmf = intEnv('MAX_DTMF', 5);
  const maxHoldMs = intEnv('MAX_HOLD_MINUTES', 10) * 60000;

  const step = new URL(req.url).searchParams.get('step');
  const turnStart = Date.now();
  console.log(`[conv] start callSid=${callSid} step=${step || '-'} speech=${speech ? 'ja' : 'nee'}`);

  // ── LUISTER-STAP ─────────────────────────────────────────────────────────
  // Geen spraak en geen retry (verbinding net open, of stilte-herhaling via
  // ?step=listen): NIET praten maar luisteren. Veel helpdesks starten meteen met een
  // IVR-keuzemenu — daar mogen we niet overheen praten. We vangen spraak én DTMF op.
  if (!speech && step !== 'retry') {
    state.listenCount = (state.listenCount || 0) + 1;
    // Nog geen contact = verbinden; daarna is stilte/muziek een wachtrij.
    state.phase = state.messages.length ? 'waiting' : 'connecting';
    console.log(`[conv] callSid=${callSid} fase=${state.phase} (stilte/muziek, luisterbeurt ${state.listenCount})`);
    // Stilte/wachtmuziek is normaal wachten — NIET ophangen op een luister-teller. Alleen
    // een ruime absolute bovengrens (MAX_HOLD_MINUTES) tegen een kapot nummer.
    if (holdElapsedMs(state) > maxHoldMs) {
      state.messages.push({ speaker: 'system', text: 'Maximale wachttijd bereikt zonder medewerker.' });
      await store.setJSON(callSid, state);
      console.log(`[conv] einde callSid=${callSid} turn=${Date.now() - turnStart}ms (wachttijd-limiet, ophangen)`);
      return twiml(hangupResponse('Het is helaas niet gelukt om iemand te bereiken. Ik probeer het later opnieuw. Tot ziens.'));
    }
    await store.setJSON(callSid, state);

    const vr = new VoiceResponse();
    addListenGather(vr, webhookUrl, speechTimeout);
    vr.redirect({ method: 'POST' }, `${webhookUrl}?step=listen`);
    console.log(`[conv] einde callSid=${callSid} turn=${Date.now() - turnStart}ms (blijven luisteren)`);
    return twiml(vr.toString());
  }

  // ── SPRAAK BINNEN (of retry): Claude beslist menu vs. mens ───────────────
  // Bij een verse beurt slaan we het agent-bericht op; bij een retry (na een te trage
  // vorige poging) staat het er al en genereren we opnieuw.
  if (speech) {
    state.messages.push({ speaker: 'agent', text: speech });
    state.listenCount = 0; // reactie ontvangen → stilte-teller resetten
  }

  const claudeMessages = [
    { role: 'user', content: '[De verbinding met de helpdesk is tot stand gekomen.]' },
  ];
  for (const m of state.messages) {
    if (m.speaker === 'system') continue;
    claudeMessages.push({
      role: m.speaker === 'ai' ? 'assistant' : 'user',
      content: m.text,
    });
  }

  // Claude met HARDE timeout — loopt nooit tegen Netlify's ~10s aan.
  let reply;
  const claudeStart = Date.now();
  try {
    reply = await withTimeout(
      callClaude(anthropic, buildSystemPrompt(state), claudeMessages),
      CLAUDE_TIMEOUT_MS,
      'Claude'
    );
    console.log(`[conv] callSid=${callSid} Claude=${Date.now() - claudeStart}ms`);
  } catch (err) {
    console.log(`[conv] callSid=${callSid} Claude FAALDE na ${Date.now() - claudeStart}ms: ${err.message}`);
    state.retryCount = (state.retryCount || 0) + 1;

    if (state.retryCount > MAX_TURN_RETRY) {
      // Blijft te traag: netjes afronden i.p.v. eindeloos "moment".
      state.retryCount = 0;
      state.messages.push({ speaker: 'system', text: `AI te traag/onbereikbaar: ${err.message}` });
      await store.setJSON(callSid, state);
      console.log(`[conv] einde callSid=${callSid} turn=${Date.now() - turnStart}ms (Claude opgegeven, ophangen)`);
      return twiml(hangupResponse('Sorry, er is een technisch probleem. Ik probeer het later opnieuw. Tot ziens.'));
    }
    // Budget dreigt te verlopen: "moment" + retry (agent-bericht is nu opgeslagen).
    await store.setJSON(callSid, state);
    console.log(`[conv] einde callSid=${callSid} turn=${Date.now() - turnStart}ms (moment-fallback, retry)`);
    return momentResponse(webhookUrl);
  }
  state.retryCount = 0; // gelukt → retry-teller resetten

  // Detecteer signalen in de RUWE reply; de te SPREKEN tekst is de reply ZONDER
  // signalen én zonder gedachten tussen haken. Zo lekt er nooit interne redenering.
  const dtmfMatch = reply.match(/\[DTMF:\s*([0-9*#]+)\]/i);
  const wantsEinde = /\[EINDE\]/i.test(reply);
  const spoken = stripSignals(reply);

  // ── Keuzemenu? Verstuur DTMF — ZONDER vulwoord. ──────────────────────────
  // Tegen een geautomatiseerd menu zegt een mens ook niks; de filler is daar
  // onnatuurlijk en kan het IVR-systeem storen. Dus: alleen de toon + luisteren.
  if (dtmfMatch) {
    console.log(`[conv] callSid=${callSid} fase=menu`);
    state.phase = 'menu';
    state.dtmfCount = (state.dtmfCount || 0) + 1;

    // Loop-beveiliging: te lang in keuzemenu's.
    if (state.dtmfCount > maxDtmf + 1) {
      state.messages.push({ speaker: 'system', text: 'Geen medewerker bereikt via het keuzemenu.' });
      await store.setJSON(callSid, state);
      console.log(`[conv] einde callSid=${callSid} turn=${Date.now() - turnStart}ms (keuzemenu opgegeven, ophangen)`);
      return twiml(hangupResponse('Het lukt helaas niet om via het keuzemenu een medewerker te bereiken. Ik probeer het later opnieuw. Tot ziens.'));
    }
    // Laatste redmiddel: probeer de operator (meestal 0).
    const tone = state.dtmfCount > maxDtmf ? '0' : dtmfMatch[1];

    state.messages.push({ speaker: 'ai', text: `Keuzemenu — toets ${tone} ingedrukt.` });
    await store.setJSON(callSid, state);

    const vr = new VoiceResponse();
    vr.play({ digits: tone }); // stuurt de DTMF-toon naar de helpdesk (geen filler)
    addListenGather(vr, webhookUrl, speechTimeout); // luister naar het volgende menu/antwoord
    vr.redirect({ method: 'POST' }, `${webhookUrl}?step=listen`);
    console.log(`[conv] einde callSid=${callSid} turn=${Date.now() - turnStart}ms (DTMF ${tone})`);
    return twiml(vr.toString());
  }

  // ── Fase 2: WACHTRIJ / HOLD — niets zeggen, alleen blijven luisteren. ─────
  // Ook wanneer er ná het strippen GEEN echte spraak overblijft (Claude gaf alleen een
  // signaal of een gedachte tussen haken): dan zwijgen, niets tonen, fase blijft wachtrij.
  if (/\[WACHTEN\]/i.test(reply) || !spoken) {
    console.log(`[conv] callSid=${callSid} fase=wachtrij`);
    state.phase = 'waiting';
    state.dtmfCount = 0; // voorbij het menu

    if (holdElapsedMs(state) > maxHoldMs) {
      state.messages.push({ speaker: 'system', text: 'Maximale wachttijd bereikt zonder medewerker.' });
      await store.setJSON(callSid, state);
      console.log(`[conv] einde callSid=${callSid} turn=${Date.now() - turnStart}ms (wachttijd-limiet, ophangen)`);
      return twiml(hangupResponse('Het is helaas niet gelukt om iemand te bereiken. Ik probeer het later opnieuw. Tot ziens.'));
    }

    // Houd de historie schoon: verwijder de zojuist opgeslagen wachtrij-mededeling en
    // toon één keer een wachtrij-indicator in het transcript.
    if (state.messages.length && state.messages[state.messages.length - 1].speaker === 'agent') {
      state.messages.pop();
    }
    const last = state.messages[state.messages.length - 1];
    if (!last || last.text !== WAITING_MARKER) {
      state.messages.push({ speaker: 'system', text: WAITING_MARKER });
    }
    await store.setJSON(callSid, state);

    // Geen spraak, geen filler — alleen blijven luisteren.
    const vr = new VoiceResponse();
    vr.pause({ length: 1 });
    addListenGather(vr, webhookUrl, speechTimeout);
    vr.redirect({ method: 'POST' }, `${webhookUrl}?step=listen`);
    console.log(`[conv] einde callSid=${callSid} turn=${Date.now() - turnStart}ms (wachtrij, blijven luisteren)`);
    return twiml(vr.toString());
  }

  // ── Fase 3: ECHTE MEDEWERKER — alleen wanneer er ECHTE spraak is (vulwoord + spraak). ──
  console.log(`[conv] callSid=${callSid} fase=medewerker`);
  state.phase = 'agent';
  state.dtmfCount = 0; // medewerker bereikt → menu-teller resetten
  const done = wantsEinde;

  // Geen vulwoord op de allereerste gespreksbeurt: de introductie begint direct
  // (geen "Even kijken" vooraf). Vanaf de vervolgbeurten maskeert de filler wel.
  const playFiller = state.hasSpoken === true;
  state.hasSpoken = true;

  state.messages.push({ speaker: 'ai', text: spoken });
  await store.setJSON(callSid, state);

  const vr = new VoiceResponse();
  if (playFiller) {
    vr.play(fillerUrl(Math.floor(Math.random() * FILLER_COUNT))); // vulwoord: alleen bij vervolgbeurten
  }
  // ElevenLabs met Polly-vangnet: nooit stilte als de TTS uitvalt (echte fallback-keten).
  await speakOrSay(vr, spoken, 8500 - (Date.now() - turnStart));

  if (done) {
    vr.hangup();
  } else {
    addListenGather(vr, webhookUrl, speechTimeout);
    vr.play(speakUrl('Ik hoor niets meer. Bedankt en tot ziens.'));
    vr.hangup();
  }

  console.log(`[conv] einde callSid=${callSid} turn=${Date.now() - turnStart}ms (spraak)`);
  return twiml(vr.toString());
}

// Laatste vangnet: welke fout dan ook tijdens de beurt → nooit een 502, altijd geldige
// TwiML die het gesprek levend houdt (korte Polly-melding + luisteren).
export default async function handler(req) {
  try {
    return await handleTurn(req);
  } catch (err) {
    console.log(`[conv] HANDLER-FOUT: ${err && err.stack ? err.stack : err}`);
    const base = process.env.URL || '';
    const vr = new VoiceResponse();
    vr.say({ voice: 'Polly.Ruben', language: 'nl-NL' }, 'Een moment alstublieft.');
    vr.gather({
      input: 'dtmf speech',
      language: 'nl-NL',
      speechTimeout: 'auto',
      action: `${base}/api/conversation`,
      method: 'POST',
    });
    vr.redirect({ method: 'POST' }, `${base}/api/conversation?step=listen`);
    console.log('[conv] einde (handler-fout vangnet)');
    return twiml(vr.toString());
  }
}

// --- Claude ---------------------------------------------------------------

function buildSystemPrompt(state) {
  const caller = state.callerName || 'de klant';

  const referentieInstructie = state.reference
    ? `De klant heeft een referentie meegegeven: ${state.reference}. Noem deze wanneer de medewerker om een klantnummer, ordernummer, trackingcode of soortgelijke identificatie vraagt. `
    : '';
  const goalInstructie = state.goal
    ? `Het uiteindelijke doel van ${caller} is: ${state.goal}. Werk gericht naar dit doel toe en neem geen genoegen met minder; als de medewerker iets biedt dat het doel niet haalt, vraag beleefd door naar een betere oplossing of alternatief. `
    : '';
  const emailInstructie = state.email
    ? `Als er een bevestiging, mail of document verstuurd kan worden, vraag de medewerker dit te sturen naar: ${state.email}. `
    : '';

  return `Je bent een professionele AI-belassistent. Je belt NAMENS ${caller} naar de helpdesk van ${state.company}. Het gesprek verloopt volledig in het Nederlands.

BELANGRIJK — verwar deze twee partijen niet:
- ${state.company} is de partij die je BELT (het gebelde bedrijf / de helpdesk). Je werkt NIET voor ${state.company} en je bent GEEN medewerker van ${state.company}. Zeg nooit dat je namens of voor ${state.company} werkt.
- Je vertegenwoordigt uitsluitend ${caller}. Alles wat je doet, doe je namens ${caller}.

De taak namens ${caller} is: ${state.task}.

Elke beurt hoor je audio van de kant die je belt. Bepaal eerst in welke van DRIE fasen het gesprek zit en handel daarnaar:

FASE 1 — KEUZEMENU (IVR): een geautomatiseerde stem die opties opnoemt met cijfers, zoals "voor bezorging toets 1, voor facturen toets 2, voor overige vragen toets 9". Kies de optie die het best past bij de taak van ${caller} en geef als ALLEREERSTE regel exact [DTMF:X] (X = het cijfer, bijvoorbeeld [DTMF:1]). Bij twijfel de meest waarschijnlijke route naar een echte medewerker ("overige vragen" of "klantenservice"). Praat verder niet.

FASE 2 — WACHTRIJ / WACHTEN: wachtmuziek, stilte, of een geautomatiseerde wachtmededeling zoals "blijf aan de lijn", "u wordt zo snel mogelijk geholpen", "alle medewerkers zijn momenteel in gesprek", "uw geschatte wachttijd is X minuten", "een moment geduld", "we helpen u zo", of herhalende meldingen. Dit is GEEN medewerker. Reageer NIET inhoudelijk, stel je NIET voor en bespreek de taak NIET. Geef als antwoord UITSLUITEND exact [WACHTEN] en verder niets. Blijf gewoon aan de lijn wachten. Sluit het gesprek in deze fase NOOIT af — een wachtrij is geen afronding, ook niet als hij lang duurt.

FASE 3 — ECHTE MEDEWERKER: een persoon die je persoonlijk aanspreekt, begroet, een vraag stelt of het gesprek echt aangaat ("goedemiddag, u spreekt met ...", "waarmee kan ik u helpen?", "met wie spreek ik?"). PAS NU voer je het gesprek. Hoor je de medewerker voor het eerst, open dan met: "Goedemiddag, u spreekt met een AI-assistent die belt namens ${caller}. Ik bel omdat ..." en beschrijf kort de reden (de taak).

${referentieInstructie}${goalInstructie}${emailInstructie}

Als je een referentienummer, klantnummer of e-mailadres noemt, zet het duidelijk en op zichzelf, bijvoorbeeld "Het klantnummer is: 1439812202604." of "Het e-mailadres is: marcel@vos.nl." Schrijf cijferreeksen gewoon aaneengesloten en e-mailadressen gewoon met @ en punt — haal ze zelf NIET uit elkaar; het systeem zorgt voor een duidelijke uitspraak.

Voer het gesprek (fase 3) beleefd, kort en doelgericht. Houd antwoorden kort, zoals in een echt telefoongesprek, meestal één of twee zinnen. Reageer natuurlijk op wat de medewerker zegt.

[EINDE] geef je UITSLUITEND als het doel écht met een medewerker is bereikt, of als de medewerker het gesprek zelf afsluit. Een wachtrij-boodschap, wachtmuziek, stilte of "u wordt zo geholpen" is NOOIT een reden voor [EINDE] — geef dan [WACHTEN].

STRIKT FORMAT (heel belangrijk): geef per beurt OFWEL uitsluitend één signaal ([WACHTEN], [DTMF:X] of [EINDE]), OFWEL uitsluitend de letterlijke tekst die je hardop wilt zeggen tegen de helpdesk. Geef NOOIT je interne overwegingen, gedachten of beschrijvingen van wat je hoort, en zet zulke meta-tekst ook NOOIT tussen haken. Dus schrijf bijvoorbeeld niet "[Ik wacht op audio en luister aandachtig]" — als je nog niets van een mens hoort, geef je simpelweg [WACHTEN] en verder niets.`;
}

async function callClaude(anthropic, system, messages, model = MODEL_TURN, maxTokens = 150) {
  const msg = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
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
    raw = await callClaude(
      anthropic,
      system,
      [{ role: 'user', content: userContent }],
      MODEL_SUMMARY,
      512
    );
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
