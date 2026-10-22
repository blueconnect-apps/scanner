import { TOKEN_SLEUTEL as SLEUTEL } from './config.js';

// Het sessietoken dat n8n meegeeft in de link (#s=<token>). Het toestel onthoudt de sessie
// (localStorage), zodat de pagina daarna direct werkt tot de sessie in n8n verloopt.
const TOKEN_PATROON = /^[0-9a-f]{48}$/i;

// Haalt het token uit de link (en verwijdert het uit de adresbalk), anders uit de opslag.
export function haalToken() {
  const uitLink = new URLSearchParams(location.hash.slice(1)).get('s') || '';
  if (TOKEN_PATROON.test(uitLink)) {
    const token = uitLink.toLowerCase();
    bewaar(token);
    try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    return token;
  }
  const opgeslagen = lees(() => localStorage) || lees(() => sessionStorage);
  return TOKEN_PATROON.test(opgeslagen) ? opgeslagen.toLowerCase() : '';
}

export function vergeetToken() {
  try { localStorage.removeItem(SLEUTEL); } catch {}
  try { sessionStorage.removeItem(SLEUTEL); } catch {}
}

function bewaar(token) {
  try { localStorage.setItem(SLEUTEL, token); } catch {
    try { sessionStorage.setItem(SLEUTEL, token); } catch {}
  }
}

// Opslag kan ontbreken of geblokkeerd zijn (privévenster, afgeschermd kader): dan is er geen token.
function lees(opslag) {
  try { return opslag().getItem(SLEUTEL) || ''; } catch { return ''; }
}
