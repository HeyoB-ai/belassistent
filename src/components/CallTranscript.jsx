import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n.js';
import Icon from './Icon.jsx';
import PhaseIndicator from './PhaseIndicator.jsx';

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CallTranscript({ phase, company, messages }) {
  const { t } = useLang();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Meelopende gesprekstimer.
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function speakerLabel(speaker) {
    if (speaker === 'ai') return 'AI';
    if (speaker === 'agent') return t.phaseAgent;
    return t.phaseWaiting;
  }

  return (
    <>
      <section className="card">
        {/* Levendige bel-/wacht-animatie */}
        <div className="call-orb">
          <span className="ring" aria-hidden="true" />
          <span className="ring" aria-hidden="true" />
          <span className="ring" aria-hidden="true" />
          <span className="orb-core" aria-hidden="true">
            <Icon name="phone-call" size={26} strokeWidth={2} />
          </span>
        </div>

        {company && <div className="call-company">{company}</div>}
        <div className="call-timer">
          <Icon name="clock" size={16} />
          {formatTime(elapsed)}
        </div>

        <PhaseIndicator phase={phase} />
      </section>

      <section className="card transcript">
        <div className="messages">
          {messages.length === 0 && <p className="empty">{t.transcriptEmpty}</p>}

          {messages.map((m, i) => (
            <div key={i} className={`bubble-row ${m.speaker}`}>
              <div className={`bubble ${m.speaker}`}>
                <span className="speaker">{speakerLabel(m.speaker)}</span>
                <span className="text">{m.text}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
