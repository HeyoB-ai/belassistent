import twilio from 'twilio';
import { getStore } from '@netlify/blobs';
import { adminConfigured, bearer, getUserFromToken, getProfile } from '../shared/supabaseAdmin.js';

// POST /api/initiate-call
// Body: { company, helpdesk_number, task, language, verification? }
// Optionele header: Authorization: Bearer <supabase token> (nodig voor verificatie).
// Start een uitgaand Twilio-gesprek naar de helpdesk en zet de begintoestand
// in Netlify Blobs. Geeft { callSid } terug.
export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ongeldige JSON in request body.' }, 400);
  }

  const callerName = (body.callerName || '').trim();
  const company = (body.company || '').trim();
  const helpdeskNumber = (body.helpdesk_number || '').trim();
  const task = (body.task || '').trim();
  const language = (body.language || 'nl').trim();
  const goal = (body.goal || '').trim();
  const email = (body.email || '').trim();
  const reference = (body.reference || '').trim();
  const wantsVerification = body.verification === true;

  if (!callerName || !company || !helpdeskNumber || !task) {
    return json({ error: 'callerName, company, helpdesk_number en task zijn verplicht.' }, 400);
  }

  // --- Verificatie-gesprek: haal profieldata UITSLUITEND server-side op. ---
  // De data komt nooit via de URL of client binnen; alleen deze function leest ze
  // (na JWT-verificatie) met de service-role sleutel, en zet ze in de call-state
  // die de client via /api/call-status NIET terugkrijgt.
  let verificationData = null;
  if (wantsVerification) {
    if (!adminConfigured()) {
      return json({ error: 'Verificatie is niet beschikbaar: Supabase ontbreekt.', code: 'not_configured' }, 500);
    }
    const user = await getUserFromToken(bearer(req));
    if (!user) {
      return json({ error: 'Log in om een verificatiegesprek te starten.', code: 'auth_required' }, 401);
    }
    const profile = await getProfile(
      user.id,
      'first_name, last_name, postcode, house_number, birth_date, customer_numbers, is_premium'
    );

    if (!profile || !profile.is_premium) {
      return json({ error: 'Verificatiegesprekken vereisen een premium-account.', code: 'premium_required' }, 403);
    }
    if (!profile.postcode || !profile.house_number || !profile.birth_date) {
      return json({ error: 'Vul eerst je verificatieprofiel volledig in.', code: 'profile_incomplete' }, 400);
    }

    verificationData = {
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      postcode: profile.postcode,
      houseNumber: profile.house_number,
      birthDate: profile.birth_date,
      customerNumbers: profile.customer_numbers || '',
    };
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, URL } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return json({ error: 'Twilio-omgevingsvariabelen ontbreken op de server.' }, 500);
  }
  if (!URL) {
    return json({ error: 'URL-omgevingsvariabele ontbreekt (nodig voor de webhook).' }, 500);
  }

  const webhookUrl = `${URL}/api/conversation`;
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  let call;
  try {
    call = await client.calls.create({
      to: helpdeskNumber,
      from: TWILIO_FROM_NUMBER,
      url: webhookUrl,
      method: 'POST',
      statusCallback: webhookUrl,
      statusCallbackMethod: 'POST',
      // Alleen geldige Twilio-events. 'completed' vuurt óók bij busy/no-answer/failed;
      // de echte uitkomst staat dan in het CallStatus-veld van die callback.
      statusCallbackEvent: ['completed'],
    });
  } catch (err) {
    return json({ error: `Twilio-fout: ${err.message}` }, 502);
  }

  const store = getStore('calls');
  const state = {
    callSid: call.sid,
    callerName,
    company,
    task,
    language,
    goal,
    email,
    reference,
    messages: [],
    status: 'initiated',
    phase: 'connecting',
    outcome: null,
    // Server-side only. Wordt NOOIT door /api/call-status teruggegeven aan de client.
    verification: Boolean(verificationData),
    verificationData,
    createdAt: new Date().toISOString(),
  };
  await store.setJSON(call.sid, state);

  return json({ callSid: call.sid });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = {
  path: '/api/initiate-call',
};
