# AI Belassistent

Een **meertalige, taal-eerst** webapp waarmee een AI-assistent namens jou een helpdesk
belt. De AI voert het gesprek **volledig in het Nederlands** (spraak via ElevenLabs),
en de hele interface + eindsamenvatting zijn in de taal die je zelf kiest
(NL/TR/AR/PL/EN/ES/FR/ZH, inclusief RTL voor Arabisch).

De eerste view is een schermvullend **taalkeuze-scherm** (alleen vlaggen + taalnaam in de
eigen taal). Daarna is de volledige UI in die taal (uit `src/i18n.js`); rechtsboven zit
altijd een knop om van taal te wisselen.

## Hoe het werkt

- **Frontend** (React + Vite): formulier → live transcript → samenvatting.
- **Backend** (Netlify Functions):
  - `POST /api/initiate-call` — start een uitgaand Twilio-gesprek naar de helpdesk.
  - `POST /api/conversation` — Twilio-webhook: de AI opent, reageert op de medewerker
    (spraak via `<Gather input="speech">`), en genereert bij het einde een samenvatting.
  - `GET /api/call-status?callSid=xxx` — de frontend poll't hier elke 2 seconden.
  - `GET /api/speak?text=...&voice=...` — zet tekst om naar MP3 via ElevenLabs; Twilio
    speelt dit af met `<Play>`.
- **State**: per `callSid` opgeslagen in [Netlify Blobs](https://docs.netlify.com/blobs/overview/).
- **AI**: Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`.
- **Spraak**: TTS via **ElevenLabs** (`eleven_multilingual_v2`), afgespeeld door Twilio
  `<Play>`; spraakherkenning via Twilio `<Gather input="speech" language="nl-NL">`.

## Deployen naar Netlify

1. **Push naar GitHub.**

   ```bash
   git init
   git add .
   git commit -m "AI Belassistent"
   git branch -M main
   git remote add origin https://github.com/HeyoB-ai/belassistent.git
   git push -u origin main
   ```

2. **Importeer in Netlify.** Ga naar [app.netlify.com](https://app.netlify.com) →
   **Add new site → Import an existing project** → kies deze repo. Netlify leest
   `netlify.toml`; build command `npm run build` en publish-map `dist` staan al goed.

3. **Zet de environment variables.** In Netlify: **Site settings → Environment variables**,
   voeg toe:

   | Variabele            | Waarde                                             |
   | -------------------- | -------------------------------------------------- |
   | `TWILIO_ACCOUNT_SID` | Je Twilio Account SID (`AC...`)                    |
   | `TWILIO_AUTH_TOKEN`  | Je Twilio Auth Token                               |
   | `TWILIO_FROM_NUMBER` | Je Twilio-nummer in internationaal formaat (`+31…`) |
   | `ANTHROPIC_API_KEY`  | Je Anthropic API key (`sk-ant-...`)                |
   | `ELEVENLABS_API_KEY` | Je ElevenLabs API key (voor de spraak via `<Play>`) |
   | `ELEVENLABS_VOICE_AI` | Stem-ID (AI-assistent) — kies een NL/multilingual stem |
   | `ELEVENLABS_VOICE_AGENT` | Stem-ID (medewerker-simulatie, optioneel) |

   Optionele gesprek-tuning (met defaults):

   | Variabele | Default | Wat het doet |
   | --------- | ------- | ------------ |
   | `SPEECH_TIMEOUT` | `auto` | `speechTimeout` van de `<Gather>`. `auto` vangt hele IVR-menu-opties op; `1` / `1.5` maakt de beurt-overgang bij mensgesprekken sneller. |
   | `MAX_DTMF` | `5` | Max toetskeuzes zonder medewerker; daarna probeert de AI `0` (operator) en hangt anders netjes op. |
   | `MAX_LISTEN` | `6` | Max luisterbeurten bij aanhoudende stilte voordat de AI netjes ophangt. |

   > `URL` hoef je **niet** te zetten: Netlify vult die automatisch met de deploy-URL,
   > waarmee de app de Twilio-webhook-URL opbouwt.

4. **Deploy.** Netlify bouwt en publiceert. Open de site-URL en start een belopdracht.

> **Let op (Twilio proefaccount):** een gratis Twilio-account kan alleen bellen naar
> geverifieerde nummers. Verifieer het helpdesk-testnummer onder
> **Twilio Console → Phone Numbers → Verified Caller IDs**.

## Lokaal ontwikkelen

De `/api/*` endpoints draaien op Netlify Functions. Gebruik daarom `netlify dev`
(installeer eventueel de [Netlify CLI](https://docs.netlify.com/cli/get-started/)):

```bash
npm install
cp .env.example .env      # vul je Twilio- en Anthropic-sleutels in
npm run dev               # alleen de frontend (Vite) op :5173
# of, met de functions erbij:
netlify dev               # frontend + /api/* functions
```

Voor het **echt testen van de Twilio-webhooks lokaal** heb je een publiek bereikbare
URL nodig (Twilio moet je machine kunnen bereiken). Gebruik een tunnel zoals
`ngrok http 8888` en zet `URL` in `.env` op de tunnel-URL.

## Bestandsstructuur

```
belassistent/
├── index.html
├── vite.config.js
├── package.json
├── netlify.toml
├── .env.example
├── .gitignore
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── i18n.js
│   └── components/
│       ├── LanguagePicker.jsx
│       ├── CallForm.jsx
│       ├── CallTranscript.jsx
│       └── CallSummary.jsx
└── netlify/
    └── functions/
        ├── initiate-call.js
        ├── conversation.js
        └── call-status.js
```
