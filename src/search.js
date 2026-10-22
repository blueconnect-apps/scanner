import { el, maak } from './ui.js';

const MAX_RESULTATEN = 50;

// Deelnemer zoeken op naam of medewerkernummer, als de QR-code niet werkt.
//   gescandOm(mdw)  tijd van de scan op dit toestel, of undefined
//   onKies(d)       er is op een deelnemer getikt
export function koppelZoeken({ deelnemers, lijstFout, gescandOm, onKies }) {
  const paneel = el('zoek'), veld = el('zoekveld'), lijst = el('zoeklijst');

  function toonLijst() {
    const t = veld.value.trim().toLowerCase();
    lijst.replaceChildren();
    if (lijstFout) { lijst.append(maak('li', 'leeg', 'De deelnemerslijst kon niet uit AFAS worden geladen.')); return; }

    const treffers = deelnemers
      .filter((d) => !t || d.n.toLowerCase().includes(t) || d.m.toLowerCase().includes(t))
      .slice(0, MAX_RESULTATEN);
    for (const d of treffers) {
      const om = gescandOm(d.m);
      const li = maak('li', '', d.n + (om ? ` · al gescand ${om}` : ''));
      li.addEventListener('click', () => onKies(d));
      lijst.append(li);
    }
    if (!treffers.length) lijst.append(maak('li', 'leeg', 'Geen deelnemer gevonden.'));
  }

  veld.addEventListener('input', toonLijst);
  el('zoekknop').addEventListener('click', () => {
    paneel.hidden = !paneel.hidden;
    if (!paneel.hidden) { veld.value = ''; toonLijst(); veld.focus(); }
  });

  return { sluit: () => { paneel.hidden = true; } };
}
