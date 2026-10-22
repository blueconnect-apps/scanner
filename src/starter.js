import { el } from './ui.js';

// In het InSite-kader werkt de camera niet (InSite geeft het kader geen cameratoestemming,
// en een nieuw venster openen mag alleen na een tik). Toon daarom alleen een startknop.
export function toonStarter(D, link) {
  el('startertitel').textContent = D.titel;
  el('startersub').textContent = `Ingelogd als ${D.scanner}`;
  el('starter').hidden = false;

  el('openscanner').addEventListener('click', () => {
    // Geen 'noopener': dan geeft window.open altijd null en zien we niet of de pop-up is geblokkeerd.
    // Het nieuwe tabblad is dezelfde pagina (zelfde origin), dus dat is geen risico.
    if (window.open(link, '_blank')) {
      el('startertekst').textContent = 'De scanner is geopend in een nieuw tabblad. Ga naar dat tabblad om te scannen.';
      el('openscanner').textContent = 'Scanner opnieuw openen';
      el('starterhint').textContent = 'Tabblad gesloten? Tik nog een keer op de knop.';
    } else {
      el('starterhint').textContent = 'Het nieuwe tabblad werd geblokkeerd. Sta pop-ups voor deze pagina toe en tik nog een keer.';
    }
  });
}
