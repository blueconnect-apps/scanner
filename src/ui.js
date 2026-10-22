// Kleine DOM-hulpjes. Tekst van de server gaat altijd via textContent, nooit via innerHTML.
export const el = (id) => document.getElementById(id);

export function maak(tag, klasse, tekst) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  e.textContent = tekst ?? '';
  return e;
}

export function tijd() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function tril(patroon) {
  try { navigator.vibrate?.(patroon); } catch {}
}

export function fatale(melding) {
  el('laden').hidden = true;
  el('app').hidden = true;
  el('foutblok').textContent = melding;
  el('foutblok').hidden = false;
}
