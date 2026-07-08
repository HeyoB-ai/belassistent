import { useState } from 'react';
import { useLang } from '../i18n.js';

export default function CallForm({ onSubmit, busy }) {
  const { t, isRtl } = useLang();

  const [company, setCompany] = useState('');
  const [helpdeskNumber, setHelpdeskNumber] = useState('');
  const [task, setTask] = useState('');
  const [goal, setGoal] = useState('');
  const [email, setEmail] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    onSubmit({
      company: company.trim(),
      helpdesk_number: helpdeskNumber.trim(),
      task: task.trim(),
      goal: goal.trim(),
      email: email.trim(),
    });
  }

  return (
    <section className="card">
      <h2 className="form-title">{t.formTitle}</h2>
      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="company">{t.companyLabel}</label>
          <input
            id="company"
            type="text"
            required
            placeholder={t.companyPlaceholder}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="helpdesk">{t.phoneLabel}</label>
          <input
            id="helpdesk"
            type="tel"
            required
            dir="ltr"
            placeholder={t.phonePlaceholder}
            value={helpdeskNumber}
            onChange={(e) => setHelpdeskNumber(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="task">{t.taskLabel}</label>
          <textarea
            id="task"
            required
            rows={5}
            dir={isRtl ? 'rtl' : 'ltr'}
            placeholder={t.taskPlaceholder}
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />
        </div>

        {/* Optionele velden */}
        <div className="optional-divider">
          <span>{t.optionalHeader}</span>
        </div>

        <div className="field">
          <label htmlFor="goal">{t.goalLabel}</label>
          <textarea
            id="goal"
            rows={3}
            dir={isRtl ? 'rtl' : 'ltr'}
            placeholder={t.goalPlaceholder}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <p className="field-hint">{t.goalHint}</p>
        </div>

        <div className="field">
          <label htmlFor="email">{t.emailLabel}</label>
          <input
            id="email"
            type="email"
            dir="ltr"
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="field-hint">{t.emailHint}</p>
        </div>

        <p className="form-hint">{t.formHint}</p>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t.callingStatus : t.startButton}
        </button>
      </form>
    </section>
  );
}
