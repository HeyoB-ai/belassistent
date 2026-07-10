import { useLang } from '../i18n.js';
import Icon from './Icon.jsx';

// Gecontroleerd formulier: waarden komen uit App (form), wijzigen via onField.
// verification/onVerification sturen de identiteitsverificatie-toggle; verifyNote toont
// waarom die (nog) niet kan (inloggen/premium/profiel).
export default function CallForm({
  form,
  onField,
  onSubmit,
  onClear,
  busy,
  verification = false,
  onVerification,
  verifyNote = '',
  verifyDisabled = false,
}) {
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
          <label htmlFor="callerName">
            <Icon name="user" size={16} />
            {t.callerNameLabel}
          </label>
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
          <label htmlFor="company">
            <Icon name="briefcase" size={16} />
            {t.companyLabel}
          </label>
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
          <label htmlFor="helpdesk">
            <Icon name="phone" size={16} />
            {t.phoneLabel}
          </label>
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
          <label htmlFor="task">
            <Icon name="message" size={16} />
            {t.taskLabel}
          </label>
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
          <Icon name="sparkles" size={14} />
          {t.optionalHeader}
        </div>

        <div className="field">
          <label htmlFor="goal">
            <Icon name="target" size={16} />
            {t.goalLabel}
          </label>
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
          <label htmlFor="email">
            <Icon name="mail" size={16} />
            {t.emailLabel}
          </label>
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
          <label htmlFor="reference">
            <Icon name="hash" size={16} />
            {t.referenceLabel}
          </label>
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

        {/* Identiteitsverificatie (premium) */}
        {onVerification && (
          <div className={`verify-toggle${verifyDisabled ? ' is-disabled' : ''}`}>
            <label className="verify-row">
              <input
                type="checkbox"
                checked={verification}
                disabled={verifyDisabled}
                onChange={(e) => onVerification(e.target.checked)}
              />
              <span className="verify-text">
                <span className="verify-label">
                  <Icon name="shield" size={16} />
                  {t.verifyToggleLabel}
                </span>
                <span className="field-hint">{t.verifyToggleHint}</span>
              </span>
            </label>
            {verifyNote && <p className="verify-note">{verifyNote}</p>}
          </div>
        )}

        <p className="form-hint">{t.formHint}</p>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t.callingStatus : t.startButton}
          <span className="btn-icon" aria-hidden="true">
            <Icon name="arrow-up-right" size={18} strokeWidth={2} />
          </span>
        </button>
        <button type="button" className="btn-clear" onClick={onClear}>
          <Icon name="eraser" size={16} />
          {t.clearFormButton}
        </button>
      </form>
    </section>
  );
}
