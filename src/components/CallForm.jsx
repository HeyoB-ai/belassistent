import { useLang } from '../i18n.js';

// Gecontroleerd formulier: de waarden komen uit App (form) en wijzigen via onField,
// zodat de invoer bewaard blijft tussen fases en in localStorage.
export default function CallForm({ form, onField, onSubmit, onClear, busy }) {
  const { t, isRtl } = useLang();

  function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    onSubmit();
  }

  return (
    <section className="card">
      <h2 className="form-title">{t.formTitle}</h2>
      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="callerName">{t.callerNameLabel}</label>
          <input
            id="callerName"
            type="text"
            required
            dir={isRtl ? 'rtl' : 'ltr'}
            placeholder={t.callerNamePlaceholder}
            value={form.callerName}
            onChange={(e) => onField('callerName', e.target.value)}
          />
          <p className="field-hint">{t.callerNameHint}</p>
        </div>

        <div className="field">
          <label htmlFor="company">{t.companyLabel}</label>
          <input
            id="company"
            type="text"
            required
            placeholder={t.companyPlaceholder}
            value={form.company}
            onChange={(e) => onField('company', e.target.value)}
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
            value={form.helpdesk_number}
            onChange={(e) => onField('helpdesk_number', e.target.value)}
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
            value={form.task}
            onChange={(e) => onField('task', e.target.value)}
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
            value={form.goal}
            onChange={(e) => onField('goal', e.target.value)}
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
            value={form.email}
            onChange={(e) => onField('email', e.target.value)}
          />
          <p className="field-hint">{t.emailHint}</p>
        </div>

        <div className="field">
          <label htmlFor="reference">{t.referenceLabel}</label>
          <input
            id="reference"
            type="text"
            dir={isRtl ? 'rtl' : 'ltr'}
            placeholder={t.referencePlaceholder}
            value={form.reference}
            onChange={(e) => onField('reference', e.target.value)}
          />
          <p className="field-hint">{t.referenceHint}</p>
        </div>

        <p className="form-hint">{t.formHint}</p>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t.callingStatus : t.startButton}
        </button>
        <button type="button" className="btn-clear" onClick={onClear}>
          {t.clearFormButton}
        </button>
      </form>
    </section>
  );
}
