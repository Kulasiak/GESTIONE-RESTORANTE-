# Sistema di gestione ristorante

Gestionale completo per un ristorante con bar e servizio agli hotel, in **un unico
file HTML**. Nessuna installazione, nessun server, nessuna dipendenza: si apre in
qualsiasi browser e funziona anche senza connessione. I dati restano sul
dispositivo, dentro il browser.

Sei lingue con la propria bandiera: **Italiano, English, Français, Español,
Deutsch, العربية** (con scrittura da destra a sinistra).

---

## Cosa c'è dentro

### I quattro reparti

Il locale lavora su quattro fronti, e tutto il sistema è organizzato così:
**colazione**, **gastronomia** (il banco da asporto), **ristorante** e **bar**.
Ogni categoria del menu appartiene a un reparto, e da lì si organizzano le foto,
la cassa e le schermate del LED.

### Ogni giorno
| Sezione | Cosa fa |
| --- | --- |
| **Cruscotto** | Incasso e coperti del giorno, tavoli occupati, prenotazioni, comande aperte. Il riquadro *Da sistemare adesso* elenca quello che manca: briefing non fatto, slogan non scelto, tavoli da rifare, scorte sotto minimo, ordini hotel da preparare. |
| **Briefing** | Il briefing di inizio turno: slogan del giorno, piatti del giorno, esauriti, prenotazioni con note (allergie, compleanni, gruppi), obiettivo del turno e chi era presente. Si stampa su A4 da appendere in cucina. |
| **Monitor cameriere** | Il monitor che sta in sala. Chi arriva **entra col proprio codice** di quattro cifre, prende le comande a nome suo, e quando **stacca** esce: il monitor si richiude e resta pronto per il turno dopo. L'entrata e l'uscita finiscono da sole nelle timbrature. |
| **Cassa** | Presa ordine al banco toccando le foto: si sceglie il reparto, si tocca il piatto, si incassa in contanti o carta. **Non è un registratore fiscale** e non emette scontrini validi — lo scontrino lo batte il registratore telematico, questo è il promemoria dell'ordine. Gli incassi finiscono comunque nei report. |
| **Checklist** | Apertura, mise en place e chiusura. Ogni voce si spunta con il nome di chi l'ha fatta e l'ora. |

### Sala
| Sezione | Cosa fa |
| --- | --- |
| **Monitor cameriere** | Vedi sopra: si entra col codice, si esce staccando. |
| **Tavoli** | Piantina delle quattro sale (sala interna, veranda, dehors, bancone). Sei stati a colori — libero, prenotato, occupato, al conto, da pulire, fuori servizio — con il cronometro dei minuti da quando l'ospite si è seduto. I tavoli si spostano trascinandoli. La sigla **MEP** segnala i tavoli ancora da apparecchiare. |
| **Prenotazioni** | Giorno per giorno, divise fra pranzo e cena, con note sempre in vista (allergie, seggiolone, sedia a rotelle). Da qui si fa accomodare l'ospite e si apre la comanda in un colpo solo. |
| **Comande** | Presa comanda per portate (antipasto, primo, secondo, contorno, dolce, bevande), note per la cucina riga per riga, invio in cucina, conto con coperto, sconto, conto diviso e scontrino stampabile. |

### Cucina
| Sezione | Cosa fa |
| --- | --- |
| **Monitor cucina** | Le comande arrivano come ticket, filtrabili per postazione (freddo, primi, caldo, pizza, pasticceria, bar). Il ticket diventa rosso e pulsa dopo 22 minuti. In alto il totale dei piatti da fare. Si tocca una riga per segnarla pronta. |
| **Schede piatto** | Ricette con ingredienti presi dal magazzino: il costo del piatto si calcola da solo, con food cost e margine. La tabella è ordinata dal margine peggiore. |
| **Preparazioni** | La lista del giorno, più i suggerimenti automatici del sistema (piatti del giorno da preparare, articoli in esaurimento). |
| **HACCP** | Registro giornaliero dei punti di controllo con limiti e firma di chi rileva: frigo, congelatore, cottura al cuore, abbattimento, olio friggitrice, sanificazione. |

### Bar
**Cocktail** — carta cocktail con ricetta, bicchiere, tecnica, guarnizione e
gradazione. In testa la fascia dell'**aperitivo di ogni pomeriggio**. Sotto,
listino bar completo con food cost e disponibilità.

### Codici, permessi e chi tocca cosa

Ogni persona in organico ha il **suo codice di quattro cifre**, e un livello:

| Livello | Chi | Cosa può fare |
| --- | --- | --- |
| **Operatore** | camerieri, cuochi, barman, lavapiatti | prendere comande, aggiungere piatti, incassare senza sconto |
| **Responsabile** | direzione, maître, chef | **tutto**, senza che nessuno gli chieda niente |

**Il codice del responsabile serve sempre** per modificare qualcosa che è già in
movimento:

- togliere o ridurre un piatto **già mandato in cucina**;
- cambiare le modifiche a un piatto già in lavorazione;
- fare uno **sconto** sul conto;
- aprire la scheda di una persona, dove stanno codici e livelli.

Aggiungere un piatto, prendere una comanda nuova o incassare senza sconto **non**
chiedono niente: il lavoro normale non si ferma mai. Ogni autorizzazione lascia
traccia — cosa è stato modificato, chi l'ha chiesto e chi l'ha concesso.

I codici si assegnano dalla scheda della persona, in **Anagrafica**. Due persone non
possono avere lo stesso codice: il sistema lo rifiuta.

> Il codice mette ordine nel lavoro, **non è una difesa informatica**. I dati stanno
> in chiaro nel browser: chi ha in mano il dispositivo può leggerli. Serve a sapere
> chi ha fatto cosa e a fermare la modifica distratta, non a proteggere da chi vuole
> davvero entrare.

### Menu
**Gestione menu** — ogni piatto ha nome e descrizione in sei lingue, prezzo,
allergeni, postazione di cucina, disponibilità, flag *piatto del giorno* e **foto**.
Una colonna mostra a colpo d'occhio in quante lingue è tradotto. La **carta si
stampa** in una lingua sola o in tutte e sei, già impaginata in A4, con o senza le
foto dei piatti.

**Modifiche al piatto** — il listino di tutto quello che l'ospite chiede davvero,
diviso in cinque gruppi: **allergie e diete** (celiaco, intolleranze, allergie,
vegetariano, vegano), **cottura** (al sangue, media, ben cotta, al dente),
**senza** (cipolla, aglio, glutine, lattosio, maiale, alcol, ghiaccio…),
**aggiungi** (parmigiano, mozzarella, patatine — con il loro prezzo) e **servizio**
(salsa a parte, ben caldo, da dividere in due, porzione bambino, per primo).

Nella comanda, accanto a ogni piatto, c'è il tasto delle modifiche: **il cameriere
tocca, non scrive**. Così in cucina arriva sempre la stessa parola, e non
*senza cipola* scritto in tre modi diversi. Le modifiche di allergia **escono in
rosso** sul monitor della cucina. Una modifica che costa si somma da sola al prezzo
della riga. Il listino si allunga e si accorcia da questa stessa pagina.

### Magazzino
| Sezione | Cosa fa |
| --- | --- |
| **Magazzino** | Giacenze per reparto (frigo, freezer, dispensa, cantina, bar) con barra del livello rispetto alla scorta ideale, carichi, scarichi, sprechi e rettifiche. Il valore del magazzino è sempre in alto. |
| **Fornitori** | Rubrica con giorni di consegna e orario limite per gli ordini. L'**ordine fornitore** si genera da solo con quello che manca, diviso per fornitore, e si stampa. |

### Hotel
| Sezione | Cosa fa |
| --- | --- |
| **Hotel** | Gli hotel convenzionati vicino al locale: distanza, camere, referente, fascia oraria di consegna, accordo e sconto. |
| **Colazioni** | Le consegne del giorno ordinate per orario, con il **foglio di produzione** che somma tutto quello che la cucina deve preparare. Un pulsante ripete gli ordini di ieri. Ogni consegna ha la sua **bolla stampabile**. |
| **Asporto** | Ordini da asporto al banco e consegne agli hotel, con avanzamento di stato fino a *consegnato*. |

### Personale
| Sezione | Cosa fa |
| --- | --- |
| **Anagrafica** | Ruolo, contratto **full-time / part-time / extra**, ore contrattuali, costo orario e lingue parlate (con le bandiere). |
| **Turni e orari** | Pianificazione settimanale a griglia: si clicca una casella per aggiungere un turno. Le ore si sommano da sole e diventano rosse se superano il contratto. In fondo il **costo del lavoro** della settimana e le **timbrature** di entrata e uscita del giorno. Una settimana si copia su quella dopo. |
| **Comportamento** | Cinque liste, ognuna leggibile e **stampabile in una delle sei lingue**: regole di comportamento, sequenza del servizio perfetto, mise en place dei tavoli, apertura, chiusura. Il foglio stampato ha lo spazio per la firma. |

### Marketing
| Sezione | Cosa fa |
| --- | --- |
| **Slogan del giorno** | Un generatore compone lo slogan in tutte e sei le lingue insieme. Si sceglie quello del giorno, gli si può attaccare **un'immagine**, e si vede l'archivio con cosa si è usato negli ultimi sette giorni. |
| **Volantini** | Guida in dieci punti su **come si fa un volantino** e come va distribuito. Quattro modelli pronti (aperitivo, colazione hotel, menu del giorno, serata a tema) da modificare in sei lingue, con foto, anteprima e stampa in A4 a colori. |
| **Schermo LED** | Sequenza a tutto schermo per lo schermo del locale: **muro di foto**, benvenuto, slogan, piatti del giorno, cocktail, aperitivo, **un reparto intero**, orologio e testi liberi. **Le foto dei piatti riempiono lo schermo**: il piatto del giorno esce grande accanto al nome e al prezzo, lo slogan gira su una foto a tutto campo. Ruota le lingue a ogni schermata, così l'ospite straniero legge nella sua. |

### Qualità e direzione
- **Se qualcosa non va** — registro delle segnalazioni con tipo, gravità, tavolo, chi segnala e azione correttiva. Non si chiude una segnalazione senza aver scritto l'azione.
- **Report** — 1, 7, 14 o 30 giorni: incasso, coperti, scontrino medio, food cost, costo del lavoro, margine lordo, incasso per categoria, classifica dei piatti, esportazione CSV.
- **Impostazioni** — dati del locale, lingua, **sei colori del sistema**, tema chiaro/scuro/automatico, backup ed esportazione.

---

## Come si usa

Apri `index.html` con un doppio clic, oppure servi la cartella:

```sh
python3 -m http.server 8000
```

e vai su `http://localhost:8000`.

Su iPhone o iPad, da Safari: **Condividi → Aggiungi a Home**. Si apre a schermo
intero come un'applicazione.

Al primo avvio il sistema si riempie da solo con un locale dimostrativo completo:
35 tavoli su quattro sale, 40 piatti, 15 persone in organico con i turni della
settimana, 40 articoli di magazzino, 6 fornitori, 5 hotel convenzionati e tre
settimane di storico vendite. Da **Impostazioni → Ricarica dati dimostrativi** si
riparte da capo.

### Colori del sistema

Sei tinte: Terracotta, Notte e oro, Marino, Bosco, Vino, Oro. Ognuna funziona in
chiaro e in scuro. Si cambiano da Impostazioni e valgono per tutto, schermo LED
e volantini compresi.

### Scorciatoie

- `1` … `7` — cruscotto, tavoli, comande, cucina, magazzino, turni, briefing
- `⌘K` o `Ctrl+K` — tavoli
- `F2` — monitor cucina
- `Esc` — chiude la finestra aperta, o esce dallo schermo LED

---

## Le lingue

L'interfaccia è tradotta in sei lingue. I contenuti rivolti all'ospite — nomi e
descrizioni dei piatti, slogan, volantini, schermo LED — hanno la loro traduzione
per ognuna; le regole per il personale sono tradotte tutte e sei, così ogni
collaboratore legge nella propria lingua. Quello che non è stato tradotto ricade
sull'italiano invece di sparire.

L'arabo gira l'interfaccia da destra a sinistra. Prezzi, orari e date restano in
cifre latine perché in sala li leggano tutti.

---

## Le foto dei piatti

**Dove si caricano:** sezione **Foto dei piatti**, sotto Menu. È una griglia divisa
nei quattro reparti — colazione, gastronomia, ristorante, bar — con il contatore su
ogni linguetta (*Gastronomia 6/9*). Le caselle vuote hanno il bordo tratteggiato: si
tocca e si sceglie la foto. La casella **Senza foto** lascia in vista solo quelle che
mancano ancora, così si finisce il lavoro senza cercare.

Si può anche caricare dalla singola scheda del piatto, dallo slogan e dal volantino.
La foto viene rimpicciolita e compressa da sola — una da 4 MB diventa un centinaio di
KB — e resta su questo dispositivo, come tutto il resto.

Dove si vedono:

- **Schermo LED — muro di foto** — riempie tutto lo schermo con le foto dei piatti, fino a otto alla volta, con nome e prezzo in basso. Cambia selezione a ogni giro. Si può limitare a un reparto solo: un muro di colazioni al mattino, uno di gastronomia a mezzogiorno.
- **Schermo LED — piatto del giorno** — esce grande accanto a nome, descrizione e prezzo; a ogni giro tocca a un piatto diverso, così lo schermo non si ripete.
- **Schermo LED — slogan** — gira su una foto a tutto campo con una velatura scura sotto, perché il testo resti leggibile da lontano.
- **Schermo LED — reparto** — i piatti di un reparto con la miniatura accanto a nome e prezzo.
- **Cassa** — le piastrelle sono le foto: si tocca e va nell'ordine. I piatti senza foto mostrano il nome, quindi la cassa funziona anche prima di aver fotografato tutto.
- **Cruscotto** — miniatura accanto a ogni piatto del giorno, e lo slogan sopra la sua immagine.
- **Gestione menu** — miniatura in tabella, per capire al volo quali piatti sono ancora senza foto.
- **Carta stampata** — casella *Con le foto dei piatti* al momento della stampa.
- **Volantini** — la foto entra nel modello e va in stampa a colori.

Nelle impostazioni dello schermo LED c'è la casella **Solo schermate con foto**: le
schermate senza immagine vengono saltate e lo schermo va tutto a foto. Se non hai
ancora caricato niente lo schermo non resta vuoto — torna a mostrare tutto.

Le foto stanno in IndexedDB, non in `localStorage`: quattro scatti riempirebbero i
5 MB scarsi che `localStorage` concede, e il gestionale smetterebbe di salvare tutto
il resto. Il backup se le porta dietro, quindi un file di backup con le foto pesa
qualche MB invece di qualche decina di KB. Una foto che non è più agganciata a
niente viene buttata da sola.

Vale il consiglio scritto nella guida ai volantini: **foto vera del piatto, scattata
nel locale con la sua luce**. Le immagini scaricate da internet si riconoscono, e
oltretutto quasi sempre non si possono usare.

## Dati e backup

Tutto è salvato in `localStorage`, sotto la chiave `ristorante_sistema_v1`, e le
foto in IndexedDB sotto `ristorante_foto`. I dati
non escono mai dal dispositivo e non vengono inviati a nessun server. Sono legati a
quel browser: conviene esportare un backup con regolarità da **Impostazioni →
Esporta**, che produce un file JSON. **Ripristina** lo rilegge, adattando anche i
backup fatti con versioni precedenti.

Lo scontrino prodotto dalla cassa è un promemoria interno: non sostituisce il
documento commerciale del registratore telematico.

---

## Struttura

Un solo file, `index.html`, con dentro tutto: design system, icone SVG, bandiere
disegnate in SVG (si vedono uguali su ogni sistema, anche dove le emoji-bandiera
non esistono), dizionario delle sei lingue, dati e logica. Nessun passaggio di
compilazione.
