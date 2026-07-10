import { useState } from 'react';
import { useLang } from '../i18n.js';
import { useAuth } from '../supabase.js';
import Icon from './Icon.jsx';

// Toon en bewerk het eigen verificatieprofiel; log uit; of verwijder account + data.
// Bevat GEEN velden voor BSN, bank of ID — die worden nooit opgeslagen.
export default function ProfilePanel({ onPrivacy }) {
  const { t } = useLang();
  const { user, profile, isPremium, saveProfile, signOut, deleteAccount } = useAuth();

  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    postcode: profile?.postcode || '',
    house_number: profile?.house_number || '',
    birth_date: profile?.birth_date || '',
    customer_numbers: profile?.customer_numbers || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      // Lege strings als null opslaan (datum mag niet '' zijn in een date-kolom).
      const payload = {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        postcode: form.postcode.trim() || null,
        house_number: form.house_number.trim() || null,
        birth_date: form.birth_date || null,
        customer_numbers: form.customer_numbers.trim() || null,
      };
      const { error: err } = await saveProfile(payload);
      if (err) setError(err);
      else setNotice(t.profileSaved);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await deleteAccount();
      if (err) setError(err);
      // Bij succes verdwijnt de sessie en toont App weer het AuthPanel.
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card account-card">
      <div className="account-head">
        <div>
          <p className="account-email">{user?.email}</p>
          <span className={`badge ${isPremium ? 'badge-premium' : 'badge-free'}`}>
            {isPremium ? t.premiumBadge : t.freeBadge}
          </span>
        </div>
        <button type="button" className="btn-clear inline" onClick={signOut}>
          <Icon name="log-out" size={16} />
          {t.signOutButton}
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

      <div className="profile-intro">
        <Icon name="shield" size={18} />
        <p>{t.profileIntro}</p>
      </div>

      <h2 className="form-title">{t.profileHeading}</h2>
      <form onSubmit={handleSave} className="form">
        <div className="field-row">
          <div className="field">
            <label htmlFor="first_name">
              <Icon name="user" size={16} />
              {t.firstNameLabel}
            </label>
            <input
              id="first_name"
              type="text"
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="last_name">
              <Icon name="user" size={16} />
              {t.lastNameLabel}
            </label>
            <input
              id="last_name"
              type="text"
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="postcode">
              <Icon name="map-pin" size={16} />
              {t.postcodeLabel}
            </label>
            <input
              id="postcode"
              type="text"
              value={form.postcode}
              onChange={(e) => set('postcode', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="house_number">
              <Icon name="home" size={16} />
              {t.houseNumberLabel}
            </label>
            <input
              id="house_number"
              type="text"
              value={form.house_number}
              onChange={(e) => set('house_number', e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="birth_date">
            <Icon name="calendar" size={16} />
            {t.birthDateLabel}
          </label>
          <input
            id="birth_date"
            type="date"
            dir="ltr"
            value={form.birth_date}
            onChange={(e) => set('birth_date', e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="customer_numbers">
            <Icon name="hash" size={16} />
            {t.customerNumbersLabel}
          </label>
          <input
            id="customer_numbers"
            type="text"
            value={form.customer_numbers}
            onChange={(e) => set('customer_numbers', e.target.value)}
          />
          <p className="field-hint">{t.customerNumbersHint}</p>
        </div>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t.loadingLabel : t.saveProfileButton}
          <span className="btn-icon" aria-hidden="true">
            <Icon name="check" size={18} strokeWidth={2} />
          </span>
        </button>
      </form>

      <div className="account-footer">
        {onPrivacy && (
          <button type="button" className="inline-link" onClick={onPrivacy}>
            <Icon name="shield" size={14} />
            {t.privacyLink}
          </button>
        )}

        {!confirmDelete ? (
          <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={16} />
            {t.deleteAccountButton}
          </button>
        ) : (
          <div className="delete-confirm">
            <p>{t.deleteConfirmBody}</p>
            <div className="delete-actions">
              <button type="button" className="btn-danger" disabled={busy} onClick={handleDelete}>
                {t.deleteConfirmYes}
              </button>
              <button type="button" className="btn-clear" onClick={() => setConfirmDelete(false)}>
                {t.cancelButton}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
