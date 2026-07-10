import { createClient } from '@supabase/supabase-js';

// Server-side Supabase-client met service-role sleutel. NOOIT naar de client sturen.
// Alleen Netlify functions gebruiken deze om (na JWT-verificatie) profieldata te lezen
// of een account volledig te verwijderen.
let cached = null;

export function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
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

// Verifieer het JWT en geef de bijbehorende gebruiker terug (of null).
export async function getUserFromToken(admin, token) {
  if (!admin || !token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
