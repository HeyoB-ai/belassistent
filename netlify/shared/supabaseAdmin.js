// Server-side Supabase-toegang ZONDER de @supabase/supabase-js client.
// De client instantieert realtime-code die op Node < 22 een native WebSocket eist
// en crasht (HTTP 502). We gebruiken server-side alleen auth-verificatie + REST-reads/
// writes, dus doen we die rechtstreeks via fetch naar de Supabase REST/Auth-endpoints
// met de service-role sleutel. Geen client, geen WebSocket, geen realtime.

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key };
}

// Is Supabase server-side geconfigureerd?
export function adminConfigured() {
  return config() !== null;
}

// Haal het Bearer-token uit de Authorization-header (Request of Netlify event).
export function bearer(req) {
  const h =
    (req.headers?.get && req.headers.get('authorization')) ||
    req.headers?.authorization ||
    req.headers?.Authorization ||
    '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

// Verifieer het gebruikers-JWT via GET /auth/v1/user en geef de gebruiker terug (of null).
// De service-role sleutel gaat als apikey mee; het gebruikers-token als Bearer.
export async function getUserFromToken(token) {
  const cfg = config();
  if (!cfg || !token) return null;
  try {
    const res = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

// Lees het eigen profiel via de REST-API (service-role omzeilt RLS server-side).
// Geeft de rij terug of null. `columns` is een PostgREST select-string.
export async function getProfile(userId, columns) {
  const cfg = config();
  if (!cfg || !userId) return null;
  try {
    const qs = new URLSearchParams({
      select: columns || '*',
      user_id: `eq.${userId}`,
      limit: '1',
    });
    const res = await fetch(`${cfg.url}/rest/v1/profiles?${qs.toString()}`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}

// Verwijder de profielrij van de gebruiker. Geeft { error } terug (null = ok).
export async function deleteProfile(userId) {
  const cfg = config();
  if (!cfg || !userId) return { error: 'not_configured' };
  try {
    const qs = new URLSearchParams({ user_id: `eq.${userId}` });
    const res = await fetch(`${cfg.url}/rest/v1/profiles?${qs.toString()}`, {
      method: 'DELETE',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        Prefer: 'return=minimal',
      },
    });
    if (!res.ok) return { error: `profiles delete status ${res.status}` };
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// Verwijder het auth-account volledig via de Admin-API. Geeft { error } terug (null = ok).
export async function deleteAuthUser(userId) {
  const cfg = config();
  if (!cfg || !userId) return { error: 'not_configured' };
  try {
    const res = await fetch(`${cfg.url}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!res.ok) return { error: `auth delete status ${res.status}` };
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}
