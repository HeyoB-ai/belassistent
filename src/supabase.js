import { createClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createElement } from 'react';

// Client alleen als de env-vars gezet zijn (VITE_-prefix voor de Vite-frontend).
// Zo blijft de gratis flow werken zonder Supabase-configuratie.
const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  URL && ANON
    ? createClient(URL, ANON, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

export const authConfigured = Boolean(supabase);

const PROFILE_FIELDS =
  'user_id, first_name, last_name, postcode, house_number, birth_date, customer_numbers, is_premium, consent_at';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  const user = session?.user || null;

  const loadProfile = useCallback(async (uid) => {
    if (!supabase || !uid) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('user_id', uid).maybeSingle();
    setProfile(data || null);
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session || null);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s || null);
      loadProfile(s?.user?.id);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(async (email, password) => {
    if (!supabase) return { error: 'not_configured' };
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message || null };
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: 'not_configured' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!supabase) return { error: 'not_configured' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error: error?.message || null };
  }, []);

  // Upsert eigen profiel (RLS zorgt dat het alleen de eigen rij kan zijn).
  const saveProfile = useCallback(
    async (fields) => {
      if (!supabase || !user) return { error: 'not_configured' };
      const row = { user_id: user.id, consent_at: new Date().toISOString(), ...fields };
      const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'user_id' });
      if (!error) await loadProfile(user.id);
      return { error: error?.message || null };
    },
    [user, loadProfile]
  );

  // Volledige verwijdering: server-side function wist profielrij én auth-account.
  const deleteAccount = useCallback(async () => {
    if (!supabase || !session) return { error: 'not_configured' };
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { error: detail || `Status ${res.status}` };
    }
    await supabase.auth.signOut();
    setProfile(null);
    return { error: null };
  }, [session]);

  const isPremium = Boolean(profile?.is_premium);
  const profileComplete = Boolean(
    profile && profile.postcode && profile.house_number && profile.birth_date
  );

  const value = useMemo(
    () => ({
      configured: authConfigured,
      user,
      session,
      profile,
      loading,
      isPremium,
      profileComplete,
      signUp,
      signIn,
      signOut,
      resetPassword,
      saveProfile,
      deleteAccount,
    }),
    [
      user,
      session,
      profile,
      loading,
      isPremium,
      profileComplete,
      signUp,
      signIn,
      signOut,
      resetPassword,
      saveProfile,
      deleteAccount,
    ]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth moet binnen <AuthProvider>');
  return ctx;
}
