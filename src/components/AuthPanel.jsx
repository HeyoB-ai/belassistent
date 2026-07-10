import { useState } from 'react';
import { useLang } from '../i18n.js';
import { useAuth } from '../supabase.js';
import Icon from './Icon.jsx';

// Inloggen of registreren. Bij registreren is een expliciete AVG-consent-checkbox
// verplicht vóór het account wordt aangemaakt. Wachtwoorden gaan rechtstreeks naar
// Supabase Auth — deze app slaat ze nooit op.
export default function AuthPanel({ onPrivacy }) {
  const { t } = useLang();
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isSignup = mode === 'signup';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (isSignup && !consent) {
      setError(t.consentRequired);
      return;
    }
    setBusy(true);
    try {
      const { error: err } = isSignup
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password);
      if (err) {
        setError(err);
      } else if (isSignup) {
        setNotice(t.signupConfirmSent);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError(t.authEmailNeeded || 'Vul eerst je e-mailadres in.');
      return;
    }
    const { error: err } = await resetPassword(email.trim());
    if (err) setError(err);
    else setNotice(t.resetSent);
  }

  return (
    <section className="card account-card">
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          className={`auth-tab${!isSignup ? ' is-active' : ''}`}
          onClick={() => setMode('signin')}
        >
          <Icon name="log-in" size={16} />
          {t.signInTab}
        </button>
        <button
          type="button"
          className={`auth-tab${isSignup ? ' is-active' : ''}`}
          onClick={() => setMode('signup')}
        >
          <Icon name="user" size={16} />
          {t.signUpTab}
        </button>
      </div>

      {error && (
        <div className="alert" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <Icon name="check-circle" size={18} />
          {notice}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="auth-email">
            <Icon name="mail" size={16} />
            {t.emailLabel}
          </label>
          <input
            id="auth-email"
            type="email"
            required
            dir="ltr"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="auth-password">
            <Icon name="lock" size={16} />
            {t.authPasswordLabel}
          </label>
          <input
            id="auth-password"
            type="password"
            required
            dir="ltr"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {isSignup && (
          <label className="consent-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="consent-text">
              {t.consentText}{' '}
              {onPrivacy && (
                <button type="button" className="inline-link" onClick={onPrivacy}>
                  {t.privacyLink}
                </button>
              )}
            </span>
          </label>
        )}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t.loadingLabel : isSignup ? t.authSubmitSignUp : t.authSubmitSignIn}
          <span className="btn-icon" aria-hidden="true">
            <Icon name="arrow-up-right" size={18} strokeWidth={2} />
          </span>
        </button>

        {!isSignup && (
          <button type="button" className="btn-clear" onClick={handleReset}>
            {t.forgotPasswordLink}
          </button>
        )}
      </form>
    </section>
  );
}
