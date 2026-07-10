import { useEffect, useRef, useState } from 'react';
import { useLang } from './i18n.js';
import LanguagePicker from './components/LanguagePicker.jsx';
import CallForm from './components/CallForm.jsx';
import CallTranscript from './components/CallTranscript.jsx';
import CallSummary from './components/CallSummary.jsx';

const PHASE = {
  FORM: 'form',
  LIVE: 'live',
  DONE: 'done',
  FAILED: 'failed',
};

const TERMINAL = ['completed', 'busy', 'no-answer', 'failed', 'canceled'];
const FAILED_STATUSES = ['busy', 'no-answer', 'failed', 'canceled'];

const STORAGE_KEY = 'belassistent_form';
const EMPTY_FORM = {
  callerName: '',
  company: '',
  helpdesk_number: '',
  task: '',
  goal: '',
  email: '',
  reference: '',
};

// Laad de eerder ingevoerde formuliergegevens uit localStorage (indien beschikbaar).
// localStorage kan in sommige sandbox-previews ontbreken/afgeschermd zijn — dan vangen we dat op.
function loadForm() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY_FORM, ...JSON.parse(raw) };
  } catch {
    /* localStorage niet beschikbaar */
  }
  return { ...EMPTY_FORM };
}

export default function App() {
  const { lang, setLang, t, isRtl } = useLang();

  const [phase, setPhase] = useState(PHASE.FORM);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  const [form, setForm] = useState(loadForm);

  const [callSid, setCallSid] = useState(null);
  const [status, setStatus] = useState('initiated');
  const [callPhase, setCallPhase] = useState('connecting');
  const [messages, setMessages] = useState([]);
  const [outcome, setOutcome] = useState(null);

  const pollRef = useRef(null);

  // Bewaar formuliergegevens in de browser bij elke wijziging (terugkomen na refresh).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* localStorage niet beschikbaar */
    }
  }, [form]);

  // Documentrichting (RTL voor Arabisch) + taalattribuut.
  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang || 'en';
  }, [isRtl, lang]);

  // Poll /api/call-status elke 2 seconden zodra er een callSid is.
  useEffect(() => {
    if (phase !== PHASE.LIVE || !callSid) return undefined;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/call-status?callSid=${encodeURIComponent(callSid)}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        setStatus(data.status || 'initiated');
        setCallPhase(data.phase || 'connecting');
        setMessages(Array.isArray(data.messages) ? data.messages : []);

        if (TERMINAL.includes(data.status)) {
          if (FAILED_STATUSES.includes(data.status)) {
            // Mislukt gesprek: gegevens blijven bewaard, toon "opnieuw proberen".
            clearInterval(pollRef.current);
            setPhase(PHASE.FAILED);
          } else if (data.status === 'completed' && data.outcome) {
            setOutcome(data.outcome);
            clearInterval(pollRef.current);
            setPhase(PHASE.DONE);
          }
          // completed zonder outcome: blijf pollen tot de samenvatting klaar is.
        }
      } catch {
        // Poll-fouten stil houden: de volgende tick probeert het opnieuw.
      }
    }

    poll();
    pollRef.current = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [phase, callSid]);

  function onField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function startCall() {
    setError(null);
    setStarting(true);
    try {
      const res = await fetch('/api/initiate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, language: lang }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Status ${res.status}`);
      }
      const data = await res.json();
      if (!data.callSid) throw new Error('No callSid');

      setCallSid(data.callSid);
      setStatus('initiated');
      setCallPhase('connecting');
      setMessages([]);
      setOutcome(null);
      setPhase(PHASE.LIVE);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  // Terug naar het formulier met ALLE velden nog ingevuld (opnieuw proberen /
  // nieuwe belopdracht — vaak wil men een kleine variatie bellen).
  function backToForm() {
    clearInterval(pollRef.current);
    setPhase(PHASE.FORM);
    setError(null);
    setCallSid(null);
    setStatus('initiated');
    setCallPhase('connecting');
    setMessages([]);
    setOutcome(null);
  }

  // Formulier én opgeslagen gegevens wissen voor een frisse start.
  function clearForm() {
    setForm({ ...EMPTY_FORM });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage niet beschikbaar */
    }
  }

  function changeLanguage() {
    backToForm();
    setLang(null);
  }

  if (!lang) {
    return <LanguagePicker />;
  }

  return (
    <div className="app" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="topbar">
        <button type="button" className="lang-switch" onClick={changeLanguage}>
          🌐 {t.changeLanguage}
        </button>
      </div>

      <header className="header">
        <h1>{t.appTitle}</h1>
        <p className="tagline">{t.appSubtitle}</p>
      </header>

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      <main>
        {phase === PHASE.FORM && (
          <CallForm
            form={form}
            onField={onField}
            onSubmit={startCall}
            onClear={clearForm}
            busy={starting}
          />
        )}

        {phase === PHASE.LIVE && <CallTranscript phase={callPhase} messages={messages} />}

        {phase === PHASE.DONE && <CallSummary outcome={outcome} onReset={backToForm} />}

        {phase === PHASE.FAILED && (
          <section className="card failed">
            <h2>{t.callFailedTitle}</h2>
            <p>{t.callFailedMessage}</p>
            <button type="button" className="btn-primary" onClick={backToForm}>
              {t.retryButton}
            </button>
          </section>
        )}
      </main>

      <footer className="footer">
        <small>Powered by Twilio &amp; Claude</small>
      </footer>
    </div>
  );
}
