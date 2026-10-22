# CSU scanner

Scanpagina voor de CSU scanmodule van BlueWay. Medewerkers scannen hiermee de QR-codes die
deelnemers in AFAS Pocket laten zien; n8n zet ze daarna in AFAS op aanwezig.

## Hoe het werkt

1. De scanner opent de scanmodule in AFAS InSite. n8n controleert het InSite-token en stuurt door
   naar deze pagina met `#s=<sessietoken>` in de link.
2. In het InSite-kader mag de camera niet. De pagina toont daar alleen een knop die de scanner in
   een eigen tabblad opent.
3. Het tabblad bewaart het sessietoken op het toestel, haalt het evenement op
   (`POST /csu-scan/start`) en stuurt elke gescande code naar `POST /csu-scan/scan`.

De pagina draait op GitHub Pages en niet op het n8n-adres, omdat n8n eigen HTML-pagina's in een
sandbox zet waarin de camera niet werkt.

## Lokaal ontwikkelen

Vereist Node 22 (vastgezet in `package.json` en `.nvmrc`; met nvm: `nvm use`).

```sh
cp .env.example .env   # vul de waarden in
npm install
npm run dev            # http://localhost:5173
```

De camera werkt alleen via `localhost` of `https`. Om op een telefoon te testen heb je een
https-tunnel nodig. Daarnaast moet de n8n-webhook CORS toestaan voor dat adres.

`npm run build` maakt de productieversie in `dist/`, en `npm run preview` toont die lokaal.

## Instellingen

| Variabele           | Betekenis                                                                |
|---------------------|--------------------------------------------------------------------------|
| `VITE_API_BASE_URL` | Basis-URL van de n8n-webhooks, bijv. `https://…/webhook`. Moet https zijn. |
| `VITE_TOKEN_STORAGE_KEY` | Naam waaronder het sessietoken in `localStorage` staat, bijv. `csuScanToken`. |
| `VITE_API_TIMEOUT_MS` | Na hoeveel milliseconden een verzoek naar n8n als mislukt geldt (1000 tot 120000), bijv. `15000`. |

Alles met `VITE_` wordt bij het bouwen in de JavaScript gezet en is dus openbaar. Zet hier nooit
geheimen in. De build stopt als een variabele ontbreekt of ongeldig is.

Als je `VITE_TOKEN_STORAGE_KEY` wijzigt, vindt de pagina het bewaarde token niet meer. Elk toestel
moet de scanner dan één keer opnieuw vanuit AFAS InSite openen.

## Publiceren

Elke push naar `main` bouwt de pagina en publiceert `dist/` op GitHub Pages
(`.github/workflows/deploy.yml`). Bestanden niet meer via de GitHub-website uploaden: de ruwe
`index.html` werkt zonder build niet.

Eenmalig instellen in de repository:

1. **Settings > Secrets and variables > Actions > Variables**: voeg `VITE_API_BASE_URL`,
   `VITE_TOKEN_STORAGE_KEY` en `VITE_API_TIMEOUT_MS` toe.
2. **Settings > Pages > Build and deployment > Source**: kies **GitHub Actions**.

## Structuur

```
index.html            opmaak van de pagina
src/main.js           start: token ophalen, evenement laden, startscherm of scanner
src/config.js         instellingen uit de omgeving
src/session.js        sessietoken uit de link en opslag
src/api.js            verzoeken naar n8n (met time-out)
src/starter.js        startscherm in het InSite-kader
src/scanner.js        de scanner: scans verwerken, resultaat en log tonen
src/camera.js         camera starten, stoppen en wisselen
src/qr.js             QR-codes lezen (BarcodeDetector of jsQR)
src/search.js         deelnemer zoeken op naam
src/styles/           BlueWay-tokens en opmaak
vite.config.js        build-instellingen en Content-Security-Policy
```

## Beveiliging

- De gebouwde pagina heeft een strikte Content-Security-Policy: alleen eigen scripts en styles, en
  alleen verbinding met de n8n-server uit `VITE_API_BASE_URL`.
- jsQR wordt meegebundeld in plaats van van een CDN geladen.
- Tekst van de server wordt altijd als tekst getoond, nooit als HTML.
- Het sessietoken staat in `localStorage`. Op `*.github.io` delen alle Pages-sites van de organisatie
  hetzelfde origin en dus dezelfde opslag. Publiceer daarom geen andere sites onder
  `blueconnect-apps.github.io`, of gebruik een eigen (sub)domein.
- De echte controles (geldigheid van de sessie, de handtekening in de QR-code, wie wie mag
  aanmelden) gebeuren in n8n.
