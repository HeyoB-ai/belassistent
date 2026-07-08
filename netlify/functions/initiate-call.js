import twilio from 'twilio';
import { getStore } from '@netlify/blobs';

// POST /api/initiate-call
// Body: { company, helpdesk_number, task, language }
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

  const company = (body.company || '').trim();
  const helpdeskNumber = (body.helpdesk_number || '').trim();
  const task = (body.task || '').trim();
  const language = (body.language || 'nl').trim();

  if (!company || !helpdeskNumber || !task) {
    return json({ error: 'company, helpdesk_number en task zijn verplicht.' }, 400);
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, URL } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return json({ error: 'Twilio-omgevingsvariabelen ontbreken op de server.' }, 500);
  }
  if (!URL) {
    return json({ error: 'URL-omgevingsvariabele ontbreekt (nodig voor de webhook).' }, 500);
  }

  const webhookUrl = `${URL}/.netlify/functions/conversation`;
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
      statusCallbackEvent: ['completed', 'busy', 'no-answer', 'failed'],
    });
  } catch (err) {
    return json({ error: `Twilio-fout: ${err.message}` }, 502);
  }

  const store = getStore('calls');
  const state = {
    callSid: call.sid,
    company,
    task,
    language,
    messages: [],
    status: 'initiated',
    outcome: null,
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
