import { useState } from 'react';

// Ondersteunde talen voor de samenvatting. Het gesprek zelf is altijd Nederlands.
const LANGUAGES = [
  { code: 'nl', label: 'Nederlands' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ar', label: 'العربية' },
  { code: 'pl', label: 'Polski' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文' },
];

export default function CallForm({ onSubmit, busy }) {
  const [language, setLanguage] = useState('nl');
  const [company, setCompany] = useState('');
  const [helpdeskNumber, setHelpdeskNumber] = useState('');
  const [task, setTask] = useState('');

  const isRtl = language === 'ar';

  function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    onSubmit({
      language,
      company: company.trim(),
      helpdesk_number: helpdeskNumber.trim(),
      task: task.trim(),
    });
  }

  return (
    <section className="card">
      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="language">Taal van de samenvatting</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="company">Bedrijf / helpdesk</label>
          <input
            id="company"
            type="text"
            required
            placeholder="Bijv. DHL, KPN, Coolblue"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="helpdesk">Telefoonnummer helpdesk</label>
          <input
            id="helpdesk"
            type="tel"
            required
            placeholder="+31201234567"
            value={helpdeskNumber}
            onChange={(e) => setHelpdeskNumber(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="task">Wat moet de AI regelen?</label>
          <textarea
            id="task"
            required
            rows={5}
            dir={isRtl ? 'rtl' : 'ltr'}
            placeholder="Beschrijf de taak, bijv.: Vraag naar de status van pakket 12345 dat op 3 juni verstuurd is maar nog niet is aangekomen. Vraag om een nieuwe leverdatum."
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Bezig met bellen…' : 'Start gesprek'}
        </button>
      </form>
    </section>
  );
}
