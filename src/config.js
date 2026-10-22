// Instellingen uit de omgeving (.env lokaal, repository-variabele in GitHub Actions). vite.config.js
// controleert ze bij het bouwen. Alles met VITE_ staat leesbaar in de gebouwde JavaScript: geen geheimen.
export const API_BASIS = import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');

// Naam waaronder het sessietoken in localStorage staat. Wijzigen = elk toestel opnieuw openen vanuit InSite.
export const TOKEN_SLEUTEL = import.meta.env.VITE_TOKEN_STORAGE_KEY;

// Een verzoek dat langer duurt geldt als mislukt, zodat de scanner niet blijft hangen op 'Bezig…'.
export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS);
