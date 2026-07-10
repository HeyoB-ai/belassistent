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

   **Supabase (optioneel — voor het premium-accountsysteem).** Zonder deze variabelen
   werkt de app als gratis versie (geen account, geen verificatiegesprekken). Met deze
   variabelen komen registratie/login en het beveiligde verificatieprofiel beschikbaar:

   | Variabele | Waarde |
   | --------- | ------ |
   | `VITE_SUPABASE_URL` | Je Supabase project-URL (frontend; `VITE_`-prefix verplicht) |
   | `VITE_SUPABASE_ANON_KEY` | De publieke anon-key (frontend; RLS beschermt de data) |
   | `SUPABASE_URL` | Dezelfde project-URL (server-side functions) |
   | `SUPABASE_SERVICE_ROLE_KEY` | De service-role sleutel — **NOOIT** naar de client; alleen server-side |

   > **Verplicht bij Supabase:** voer eenmalig [`supabase/schema.sql`](supabase/schema.sql)
   > uit in de Supabase SQL-editor. Dat maakt de `profiles`-tabel **met Row-Level Security
   > aan**, zodat elke gebruiker uitsluitend zijn eigen profiel kan lezen/schrijven
   > (`auth.uid() = user_id`). Zonder RLS is de data niet beschermd.

   Optionele gesprek-tuning (met defaults):

   | Variabele | Default | Wat het doet |
   | --------- | ------- | ------------ |
   | `SPEECH_TIMEOUT` | `auto` | `speechTimeout` van de `<Gather>`. `auto` vangt hele IVR-menu-opties op; `1` / `1.5` maakt de beurt-overgang bij mensgesprekken sneller. |
   | `MAX_DTMF` | `5` | Max toetskeuzes zonder medewerker; daarna probeert de AI `0` (operator) en hangt anders netjes op. |
   | `MAX_HOLD_MINUTES` | `10` | Absolute wachttijd-bovengrens. Een normale wachtrij mag lang duren; dit grijpt alleen in tegen een nummer dat nooit een medewerker geeft. |

   > `URL` hoef je **niet** te zetten: Netlify vult die automatisch met de deploy-URL,
   > waarmee de app de Twilio-webhook-URL opbouwt.

4. **Deploy.** Netlify bouwt en publiceert. Open de site-URL en start een belopdracht.

> **Let op (Twilio proefaccount):** een gratis Twilio-account kan alleen bellen naar
> geverifieerde nummers. Verifieer het helpdesk-testnummer onder
> **Twilio Console → Phone Numbers → Verified Caller IDs**.

## Premium-accountsysteem & beveiliging

Optioneel, via Supabase. Twee niveaus:

- **Gratis (light):** informatieve gesprekken, geen account nodig — werkt precies als voorheen.
- **Premium:** account + beveiligd **verificatieprofiel**, waarmee de AI identiteitsverificatie
  bij een helpdesk kan doorlopen.

Hoe de beveiliging is geregeld:

- **Auth:** e-mail + wachtwoord via **Supabase Auth**. De app slaat **nooit** wachtwoorden op.
- **Row-Level Security (RLS):** `supabase/schema.sql` zet RLS aan met vier policies
  (select/insert/update/delete), telkens `auth.uid() = user_id`. Zo kan gebruiker A
  fysiek niet bij de data van gebruiker B — de database dwingt dit af, niet de frontend.
- **Alleen toegestane velden:** voornaam, achternaam, postcode, huisnummer, geboortedatum
  en optionele klantnummers. Er zijn **bewust geen velden** voor BSN, bankrekening/creditcard
  of ID-kopie.
- **Verificatiedata blijft server-side:** bij een verificatiegesprek stuurt de frontend
  alleen een `Authorization: Bearer <token>` mee. `initiate-call.js` verifieert het JWT met
  de **service-role** sleutel, haalt het profiel op en zet het in de call-state (Netlify Blobs).
  De data gaat **nooit** via een URL-parameter, en `call-status.js` geeft **alleen** een
  whitelist terug (`status`, `phase`, `messages`, `outcome`) — dus nooit de verificatiedata.
- **Geen plaintext-logging:** de verificatiedata wordt nergens in de function-logs geprint;
  ze staat alleen in de (niet-gelogde) system-prompt van Claude.
- **AI-gedrag:** de AI geeft postcode/huisnummer/geboortedatum **uitsluitend** wanneer een
  **echte medewerker** (fase 3) er expliciet om vraagt — nooit aan een keuzemenu of in de
  wachtrij, en nooit meer dan gevraagd.
- **AVG/GDPR:** expliciete consent-checkbox vóór opslag (met tijdstip in `consent_at`);
  privacyverklaring in de app; gebruiker kan alle data **inzien, wijzigen en verwijderen**.
  Account verwijderen (`delete-account.js`) wist de profielrij én het auth-account echt
  (recht op vergetelheid).

> **Betaling (Stripe/Mollie)** is nog niet aangesloten. `is_premium` op het profiel is de
> gate; zet die (voorlopig handmatig) op `true` om premium te activeren. De betaal-hook
> hoort logisch bij het omzetten van `is_premium`.

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
├── supabase/
│   └── schema.sql            # profiles-tabel + RLS-policies (voer uit in Supabase)
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── i18n.js
│   ├── supabase.js           # client + AuthProvider/useAuth (null-safe zonder env)
│   └── components/
│       ├── LanguagePicker.jsx
│       ├── CallForm.jsx
│       ├── CallTranscript.jsx
│       ├── CallSummary.jsx
│       ├── AuthPanel.jsx      # inloggen/registreren + consent
│       ├── ProfilePanel.jsx   # profiel inzien/bewerken/verwijderen
│       └── PrivacyPolicy.jsx  # AVG-privacyverklaring
└── netlify/
    ├── shared/
    │   ├── tts.js
    │   └── supabaseAdmin.js   # server-side admin-client + JWT-verificatie
    └── functions/
        ├── initiate-call.js   # + verificatiedata server-side laden
        ├── conversation.js
        ├── call-status.js
        └── delete-account.js  # recht op vergetelheid
```
