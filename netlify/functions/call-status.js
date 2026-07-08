import { getStore } from '@netlify/blobs';

// GET /api/call-status?callSid=xxx
// Geeft de huidige toestand van een gesprek terug voor de frontend-poll.
export default async function handler(req) {
  const url = new URL(req.url);
  const callSid = url.searchParams.get('callSid');

  if (!callSid) {
    return json({ error: 'callSid is verplicht.' }, 400);
  }

  const store = getStore('calls');
  const state = await store.get(callSid, { type: 'json' });

  if (!state) {
    return json({ error: 'Onbekende callSid.' }, 404);
  }

  return json({
    status: state.status,
    messages: state.messages || [],
    outcome: state.outcome || null,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export const config = {
  path: '/api/call-status',
};
