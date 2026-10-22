import { el, maak, tijd, tril } from './ui.js';
import { vergeetToken } from './session.js';
import { maakCamera } from './camera.js';
import { maakLezer } from './qr.js';
import { koppelZoeken } from './search.js';

const SCAN_INTERVAL_MS = 180; // tijd tussen twee pogingen om een frame te lezen
const PAUZE_MS = 1500;        // resultaat even laten staan voor de volgende scan
const ZELFDE_CODE_MS = 6000;  // dezelfde code binnen deze tijd negeren
const MAX_LOGREGELS = 30;
// Deelnemerscode uit AFAS Pocket: CSU1.<medewerker>.<handtekening>. n8n controleert de handtekening.
const CODE_PATROON = /^CSU1\.([A-Za-z0-9_-]{1,15})\.[0-9a-f]{20}$/i;
const SYMBOOL = { ok: '✓ ', let: '! ', fout: '✗ ' };
const TRILLING = { ok: 80, let: [60, 60, 60], fout: 250 };

// De scanner in een eigen tabblad. D is het antwoord van /csu-scan/start.
export function startScanner(D, api, link) {
  const deelnemers = (Array.isArray(D.deelnemers) ? D.deelnemers : [])
    .map((d) => ({ m: String(d.m), n: String(d.n ?? '') }));
  const namen = new Map(deelnemers.map((d) => [d.m, d.n]));
  // Medewerkers uit Config herscanMedewerkers (bijv. testcodes) mogen zonder melding opnieuw.
  const herscan = new Set(Array.isArray(D.herscan) ? D.herscan : []);
  const gescand = new Map(); // medewerker -> tijd van de scan op dit toestel

  let aantalOk = 0;
  let bezig = false;   // verzoek naar n8n loopt
  let leest = false;   // er wordt een frame gelezen
  let gestopt = false; // sessie verlopen: niet meer scannen
  let pauzeTot = 0, laatsteCode = '', laatsteTijd = 0, lees = null;

  el('titel').textContent = D.titel;
  el('sub').textContent = `Ingelogd als ${D.scanner}`;
  el('proef').hidden = !D.proefmodus;
  el('app').hidden = false;

  const video = el('video');
  const camera = maakCamera(video, {
    onGestart(aantal) { el('camfout').hidden = true; el('wissel').hidden = aantal < 2; },
    onFout: camFout,
  });
  const zoeken = koppelZoeken({
    deelnemers,
    lijstFout: !!D.lijstFout,
    gescandOm: (mdw) => gescand.get(mdw),
    onKies(d) {
      if (alGescand(d.m)) { toon('let', `Al gescand om ${gescand.get(d.m)}`, d.n); return; }
      if (!window.confirm(`${d.n} op aanwezig zetten?`)) return;
      zoeken.sluit();
      verstuur({ mdw: d.m }, d.n);
    },
  });

  function toon(soort, kop, naam) {
    const r = el('resultaat');
    r.className = soort ? `resultaat ${soort}` : 'resultaat';
    r.replaceChildren(maak('div', 'kop', kop), maak('div', 'naam', naam));
  }
  function logRegel(soort, tekst) {
    const li = document.createElement('li');
    li.append(maak('span', '', SYMBOOL[soort] + tekst), maak('span', 't', tijd()));
    const log = el('log');
    log.prepend(li);
    while (log.children.length > MAX_LOGREGELS) log.lastChild.remove();
  }
  function meld(soort, kop, naam, logtekst) {
    toon(soort, kop, naam);
    logRegel(soort, logtekst);
    tril(TRILLING[soort]);
  }
  const metNaam = (naam, tekst) => (naam ? `${naam}: ${tekst}` : tekst);
  const alGescand = (mdw) => gescand.has(mdw) && !herscan.has(mdw);

  function teller() {
    el('teller').textContent = `${aantalOk} aanwezig gemeld op dit toestel` +
      (deelnemers.length ? ` · ${deelnemers.length} deelnemers` : '');
  }

  function camFout(tekst, knop) {
    el('camtekst').textContent = tekst;
    el('nieuwvenster').hidden = knop !== 'venster';
    el('opnieuw').hidden = knop !== 'opnieuw';
    el('camfout').hidden = false;
  }

  function verstuur(body, naam) {
    bezig = true;
    toon('', 'Bezig…', naam);
    api.scan(body).then(verwerk, () => verwerk({ status: 'fout', melding: 'Geen verbinding. Probeer het opnieuw.' }));
  }

  function verwerk(r) {
    const naam = r.naam || '';
    if (r.status === 'ok') {
      if (r.mdw) gescand.set(r.mdw, tijd());
      aantalOk++;
      teller();
      meld('ok', r.proefmodus ? 'Gecontroleerd (proefmodus)' : 'Aanwezig gemeld', naam, naam || 'Aanwezig');
    } else if (r.status === 'al-aanwezig' || r.status === 'geblokkeerd') {
      if (r.status === 'al-aanwezig' && r.mdw && !gescand.has(r.mdw)) gescand.set(r.mdw, tijd());
      meld('let', r.melding, naam, metNaam(naam, r.melding));
    } else {
      const melding = r.melding || 'Niet gelukt.';
      meld('fout', melding, naam, metNaam(naam, melding));
      if (r.sessieVerlopen) {
        vergeetToken();
        gestopt = true;
        camera.stop();
        camFout(melding);
      }
    }
    bezig = false;
    pauzeTot = Date.now() + PAUZE_MS;
  }

  function gevonden(code) {
    const nu = Date.now();
    if (code === laatsteCode && nu - laatsteTijd < ZELFDE_CODE_MS) return;
    laatsteCode = code;
    laatsteTijd = nu;

    const mdw = CODE_PATROON.exec(code)?.[1];
    if (!mdw) {
      meld('fout', 'Onbekende QR-code', 'Dit is geen deelnemerscode voor dit evenement.', 'Onbekende QR-code');
      pauzeTot = nu + PAUZE_MS;
      return;
    }
    if (alGescand(mdw)) {
      const naam = namen.get(mdw) || '';
      meld('let', `Al gescand om ${gescand.get(mdw)}`, naam, metNaam(naam, 'al gescand'));
      pauzeTot = nu + PAUZE_MS;
      return;
    }
    verstuur({ qr: code }, namen.get(mdw));
  }

  function lus() {
    if (gestopt) return;
    setTimeout(lus, SCAN_INTERVAL_MS);
    if (bezig || leest || !lees || Date.now() < pauzeTot || !camera.actief() || video.readyState < 2) return;
    leest = true;
    lees(video).then(
      (code) => { leest = false; if (code && !bezig) gevonden(code); },
      () => { leest = false; },
    );
  }

  function startCamera() { if (!gestopt) camera.start(); }

  el('nieuwvenster').addEventListener('click', () => window.open(link, '_blank'));
  el('opnieuw').addEventListener('click', startCamera);
  el('wissel').addEventListener('click', () => { if (!gestopt) camera.wissel(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? camera.stop() : startCamera()));

  maakLezer().then(
    (l) => { lees = l; },
    () => toon('fout', 'De QR-lezer kon niet worden geladen.', 'Zoek op naam, of herlaad de pagina.'),
  );
  teller();
  startCamera();
  lus();
}
