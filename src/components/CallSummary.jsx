import { useLang } from '../i18n.js';
import Icon from './Icon.jsx';

// De vaste status-waarde uit Claude (opgelost/lopend/terugbellen) → i18n-label, kleur, icoon.
const STATUS_MAP = {
  opgelost: { cls: 'resolved', key: 'statusResolved', icon: 'check-circle' },
  lopend: { cls: 'pending', key: 'statusPending', icon: 'clock' },
  terugbellen: { cls: 'callback', key: 'statusCallback', icon: 'phone-call' },
};

export default function CallSummary({ outcome, onReset }) {
  const { t } = useLang();

  const statusKey = (outcome?.status || '').toLowerCase();
  const statusInfo = STATUS_MAP[statusKey] || STATUS_MAP.lopend;
  const statusLabel = t[statusInfo.key];

  return (
    <section className="card summary">
      <h2>{t.summaryTitle}</h2>

      <div className="summary-status">
        <span className={`badge ${statusInfo.cls}`}>
          <Icon name={statusInfo.icon} size={16} strokeWidth={2} />
          {statusLabel}
        </span>
      </div>

      <div className="summary-block">
        <span className="summary-key">
          <Icon name="message" size={15} />
          {t.resultLabel}
        </span>
        <p>{outcome?.samenvatting || '—'}</p>
      </div>

      <div className="summary-row">
        <span className="summary-key">
          <Icon name="hash" size={15} />
          {t.referenceLabel}
        </span>
        <span className="summary-value">{outcome?.referentienummer || '—'}</span>
      </div>

      <div className="summary-block">
        <span className="summary-key">
          <Icon name="arrow-up-right" size={15} />
          {t.nextStepLabel}
        </span>
        <p>{outcome?.vervolgstap || '—'}</p>
      </div>

      <button type="button" className="btn-primary" onClick={onReset}>
        {t.restartButton}
        <span className="btn-icon" aria-hidden="true">
          <Icon name="arrow-up-right" size={18} strokeWidth={2} />
        </span>
      </button>
    </section>
  );
}
