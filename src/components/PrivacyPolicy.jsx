import { useLang } from '../i18n.js';
import Icon from './Icon.jsx';

// Privacyverklaring (AVG/GDPR). Placeholder-inhoud, maar met de verplichte structuur:
// welke data, waarom, hoe lang, en welke rechten de gebruiker heeft.
export default function PrivacyPolicy({ onBack }) {
  const { t } = useLang();

  const sections = [
    { icon: 'list', title: t.privacyWhatTitle, body: t.privacyWhatBody },
    { icon: 'target', title: t.privacyWhyTitle, body: t.privacyWhyBody },
    { icon: 'clock', title: t.privacyRetentionTitle, body: t.privacyRetentionBody },
    { icon: 'shield', title: t.privacyRightsTitle, body: t.privacyRightsBody },
  ];

  return (
    <section className="card privacy-card">
      <button type="button" className="btn-clear inline" onClick={onBack}>
        <Icon name="chevron-right" size={16} className="flip" />
        {t.backButton}
      </button>

      <h2 className="form-title">{t.privacyTitle}</h2>
      <p className="privacy-intro">{t.privacyIntro}</p>

      <div className="privacy-sections">
        {sections.map((s) => (
          <div className="privacy-section" key={s.title}>
            <h3>
              <Icon name={s.icon} size={16} />
              {s.title}
            </h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
