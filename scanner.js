// Losse scanpagina voor de CSU scanmodule (versie 2: evenement kiezen + teller).
// n8n controleert het InSite-token en stuurt hierheen door met #s=<sessietoken>. Deze pagina
// draait niet op het n8n-adres, zodat de browser de camera wel toestaat.
// Endpoints (workflow "CSU Scan - scanpagina en scan"):
//   POST /csu-scan/start  {token, evenement?, alleenTelling?}  -> evenementen, deelnemers, tellers
//   POST /csu-scan/scan   {token, evenement, qr | mdw}         -> resultaat van één scan
(function () {
  'use strict';

  var API = 'https://blueway.n8p1.hostingsecure.com/webhook';
  var SLEUTEL = 'csuScanToken';
  var EV_SLEUTEL = 'csuScanEvenement';
  var TIMEOUT_MS = 15000;
  var TELLER_MS = 20000;        // tellers verversen (andere toestellen scannen ook)
  var LUS_MS = 180;             // hoe vaak een camerabeeld wordt bekeken
  var PAUZE_MS = 1500;          // pauze na een scan
  var DUBBEL_MS = 6000;         // dezelfde code binnen deze tijd negeren
  var CODE = /^CSU1\.([A-Za-z0-9_-]{1,15})\.[0-9a-f]{20}$/i;
  var TOKEN = /^[0-9a-f]{48}$/i;

  function el(id) { return document.getElementById(id); }
  function maak(tag, klasse, tekst) { var e = document.createElement(tag); if (klasse) e.className = klasse; e.textContent = tekst == null ? '' : tekst; return e; }
  function opslag(fn) { try { return fn(); } catch (e) { return null; } }
  function bewaar(k, v) { if (opslag(function () { localStorage.setItem(k, v); return 1; }) === null) opslag(function () { sessionStorage.setItem(k, v); }); }
  function lees(k) { return opslag(function () { return localStorage.getItem(k); }) || opslag(function () { return sessionStorage.getItem(k); }) || ''; }
  function wis(k) { opslag(function () { localStorage.removeItem(k); }); opslag(function () { sessionStorage.removeItem(k); }); }
  function tijd() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function tril(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  // Sessietoken uit de link halen en uit de adresbalk verwijderen; het toestel onthoudt het.
  var token = '';
  var h = opslag(function () { return new URLSearchParams(location.hash.slice(1)).get('s'); }) || '';
  if (TOKEN.test(h)) {
    token = h.toLowerCase();
    bewaar(SLEUTEL, token);
    opslag(function () { history.replaceState(null, '', location.pathname + location.search); });
  } else {
    var t = lees(SLEUTEL);
    token = TOKEN.test(t) ? t.toLowerCase() : '';
  }

  function fatale(melding) {
    el('laden').hidden = true; el('app').hidden = true; el('starter').hidden = true;
    el('foutblok').textContent = melding; el('foutblok').hidden = false;
  }

  function post(pad, body) {
    body.token = token;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    return fetch(API + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        return j && typeof j === 'object' ? j : { status: 'fout', melding: 'Onverwacht antwoord (HTTP ' + r.status + ').' };
      });
    }).finally(function () { if (timer) clearTimeout(timer); });
  }

  if (!token) {
    fatale('Geen scansessie gevonden. Open de scanner eenmalig vanuit AFAS InSite; daarna werkt deze pagina op dit toestel direct, tot het einde van de sessie.');
    return;
  }

  var opgeslagenEv = Number(lees(EV_SLEUTEL)) || 0;
  post('/csu-scan/start', { evenement: opgeslagenEv || undefined }).then(function (D) {
    if (!D || D.status !== 'ok') {
      if (D && D.sessieVerlopen) wis(SLEUTEL);
      fatale((D && D.melding) || 'De scanner kon niet worden gestart.');
      return;
    }
    el('laden').hidden = true;
    var inKader = opslag(function () { return window.self !== window.top; });
    if (inKader === null || inKader) toonStarter(D); else startApp(D);
  }, function () { fatale('Geen verbinding met de server. Probeer het opnieuw.'); });

  function link() { return location.origin + location.pathname + '#s=' + encodeURIComponent(token); }

  // In het InSite-kader werkt de camera niet: alleen een knop naar een eigen tabblad.
  function toonStarter(D) {
    el('startersub').textContent = 'Ingelogd als ' + D.scanner;
    el('starter').hidden = false;
    el('openscanner').addEventListener('click', function () {
      if (window.open(link(), '_blank')) {
        el('startertekst').textContent = 'De scanner is geopend in een nieuw tabblad. Ga naar dat tabblad om te scannen.';
        el('openscanner').textContent = 'Scanner opnieuw openen';
        el('starterhint').textContent = 'Tabblad gesloten? Tik nog een keer op de knop.';
      } else {
        el('starterhint').textContent = 'Het nieuwe tabblad werd geblokkeerd. Sta pop-ups voor deze pagina toe en tik nog een keer.';
      }
    });
  }

  function startApp(D) {
    var evenementen = Array.isArray(D.evenementen) ? D.evenementen : [];
    var herscan = Array.isArray(D.herscan) ? D.herscan.map(String) : [];
    var huidig = null;              // gekozen evenement-id
    var deelnemers = [];            // [{n, m, a}]
    var perMdw = {};                // mdw -> deelnemer
    var gescandOm = {};             // mdw -> tijd (op dit toestel)
    var totaal = 0, aanwezig = 0;
    var bezig = false, leest = false, gestopt = false, laden = false;
    var pauzeTot = 0, laatsteCode = '', laatsteTijd = 0;
    var lezer = null;

    el('sub').textContent = 'Ingelogd als ' + D.scanner;
    el('proef').hidden = !D.proefmodus;
    el('app').hidden = false;

    if (!evenementen.length) {
      el('evenement').disabled = true;
      el('evenement').appendChild(maak('option', '', 'Geen evenementen'));
      el('kies').textContent = 'Er staan nu geen evenementen open voor de scanner.';
      el('kies').hidden = false;
      return;
    }

    // Keuzelijst evenementen (bovenin).
    var sel = el('evenement');
    function datumNl(d) { return d ? d.slice(0, 10).split('-').reverse().join('-') : ''; }
    sel.appendChild(maak('option', '', 'Kies een evenement'));
    sel.options[0].value = '';
    evenementen.forEach(function (e) {
      var o = maak('option', '', e.titel + (e.datum ? ' (' + datumNl(e.datum) + ')' : ''));
      o.value = String(e.id);
      sel.appendChild(o);
    });

    // Tellers
    function toonTeller() {
      el('aanwezig').textContent = aanwezig;
      el('totaal').textContent = totaal;
      el('telbalk').style.width = (totaal ? Math.min(100, Math.round(aanwezig / totaal * 100)) : 0) + '%';
    }
    function ververs() {
      if (!huidig || document.hidden || gestopt) return;
      var ev = huidig;
      post('/csu-scan/start', { evenement: ev, alleenTelling: true }).then(function (r) {
        if (r && r.status === 'ok' && Number(r.evenement) === ev && ev === huidig && !r.lijstFout) {
          totaal = Number(r.totaal) || 0; aanwezig = Number(r.aanwezig) || 0; toonTeller();
        } else if (r && r.sessieVerlopen) { sessieVerlopen(r.melding); }
      }, function () {});
    }
    setInterval(ververs, TELLER_MS);

    function zetGegevens(R) {
      huidig = Number(R.evenement) || null;
      deelnemers = (Array.isArray(R.deelnemers) ? R.deelnemers : []).map(function (d) { return { n: String(d.n || ''), m: String(d.m), a: d.a ? 1 : 0 }; });
      perMdw = {};
      deelnemers.forEach(function (d) { perMdw[d.m] = d; });
      gescandOm = {};
      totaal = Number(R.totaal) || 0; aanwezig = Number(R.aanwezig) || 0;
      lijstFout = !!R.lijstFout;
      toonTeller();
      toon('', 'Klaar om te scannen', 'Houd de QR-code uit de uitnodiging of mail in het kader.');
    }
    var lijstFout = false;

    function kies(id) {
      id = Number(id) || 0;
      if (!id) {
        huidig = null; wis(EV_SLEUTEL);
        el('scanblok').hidden = true; el('kies').hidden = false; camera.stop();
        return;
      }
      bewaar(EV_SLEUTEL, String(id));
      el('kies').hidden = true;
      laden = true;
      toon('', 'Evenement laden…', '');
      el('scanblok').hidden = false;
      post('/csu-scan/start', { evenement: id }).then(function (R) {
        laden = false;
        if (!R || R.status !== 'ok') { if (R && R.sessieVerlopen) return sessieVerlopen(R.melding); toon('fout', (R && R.melding) || 'Het evenement kon niet worden geladen.', ''); return; }
        if (Number(R.evenement) !== id) { sel.value = ''; kies(0); return; }
        zetGegevens(R);
        startCamera();
      }, function () { laden = false; toon('fout', 'Geen verbinding met de server.', 'Kies het evenement opnieuw.'); });
    }
    sel.addEventListener('change', function () { kies(sel.value); });

    // Resultaat van de laatste scan (alleen de laatste regel, geen lijst).
    function toon(soort, kop, naam) {
      var r = el('resultaat');
      r.className = soort ? 'resultaat ' + soort : 'resultaat';
      r.replaceChildren(maak('div', 'kop', kop), maak('div', 'naam', naam));
    }
    function meld(soort, kop, naam) { toon(soort, kop, naam); tril(soort === 'ok' ? 80 : soort === 'let' ? [60, 60, 60] : 250); }

    function sessieVerlopen(melding) {
      wis(SLEUTEL); gestopt = true; camera.stop();
      camFout(melding || 'Sessie verlopen. Open de scanner opnieuw vanuit InSite.');
      toon('fout', melding || 'Sessie verlopen.', 'Open de scanner opnieuw vanuit InSite.');
    }

    function verstuur(body, naam) {
      bezig = true;
      body.evenement = huidig;
      toon('', 'Bezig…', naam || '');
      post('/csu-scan/scan', body).then(verwerk, function () { verwerk({ status: 'fout', melding: 'Geen verbinding. Probeer het opnieuw.' }); });
    }
    function verwerk(r) {
      var naam = r.naam || '';
      var d = r.mdw ? perMdw[String(r.mdw)] : null;
      if (r.status === 'ok') {
        if (r.mdw) gescandOm[r.mdw] = tijd();
        if (d && !d.a) { d.a = 1; aanwezig++; } else if (!d) { aanwezig++; }
        toonTeller();
        meld('ok', r.proefmodus ? 'Gecontroleerd (proefmodus)' : 'Aanwezig gemeld', naam);
      } else if (r.status === 'al-aanwezig' || r.status === 'geblokkeerd') {
        if (r.status === 'al-aanwezig' && d) d.a = 1;
        meld('let', r.melding, naam);
      } else {
        meld('fout', r.melding || 'Niet gelukt.', naam);
        if (r.sessieVerlopen) sessieVerlopen(r.melding);
      }
      bezig = false; pauzeTot = Date.now() + PAUZE_MS;
    }
    function magHerscan(mdw) { return herscan.indexOf(mdw) >= 0; }
    function alGedaan(d) {
      if (!d || magHerscan(d.m)) return '';
      if (gescandOm[d.m]) return 'Al gescand om ' + gescandOm[d.m];
      if (d.a) return 'Staat al op aanwezig';
      return '';
    }
    function gevonden(code) {
      var nu = Date.now();
      if (code === laatsteCode && nu - laatsteTijd < DUBBEL_MS) return;
      laatsteCode = code; laatsteTijd = nu;
      var m = CODE.exec(code);
      if (!m) { meld('fout', 'Onbekende QR-code', 'Dit is geen deelnemerscode.'); pauzeTot = nu + PAUZE_MS; return; }
      var d = perMdw[m[1]];
      var al = alGedaan(d);
      if (al) { meld('let', al, d.n); pauzeTot = nu + PAUZE_MS; return; }
      verstuur({ qr: code }, d ? d.n : '');
    }

    // Camera
    var video = el('video');
    var camera = (function () {
      var stream = null, cams = [], camIndex = -1, poging = 0;
      var afgeschermd = String(window.origin) === 'null';
      function stop() { poging++; if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
      function start() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          camFout('Deze browser geeft geen toegang tot de camera. Open de scanner in een andere browser, bijvoorbeeld Chrome of Safari.'); return;
        }
        stop();
        var mijn = poging;
        var v = camIndex >= 0 && cams[camIndex] ? { deviceId: { exact: cams[camIndex].deviceId } } : { facingMode: { ideal: 'environment' } };
        navigator.mediaDevices.getUserMedia({ video: v, audio: false }).then(function (s) {
          if (mijn !== poging) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
          stream = s; video.srcObject = s;
          var p = video.play(); if (p && p.catch) p.catch(function () {});
          el('camfout').hidden = true;
          navigator.mediaDevices.enumerateDevices().then(function (l) {
            cams = l.filter(function (x) { return x.kind === 'videoinput'; });
            el('wissel').hidden = cams.length < 2;
          }).catch(function () {});
        }).catch(function (e) {
          if (mijn !== poging) return;
          var n = (e && e.name) || 'onbekend';
          var geweigerd = n === 'NotAllowedError' || n === 'SecurityError';
          if (geweigerd && afgeschermd) { camFout('De camera kan in deze weergave niet worden gebruikt. Open de scanner opnieuw.', 'venster'); return; }
          camFout(geweigerd
            ? 'De scanner heeft toegang tot je camera nodig. Sta de camera toe (via het slotje naast het adres) en tik op Camera opnieuw proberen.'
            : n === 'NotFoundError' ? 'Er is geen camera gevonden op dit apparaat.' : 'De camera kon niet worden gestart. Sluit andere apps die de camera gebruiken en probeer het opnieuw.', 'opnieuw');
        });
      }
      function wissel() { if (cams.length) { camIndex = (camIndex + 1) % cams.length; start(); } }
      return { start: start, stop: stop, wissel: wissel, actief: function () { return !!stream; } };
    })();
    function camFout(tekst, knoppen) {
      el('camtekst').textContent = tekst;
      el('nieuwvenster').hidden = knoppen !== 'venster';
      el('opnieuw').hidden = knoppen !== 'opnieuw';
      el('camfout').hidden = false;
    }
    function startCamera() { if (!gestopt && huidig) camera.start(); }
    el('nieuwvenster').addEventListener('click', function () { window.open(link(), '_blank'); });
    el('opnieuw').addEventListener('click', startCamera);
    el('wissel').addEventListener('click', function () { if (!gestopt) camera.wissel(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) camera.stop(); else { startCamera(); ververs(); }
    });

    // QR-lezer: ingebouwde BarcodeDetector als die er is, anders jsQR.
    (function () {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      function metJsQR(v) {
        if (!window.jsQR) return Promise.resolve(null);
        var w = v.videoWidth, hh = v.videoHeight;
        if (!w || !hh) return Promise.resolve(null);
        var s = Math.min(1, 640 / Math.max(w, hh));
        canvas.width = Math.round(w * s); canvas.height = Math.round(hh * s);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var c = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        return Promise.resolve(c && c.data ? c.data : null);
      }
      lezer = metJsQR;
      if ('BarcodeDetector' in window) {
        try {
          window.BarcodeDetector.getSupportedFormats().then(function (f) {
            if (f.indexOf('qr_code') < 0) return;
            var det = new window.BarcodeDetector({ formats: ['qr_code'] });
            lezer = function (v) { return det.detect(v).then(function (r) { return r && r[0] ? r[0].rawValue : null; }); };
          }).catch(function () {});
        } catch (e) {}
      }
    })();
    function lus() {
      if (gestopt) return;
      setTimeout(lus, LUS_MS);
      if (bezig || leest || laden || !huidig || Date.now() < pauzeTot || !camera.actief() || video.readyState < 2 || !lezer) return;
      leest = true;
      lezer(video).then(function (c) { leest = false; if (c && !bezig) gevonden(c); }, function () { leest = false; });
    }

    // Zoeken op naam
    function zoek() {
      var q = el('zoekveld').value.trim().toLowerCase(), ul = el('zoeklijst'), n = 0;
      ul.replaceChildren();
      if (lijstFout) { ul.appendChild(maak('li', 'leeg', 'De deelnemerslijst kon niet uit AFAS worden geladen.')); return; }
      for (var i = 0; i < deelnemers.length && n < 50; i++) {
        var d = deelnemers[i];
        if (q && d.n.toLowerCase().indexOf(q) < 0 && d.m.toLowerCase().indexOf(q) < 0) continue;
        n++;
        var li = maak('li', '', d.n);
        if (d.a || gescandOm[d.m]) li.appendChild(maak('span', 'st', ' · ' + (gescandOm[d.m] ? 'gescand ' + gescandOm[d.m] : 'aanwezig')));
        li.addEventListener('click', (function (d) { return function () {
          var al = alGedaan(d);
          if (al) { meld('let', al, d.n); return; }
          if (!window.confirm(d.n + ' op aanwezig zetten?')) return;
          el('zoek').hidden = true;
          verstuur({ mdw: d.m }, d.n);
        }; })(d));
        ul.appendChild(li);
      }
      if (!n) ul.appendChild(maak('li', 'leeg', 'Geen deelnemer gevonden.'));
    }
    el('zoekveld').addEventListener('input', zoek);
    el('zoekknop').addEventListener('click', function () {
      var z = el('zoek'); z.hidden = !z.hidden;
      if (!z.hidden) { el('zoekveld').value = ''; zoek(); el('zoekveld').focus(); }
    });

    // Eerste keuze: onthouden evenement of het enige evenement, anders zelf kiezen.
    if (D.evenement) {
      sel.value = String(D.evenement);
      bewaar(EV_SLEUTEL, String(D.evenement));
      el('scanblok').hidden = false;
      zetGegevens(D);
      startCamera();
    } else {
      if (opgeslagenEv) wis(EV_SLEUTEL);
      if (evenementen.length === 1) { sel.value = String(evenementen[0].id); kies(evenementen[0].id); }
      else { el('kies').hidden = false; }
    }
    lus();
  }
})();
