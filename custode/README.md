# Custode · Roma sicura

App per viaggiare sicuri a Roma, per **turisti singoli**, **membri di gruppo** e **capigruppo**.
Versione funzionante del design "Viaggio & Custode" (tavola Custode): stesse schermate, colori,
font (Instrument Serif + Figtree) e testi.

PWA installabile sul telefono · React + Vite + TypeScript · Supabase (database, login, tempo reale).
Lingue: italiano, inglese, francese, spagnolo, polacco, rumeno.

## Schermate

| # | Schermata | Cosa fa davvero |
|---|---|---|
| 1 | Onboarding | Benvenuto, lingua, ruolo, nome. Il membro inserisce il codice gruppo (anteprima "gruppo · capogruppo" mentre scrive); il capogruppo crea il gruppo e riceve il codice `ROMA-xxxx`. |
| 2 | Scansione passaporto | Fotocamera o foto → OCR della MRZ **sul telefono** (tesseract.js) → verifica delle cifre di controllo ICAO → conferma dati → salvataggio cifrato. In alternativa MRZ scritta a mano. Poi "Aggiungi altri documenti". |
| 3 | Oggi | Saluto, data e temperatura a Roma, stato di sicurezza (zona del gruppo / borseggi / GPS), gruppo e membri (anello verde/rosso), programma con orari, tappa in corso, spostamenti e "minuto per minuto", consigli. |
| 4 | Mappa | Mappa OpenStreetMap con la mia posizione, il percorso colorato per mezzo, i membri del gruppo, la zona del gruppo e chi ne esce, le zone borseggi (Termini, Colosseo, Trevi, San Pietro, Spagna, bus 64) con avviso automatico, "intorno a te" (luoghi, farmacia, bagni da OpenStreetMap), racconto del luogo letto ad alta voce nella lingua scelta. |
| 5 | Documenti | Cassaforte bloccata da PIN, cifrata AES-256-GCM (chiave dal PIN, PBKDF2 310.000 iterazioni), salvata in IndexedDB e quindi **offline**; si blocca da sola dopo 1 minuto in background. Backup solo cifrato su Supabase. Procedura passaporto perso con commissariato più vicino e ambasciata della propria nazionalità. |
| 6 | Luoghi e musei | Prezzi, orari, **aperto/chiuso calcolato sull'ora di Roma** (fasce, giorni di chiusura, ultima domenica ai Vaticani), prima domenica del mese gratuita e prossima data, scheda museo con prenotazione sul sito ufficiale e "Al programma". |
| 7 | Trasporti | Fiumicino/Ciampino → hotel con opzioni a confronto; acquisto sul sito ufficiale (Trenitalia, Terravision, ATAC) e poi "Ho comprato: salva il biglietto" con codice → QR e/o PDF nella cassaforte, disponibile offline. |
| 8 | SOS | Tasto 112 con conto alla rovescia e annulla (avvisa anche il capogruppo con la posizione), condivisione posizione per 2 ore (link a un contatto + visibile al gruppo), polizia e ospedale più vicini, ambasciata, numeri utili, 12 frasi utili in italiano con traduzione e pronuncia. |
| — | Viaggio su più giorni | Date del viaggio (capogruppo per il gruppo, turista singolo per sé), "Giorno 2 di 4", un programma per ogni giorno con selettore. |
| — | Account e nuovo telefono | Email collegata all'account anonimo; su un altro telefono "Ho già un account" → codice via email → i documenti cifrati si ripristinano con lo stesso PIN. |
| — | Impronta / Face ID | Sblocco della cassaforte con passkey (WebAuthn PRF): il PIN viene cifrato con un segreto che esiste solo nel telefono. Il PIN resta come riserva. |
| 9 | Capogruppo | Modifica programma (itinerari pronti, orari, mezzi, aggiungi/sposta/elimina tappe), punto d'incontro sulla mappa e raggio della zona, "Invia al gruppo" (pubblica e notifica), avvisi scritti ai membri. Riceve in tempo reale chi esce dalla zona, chi sta bene, gli SOS; vede sulla mappa dove sono i membri e li chiama. Il turista singolo riceve "Sei fuori percorso" se si allontana dal tragitto. |

## Avvio

```bash
cd custode
npm install
cp .env.example .env.local   # inserisci URL e anon key del progetto Supabase
npm run dev                  # http://localhost:5173
```

Senza `.env.local` l'app funziona in **modalità locale** (turista singolo completo, tutto sul telefono;
il gruppo condiviso è disattivato).

### Supabase

1. Crea un progetto su supabase.com.
2. **Authentication → Providers → Anonymous sign-ins: attiva** (il turista entra senza password).
3. SQL editor: esegui `supabase/migrations/20261005000000_custode_init.sql` e poi `supabase/seed.sql`
   (oppure `supabase db push` con la CLI).
4. Copia Project URL e anon key in `.env.local`.
5. Per accedere da un altro telefono: **Authentication → Email Templates → Magic Link**, aggiungi il codice `{{ .Token }}` al testo della mail.

### Notifiche ad app chiusa (facoltativo)

1. Genera le chiavi VAPID: `npx web-push generate-vapid-keys`.
2. Esegui anche `supabase/migrations/20261006000000_push.sql`.
3. Pubblica la funzione: `supabase functions deploy push --no-verify-jwt` e imposta i segreti
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (es. `mailto:tu@esempio.it`), `WEBHOOK_SECRET`.
4. **Database → Webhooks**: nuovo webhook su `public.alerts`, evento INSERT, verso la funzione `push`,
   con header `x-webhook-secret` uguale a `WEBHOOK_SECRET`.
5. In `.env.local` metti `VITE_VAPID_PUBLIC_KEY`. Nelle impostazioni dell'app compare "Avvisi anche ad app chiusa".
   Su iPhone le notifiche push funzionano solo con l'app aggiunta alla schermata Home (iOS 16.4+).

Tabelle: `profiles` (utenti), `groups`, `group_members`, `plans` + `plan_stops` (programmi e tappe),
`live_locations` (posizioni live), `documents` (solo testo cifrato), `places` (luoghi/musei),
`alerts` (avvisi). Ogni tabella ha **Row Level Security**: ognuno vede solo i propri dati e quelli
del proprio gruppo; il membro vede il programma solo dopo la pubblicazione e non può modificarlo;
i documenti li vede solo il proprietario. Gruppi creati e uniti solo tramite le funzioni
`create_group`, `join_group`, `preview_group`.

### Pubblicazione

**Cloudflare (già collegato al repo):** il Worker `gestione-restorante` usa `wrangler.jsonc` nella radice
del repo. Pubblica il gestionale del ristorante su `/` e Custode su `/custode/`; lo script
`cloudflare-build.sh` prepara la cartella. `server.js`, `dati.json` e `stampanti.json` non vengono
pubblicati. Le variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (e `VITE_VAPID_PUBLIC_KEY`)
vanno messe in Cloudflare → Worker → Settings → **Build → Variables**, perché servono durante la build.

In alternativa,

Vercel: nuovo progetto con **Root directory `custode`** (c'è già `vercel.json`) e le due variabili
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Serve HTTPS per fotocamera, GPS e installazione.

## Testi e traduzioni

- `src/i18n/locales/<lingua>.json`: file usati dall'app (uno per lingua).
- Sono generati da `src/i18n/locales/*.design.json` (testi del design) + `scripts/app-strings.mjs`
  (testi nuovi, sei lingue affiancate): dopo una modifica esegui `npm run locales`.
- I dati di Roma (luoghi, racconti, itinerari, trasporti, consigli) vengono dal design
  (`npm run gen:data` li rigenera da `design/Custode.dc.html`); coordinate, orari strutturati e siti
  ufficiali sono in `src/data/places.meta.json`.

## Verifiche

```bash
npm run typecheck   # TypeScript
npm test            # MRZ (esempi ICAO), orari/domeniche, giorni del viaggio
npm run test:db     # migrazioni + 14 controlli RLS su Postgres locale
npm run build && npx vite preview --port 4173 &
npm run smoke       # percorso completo nel browser (turista, membro fuori zona, capogruppo)
```

Prezzi e orari sono indicativi (2026): vanno verificati con le fonti ufficiali prima del lancio.
