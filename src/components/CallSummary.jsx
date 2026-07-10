import { useLang } from '../i18n.js';

// De vaste status-waarde uit Claude (opgelost/lopend/terugbellen) → i18n-label + kleur.
const STATUS_MAP = {
  opgelost: { cls: 'resolved', key: 'statusResolved' },
  lopend: { cls: 'pending', key: 'statusPending' },
  terugbellen: { cls: 'callback', key: 'statusCallback' },
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
        <span className={`badge ${statusInfo.cls}`}>{statusLabel}</span>
      </div>

      <div className="summary-block">
        <span className="summary-key">{t.resultLabel}</span>
        <p>{outcome?.samenvatting || '—'}</p>
      </div>

      <div className="summary-row">
        <span className="summary-key">{t.referenceLabel}</span>
        <span className="summary-value">{outcome?.referentienummer || '—'}</span>
      </div>

      <div className="summary-block">
        <span className="summary-key">{t.nextStepLabel}</span>
        <p>{outcome?.vervolgstap || '—'}</p>
      </div>

      <button type="button" className="btn-primary" onClick={onReset}>
        {t.restartButton}
      </button>
    </section>
  );
}
