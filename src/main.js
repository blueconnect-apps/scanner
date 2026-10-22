// Losse scanpagina voor de CSU scanmodule. n8n controleert het InSite-token en stuurt
// hierheen door met #s=<sessietoken>. Deze pagina draait niet op het n8n-adres, zodat
// de browser de camera wel toestaat (n8n schermt eigen HTML-pagina's af met een sandbox).
import './styles/tokens.css';
import './styles/app.css';
import { haalToken, vergeetToken } from './session.js';
import { maakApi } from './api.js';
import { el, fatale } from './ui.js';
import { toonStarter } from './starter.js';
import { startScanner } from './scanner.js';

const token = haalToken();
if (token) {
  begin(token);
} else {
  fatale('Geen scansessie gevonden. Open de scanner eenmalig vanuit AFAS InSite; daarna werkt deze pagina op dit toestel direct, tot het einde van de sessie.');
}

async function begin(token) {
  const api = maakApi(token);
  let D;
  try {
    D = await api.start();
  } catch {
    fatale('Geen verbinding met de server. Probeer het opnieuw.');
    return;
  }
  if (D.status !== 'ok') {
    if (D.sessieVerlopen) vergeetToken();
    fatale(D.melding || 'De scanner kon niet worden gestart.');
    return;
  }

  el('laden').hidden = true;
  // Het token gaat mee in de link: in het InSite-kader is de opslag van de browser gescheiden
  // van een eigen tabblad, dus het nieuwe tabblad kan het token daar niet uit lezen.
  const link = `${location.origin}${location.pathname}#s=${encodeURIComponent(token)}`;
  if (inKader()) toonStarter(D, link);
  else startScanner(D, api, link);
}

function inKader() {
  try { return window.self !== window.top; } catch { return true; }
}
