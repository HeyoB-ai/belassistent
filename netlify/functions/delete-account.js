import { adminConfigured, bearer, getUserFromToken, deleteProfile, deleteAuthUser } from '../shared/supabaseAdmin.js';

// POST /api/delete-account
// Header: Authorization: Bearer <supabase access token>
// AVG — recht op vergetelheid: verwijdert het profiel én het auth-account volledig.
// De profielrij verdwijnt sowieso via de ON DELETE CASCADE op auth.users, maar we
// wissen hem eerst expliciet zodat er geen restdata achterblijft als de cascade faalt.
export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!adminConfigured()) {
    return json({ error: 'Supabase is niet geconfigureerd op de server.' }, 500);
  }

  const user = await getUserFromToken(bearer(req));
  if (!user) {
    return json({ error: 'Niet geautoriseerd.' }, 401);
  }

  // 1. Wis de profielrij expliciet.
  const { error: delProfileErr } = await deleteProfile(user.id);
  if (delProfileErr) {
    return json({ error: `Profiel verwijderen mislukt: ${delProfileErr}` }, 500);
  }

  // 2. Verwijder het auth-account zelf (cascade wist eventuele resterende rijen).
  const { error: delUserErr } = await deleteAuthUser(user.id);
  if (delUserErr) {
    return json({ error: `Account verwijderen mislukt: ${delUserErr}` }, 500);
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = {
  path: '/api/delete-account',
};
