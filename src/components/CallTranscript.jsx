// Vertaalt de ruwe Twilio-status naar een leesbare Nederlandse omschrijving.
function statusLabel(status) {
  switch (status) {
    case 'initiated':
      return 'Gesprek wordt gestart…';
    case 'queued':
      return 'In de wachtrij…';
    case 'ringing':
      return 'De telefoon gaat over…';
    case 'in-progress':
      return 'Gesprek loopt';
    case 'completed':
      return 'Gesprek beëindigd';
    case 'busy':
      return 'In gesprek';
    case 'no-answer':
      return 'Niet opgenomen';
    case 'failed':
      return 'Mislukt';
    default:
      return status;
  }
}

const LIVE_STATES = ['initiated', 'queued', 'ringing', 'in-progress'];

function speakerLabel(speaker) {
  if (speaker === 'agent') return 'Medewerker';
  if (speaker === 'ai') return 'AI-assistent';
  return 'Systeem';
}

export default function CallTranscript({ status, messages }) {
  const isLive = LIVE_STATES.includes(status);

  return (
    <section className="card transcript">
      <div className="statusbar">
        <span className={`live-dot ${isLive ? 'live' : 'ended'}`} aria-hidden="true" />
        <span className="status-text">{statusLabel(status)}</span>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <p className="empty">Nog geen berichten. Zodra de medewerker opneemt, verschijnt hier het gesprek.</p>
        )}

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
