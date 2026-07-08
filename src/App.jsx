import { useEffect, useRef, useState } from 'react';
import CallForm from './components/CallForm.jsx';
import CallTranscript from './components/CallTranscript.jsx';
import CallSummary from './components/CallSummary.jsx';

// Weergavefases van de app
const PHASE = {
  FORM: 'form',
  LIVE: 'live',
  DONE: 'done',
};

// Terminale Twilio-statussen: dan is het gesprek klaar en tonen we de samenvatting.
const TERMINAL = ['completed', 'busy', 'no-answer', 'failed', 'canceled'];

export default function App() {
  const [phase, setPhase] = useState(PHASE.FORM);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  const [language, setLanguage] = useState('nl');
  const [callSid, setCallSid] = useState(null);
  const [status, setStatus] = useState('initiated');
  const [messages, setMessages] = useState([]);
  const [outcome, setOutcome] = useState(null);

  const pollRef = useRef(null);

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
      } catch (err) {
        if (!cancelled) setError(`Kon status niet ophalen: ${err.message}`);
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
    setLanguage(form.language);
    try {
      const res = await fetch('/api/initiate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Status ${res.status}`);
      }
      const data = await res.json();
      if (!data.callSid) throw new Error('Geen callSid ontvangen van de server.');

      setCallSid(data.callSid);
      setStatus('initiated');
      setMessages([]);
      setOutcome(null);
      setPhase(PHASE.LIVE);
    } catch (err) {
      setError(`Bellen mislukt: ${err.message}`);
    } finally {
      setStarting(false);
    }
  }

  function reset() {
    clearInterval(pollRef.current);
    setPhase(PHASE.FORM);
    setError(null);
    setCallSid(null);
    setStatus('initiated');
    setMessages([]);
    setOutcome(null);
  }

  return (
    <div className="app">
      <header className="header">
        <h1>AI Belassistent</h1>
        <p className="tagline">
          Laat een AI-assistent namens jou een helpdesk bellen. Het gesprek verloopt in het
          Nederlands; de samenvatting krijg je in je eigen taal.
        </p>
      </header>

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      <main>
        {phase === PHASE.FORM && <CallForm onSubmit={startCall} busy={starting} />}

        {phase === PHASE.LIVE && (
          <CallTranscript status={status} messages={messages} />
        )}

        {phase === PHASE.DONE && (
          <CallSummary
            outcome={outcome}
            language={language}
            messages={messages}
            onReset={reset}
          />
        )}
      </main>

      <footer className="footer">
        <small>Powered by Twilio &amp; Claude</small>
      </footer>
    </div>
  );
}
