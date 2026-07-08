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
};

const TERMINAL = ['completed', 'busy', 'no-answer', 'failed', 'canceled'];

export default function App() {
  const { lang, setLang, t, isRtl } = useLang();

  const [phase, setPhase] = useState(PHASE.FORM);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  const [callSid, setCallSid] = useState(null);
  const [status, setStatus] = useState('initiated');
  const [messages, setMessages] = useState([]);
  const [outcome, setOutcome] = useState(null);

  const pollRef = useRef(null);

  // Zet documentrichting (RTL voor Arabisch) en taalattribuut.
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
        setMessages(Array.isArray(data.messages) ? data.messages : []);

        if (TERMINAL.includes(data.status) && data.outcome) {
          setOutcome(data.outcome);
          setPhase(PHASE.DONE);
          clearInterval(pollRef.current);
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

  async function startCall(form) {
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
      setMessages([]);
      setOutcome(null);
      setPhase(PHASE.LIVE);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  function resetCall() {
    clearInterval(pollRef.current);
    setPhase(PHASE.FORM);
    setError(null);
    setCallSid(null);
    setStatus('initiated');
    setMessages([]);
    setOutcome(null);
  }

  function changeLanguage() {
    resetCall();
    setLang(null); // terug naar het taalkeuze-scherm
  }

  // Geen taal gekozen → schermvullende taalkeuze (geen vaste UI-tekst).
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
        {phase === PHASE.FORM && <CallForm onSubmit={startCall} busy={starting} />}
        {phase === PHASE.LIVE && <CallTranscript status={status} messages={messages} />}
        {phase === PHASE.DONE && (
          <CallSummary outcome={outcome} onReset={resetCall} />
        )}
      </main>

      <footer className="footer">
        <small>Powered by Twilio &amp; Claude</small>
      </footer>
    </div>
  );
}
