import { LANGUAGES, CHOOSE_TITLE, CHOOSE_SUBTITLE, useLang } from '../i18n.js';
import Icon from './Icon.jsx';

// Eerste view: taalkeuze. Per rij de vlag (groot, in tegel), naam in eigen schrift
// (prominent) en de Engelse naam eronder.
export default function LanguagePicker() {
  const { setLang } = useLang();

  return (
    <div className="picker">
      <div className="picker-head">
        <h1 className="picker-title">{CHOOSE_TITLE}</h1>
        <p className="picker-subtitle">{CHOOSE_SUBTITLE}</p>
      </div>

      <ul className="lang-list">
        {LANGUAGES.map((l) => (
          <li key={l.code}>
            <button
              type="button"
              className="lang-row"
              onClick={() => setLang(l.code)}
              aria-label={l.englishName}
            >
              <span className={`lang-flag fi fi-${l.flagCode}`} aria-hidden="true" />
              <span className="lang-names">
                <span className="lang-native" dir={l.rtl ? 'rtl' : 'ltr'}>
                  {l.nativeName}
                </span>
                <span className="lang-english">{l.englishName}</span>
              </span>
              <span className="lang-chevron">
                <Icon name="chevron-right" size={20} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
