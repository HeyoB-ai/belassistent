import { LANGUAGES, CHOOSE_TITLES, useLang } from '../i18n.js';

// Eerste view: schermvullende taalkeuze. Geen Nederlandse (of andere) vaste UI —
// alleen vlaggen + de taalnaam in de eigen taal, plus "kies je taal" in meerdere talen.
export default function LanguagePicker() {
  const { setLang } = useLang();

  return (
    <div className="picker">
      <div className="picker-titles">
        {CHOOSE_TITLES.map((title, i) => (
          <span key={i} className="picker-title">
            {title}
          </span>
        ))}
      </div>

      <div className="picker-grid">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            className="lang-card"
            onClick={() => setLang(l.code)}
            dir={l.rtl ? 'rtl' : 'ltr'}
            aria-label={l.nativeName}
          >
            <span className="lang-flag" aria-hidden="true">
              {l.flag}
            </span>
            <span className="lang-name">{l.nativeName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
