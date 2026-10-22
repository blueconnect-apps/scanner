import { API_BASIS, API_TIMEOUT_MS } from './config.js';

// De n8n-webhooks van de scanmodule. Elk verzoek stuurt het sessietoken mee.
export function maakApi(token) {
  return {
    start: () => post('/csu-scan/start', { token }),
    scan: (body) => post('/csu-scan/scan', { ...body, token }),
  };
}

// Geeft altijd een object met `status` terug. Bij geen verbinding of een time-out wordt de belofte afgewezen.
async function post(pad, body) {
  const r = await fetch(API_BASIS + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  try {
    const data = await r.json();
    if (data && typeof data === 'object') return data;
  } catch {}
  return { status: 'fout', melding: `Onverwacht antwoord (HTTP ${r.status}).` };
}
