import { useLang } from '../i18n.js';
import PhaseIndicator from './PhaseIndicator.jsx';

export default function CallTranscript({ phase, messages }) {
  const { t } = useLang();

  // Spreker-labels: het gesprek is Nederlands, dus de rollen houden we herkenbaar.
  function speakerLabel(speaker) {
    if (speaker === 'ai') return 'AI';
    if (speaker === 'agent') return '☎';
    return 'ℹ';
  }

  return (
    <>
      <section className="card">
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
