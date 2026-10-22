import { defineConfig, loadEnv } from 'vite';

// VITE_API_BASE_URL komt uit .env (lokaal) of uit de repository-variabele in GitHub Actions.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const api = apiUrl(verplicht(env, 'VITE_API_BASE_URL'));
  opslagSleutel(verplicht(env, 'VITE_TOKEN_STORAGE_KEY'));
  timeout(verplicht(env, 'VITE_API_TIMEOUT_MS'));

  return {
    // Relatieve paden: werkt op GitHub Pages onder /scanner/ en op een eigen domein.
    base: './',
    plugins: [contentSecurityPolicy(api.origin)],
  };
});

function verplicht(env, naam) {
  if (!env[naam]) {
    throw new Error(`${naam} ontbreekt. Kopieer .env.example naar .env, of zet de variabele in GitHub ` +
      '(Settings > Secrets and variables > Actions > Variables).');
  }
  return env[naam];
}

function apiUrl(waarde) {
  let url;
  try { url = new URL(waarde); } catch { throw new Error(`VITE_API_BASE_URL is geen geldige URL: ${waarde}`); }
  const lokaal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(lokaal && url.protocol === 'http:')) {
    throw new Error(`VITE_API_BASE_URL moet met https:// beginnen: ${waarde}`);
  }
  return url;
}

function opslagSleutel(waarde) {
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(waarde)) {
    throw new Error(`VITE_TOKEN_STORAGE_KEY mag alleen letters, cijfers, punt, streepje en underscore bevatten: ${waarde}`);
  }
}

function timeout(waarde) {
  const ms = Number(waarde);
  if (!/^\d+$/.test(waarde) || ms < 1000 || ms > 120000) {
    throw new Error(`VITE_API_TIMEOUT_MS moet een getal tussen 1000 en 120000 (milliseconden) zijn: ${waarde}`);
  }
}

// Strikte CSP: alleen eigen scripts en styles, en alleen verbinding met de n8n-server. Een meta-tag
// omdat GitHub Pages geen eigen headers toestaat. Alleen in de build: de dev-server van Vite
// gebruikt zelf inline styles en een websocket.
function contentSecurityPolicy(apiOrigin) {
  const beleid = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    `connect-src ${apiOrigin}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  return {
    name: 'csu-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: beleid }, injectTo: 'head-prepend' },
    ],
  };
}
