// UI-labels per taal. De inhoud (samenvatting, vervolgstap) komt al vertaald van Claude;
// dit vertaalt alleen de vaste kopjes en knop. Onbekende talen vallen terug op Engels.
const LABELS = {
  nl: { title: 'Samenvatting', status: 'Status', summary: 'Samenvatting', ref: 'Referentienummer', next: 'Vervolgstap', again: 'Nieuwe belopdracht', none: '—' },
  en: { title: 'Summary', status: 'Status', summary: 'Summary', ref: 'Reference number', next: 'Next step', again: 'New call', none: '—' },
  tr: { title: 'Özet', status: 'Durum', summary: 'Özet', ref: 'Referans numarası', next: 'Sonraki adım', again: 'Yeni arama', none: '—' },
  ar: { title: 'الملخص', status: 'الحالة', summary: 'الملخص', ref: 'الرقم المرجعي', next: 'الخطوة التالية', again: 'مكالمة جديدة', none: '—' },
  pl: { title: 'Podsumowanie', status: 'Status', summary: 'Podsumowanie', ref: 'Numer referencyjny', next: 'Następny krok', again: 'Nowe połączenie', none: '—' },
  es: { title: 'Resumen', status: 'Estado', summary: 'Resumen', ref: 'Número de referencia', next: 'Siguiente paso', again: 'Nueva llamada', none: '—' },
  fr: { title: 'Résumé', status: 'Statut', summary: 'Résumé', ref: 'Numéro de référence', next: 'Étape suivante', again: 'Nouvel appel', none: '—' },
  zh: { title: '总结', status: '状态', summary: '总结', ref: '参考编号', next: '后续步骤', again: '新的通话', none: '—' },
};

// Vertaalt de vaste Nederlandse status-waarde uit Claude naar het label + kleur.
const STATUS_MAP = {
  opgelost: { cls: 'resolved', nl: 'Opgelost', en: 'Resolved', tr: 'Çözüldü', ar: 'تم الحل', pl: 'Rozwiązane', es: 'Resuelto', fr: 'Résolu', zh: '已解决' },
  lopend: { cls: 'pending', nl: 'Lopend', en: 'Pending', tr: 'Devam ediyor', ar: 'قيد المعالجة', pl: 'W toku', es: 'En curso', fr: 'En cours', zh: '进行中' },
  terugbellen: { cls: 'callback', nl: 'Terugbellen', en: 'Callback', tr: 'Geri arama', ar: 'معاودة الاتصال', pl: 'Oddzwonienie', es: 'Devolver llamada', fr: 'Rappel', zh: '回电' },
};

export default function CallSummary({ outcome, language, onReset }) {
  const l = LABELS[language] || LABELS.en;
  const isRtl = language === 'ar';

  const statusKey = (outcome?.status || '').toLowerCase();
  const statusInfo = STATUS_MAP[statusKey];
  const statusLabel = statusInfo ? statusInfo[language] || statusInfo.en : outcome?.status || l.none;
  const statusCls = statusInfo ? statusInfo.cls : 'pending';

  return (
    <section className="card summary" dir={isRtl ? 'rtl' : 'ltr'}>
      <h2>{l.title}</h2>

      <div className="summary-row">
        <span className="summary-key">{l.status}</span>
        <span className={`badge ${statusCls}`}>{statusLabel}</span>
      </div>

      <div className="summary-block">
        <span className="summary-key">{l.summary}</span>
        <p>{outcome?.samenvatting || l.none}</p>
      </div>

      <div className="summary-row">
        <span className="summary-key">{l.ref}</span>
        <span>{outcome?.referentienummer || l.none}</span>
      </div>

      <div className="summary-block">
        <span className="summary-key">{l.next}</span>
        <p>{outcome?.vervolgstap || l.none}</p>
      </div>

      <button type="button" className="btn-primary" onClick={onReset}>
        {l.again}
      </button>
    </section>
  );
}
