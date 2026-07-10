import { getAdmin, bearer, getUserFromToken } from '../shared/supabaseAdmin.js';

// POST /api/delete-account
// Header: Authorization: Bearer <supabase access token>
// AVG — recht op vergetelheid: verwijdert het profiel én het auth-account volledig.
// De profielrij verdwijnt sowieso via de ON DELETE CASCADE op auth.users, maar we
// wissen hem eerst expliciet zodat er geen restdata achterblijft als de cascade faalt.
export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const admin = getAdmin();
  if (!admin) {
    return json({ error: 'Supabase is niet geconfigureerd op de server.' }, 500);
  }

  const token = bearer(req);
  const user = await getUserFromToken(admin, token);
  if (!user) {
    return json({ error: 'Niet geautoriseerd.' }, 401);
  }

  // 1. Wis de profielrij expliciet.
  const { error: delProfileErr } = await admin.from('profiles').delete().eq('user_id', user.id);
  if (delProfileErr) {
    return json({ error: `Profiel verwijderen mislukt: ${delProfileErr.message}` }, 500);
  }

  // 2. Verwijder het auth-account zelf (cascade wist eventuele resterende rijen).
  const { error: delUserErr } = await admin.auth.admin.deleteUser(user.id);
  if (delUserErr) {
    return json({ error: `Account verwijderen mislukt: ${delUserErr.message}` }, 500);
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
