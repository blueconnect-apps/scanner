// QR-codes uit een videoframe lezen. Gebruikt de ingebouwde BarcodeDetector als de browser die heeft
// (Chrome op Android), anders jsQR. jsQR wordt alleen geladen als het nodig is (bijv. Safari op iPhone).
const MAX_ZIJDE = 640; // kleinere frames voor jsQR: sneller en scherp genoeg voor een QR-code

// Geeft een functie (video) => Promise<string | null>.
export async function maakLezer() {
  if (await heeftBarcodeDetector()) {
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video))[0]?.rawValue || null;
  }

  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    const schaal = Math.min(1, MAX_ZIJDE / Math.max(w, h));
    canvas.width = Math.round(w * schaal);
    canvas.height = Math.round(h * schaal);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data || null;
  };
}

async function heeftBarcodeDetector() {
  if (!('BarcodeDetector' in window)) return false;
  try { return (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code'); } catch { return false; }
}
