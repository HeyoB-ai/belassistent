import { useLang } from '../i18n.js';

const LIVE_STATES = ['initiated', 'queued', 'ringing', 'in-progress'];

export default function CallTranscript({ status, messages }) {
  const { t } = useLang();
  const isLive = LIVE_STATES.includes(status);

  // Spreker-labels: het gesprek is Nederlands, dus de rollen houden we herkenbaar.
  function speakerLabel(speaker) {
    if (speaker === 'ai') return 'AI';
    if (speaker === 'agent') return '☎';
    return 'ℹ';
  }

  return (
    <section className="card transcript">
      <div className="statusbar">
        <span className={`live-dot ${isLive ? 'live' : 'ended'}`} aria-hidden="true" />
        <span className="status-text">{t.callingStatus}</span>
      </div>

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
  );
}
