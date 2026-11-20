# CSU scanner-app versie 3 (20-11-2026)

Statische build voor https://csu-scanner-app-pc64h.ondigitalocean.app/ in de huisstijl van Total Care.
Uploaden: de inhoud van deze map (index.html + map assets) als statische site neerzetten, op dezelfde plek
als de huidige build. Geen build-stap nodig. Terugvallen kan met de map `scanner-app-v2` (of `scanner-app-v1-live`).

Nieuw t.o.v. v2:
- Huisstijl Total Care: donkerblauwe kop (#023c4a) met wit logo, lichtgroen-grijs (#c1d7d1) als steunkleur,
  perzik (#f2c8ad) voor de hoofdknop en het scankader, afgeronde blokken. Lettertype Arial
  (Neue Haas Grotesk is gelicentieerd; Arial is het secundaire lettertype uit de huisstijl).
- Alleen opmaak: scanner.js is gelijk aan v2. De app werkt met de QR-codes op persoonscode
  (CSU1.P<persoonscode>.<handtekening>) en met de oude codes (CSU1.<medewerkercode>.<handtekening>).

Werkt met workflow "CSU Scan - scanpagina en scan (InSite)" (DIX8yF726UDlQdrD).
