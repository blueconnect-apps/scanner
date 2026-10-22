// Camera starten, stoppen en wisselen. Meldingen gaan naar de aanroeper:
//   onGestart(aantalCameras)  de camera loopt
//   onFout(tekst, knop)       knop: 'opnieuw', 'venster' of geen
export function maakCamera(video, { onGestart, onFout }) {
  let stream = null, cams = [], camIndex = -1;
  // Elke start/stop verhoogt de poging, zodat een trage getUserMedia van een eerdere poging
  // (bijv. snel twee keer 'Andere camera') zijn stream weer sluit in plaats van te laten lopen.
  let poging = 0;
  const afgeschermd = String(window.origin) === 'null';

  function stop() {
    poging++;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      onFout('Deze browser geeft geen toegang tot de camera. Open de scanner in een andere browser, bijvoorbeeld Chrome of Safari.');
      return;
    }
    stop();
    const mijnPoging = poging;
    const v = camIndex >= 0 && cams[camIndex]
      ? { deviceId: { exact: cams[camIndex].deviceId } }
      : { facingMode: { ideal: 'environment' } };

    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: v, audio: false });
    } catch (e) {
      if (mijnPoging === poging) toonFout(e);
      return;
    }
    if (mijnPoging !== poging) { s.getTracks().forEach((t) => t.stop()); return; }

    stream = s;
    video.srcObject = s;
    video.play().catch(() => {});
    try {
      cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    } catch {}
    if (mijnPoging === poging) onGestart(cams.length);
  }

  function toonFout(e) {
    const n = e?.name || 'onbekend';
    const geweigerd = n === 'NotAllowedError' || n === 'SecurityError';
    if (geweigerd && afgeschermd) {
      // Afgeschermde weergave (bijv. geopend vanuit een ander kader): opnieuw openen in een eigen tabblad.
      onFout('De camera kan in deze weergave niet worden gebruikt. Open de scanner opnieuw.', 'venster');
    } else if (geweigerd) {
      onFout('De scanner heeft toegang tot je camera nodig. Sta de camera toe (via het slotje naast het adres) en tik op Camera opnieuw proberen.', 'opnieuw');
    } else if (n === 'NotFoundError') {
      onFout('Er is geen camera gevonden op dit apparaat.', 'opnieuw');
    } else {
      onFout('De camera kon niet worden gestart. Sluit andere apps die de camera gebruiken en probeer het opnieuw.', 'opnieuw');
    }
  }

  function wissel() {
    if (!cams.length) return;
    camIndex = (camIndex + 1) % cams.length;
    start();
  }

  return { start, stop, wissel, actief: () => !!stream };
}
