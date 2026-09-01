# Bar Capri — sistema di gestione

Gestionale completo per un ristorante con bar e servizio agli hotel, in **un unico
file HTML**. Si apre in qualsiasi browser, non ha nessuna dipendenza e funziona
anche senza connessione.

Su un apparecchio solo basta aprire il file. Nel locale, con i camerieri che
prendono le comande dal telefono, si accende anche il **server di sala**
(`server.js`, un file, nessuna dipendenza): le comande arrivano al monitor della
cucina e **escono dalla stampante** della partita giusta. Tutto sul wifi del
locale — niente internet, niente abbonamenti, i dati non escono di casa.

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

### Aggiungere un prodotto

Il pulsante **Nuovo prodotto** sta su **Cassa**, **Foto dei piatti**, **Gestione
menu** e **Prodotti A–Z**. Si apre una scheda breve — nome, prezzo, misura,
provenienza, dove finisce — e c'è *Aggiungi e continua* per infilarne dieci di
fila senza richiuderla ogni volta. Il resto (traduzioni, allergeni, scarico di
magazzino) si mette dopo dalla scheda completa.

**Prodotti A–Z** è l'elenco alfabetico di tutto il locale, con ricerca, filtro per
reparto ed esportazione. Serve quando cerchi una cosa e non ricordi in che
categoria l'hai messa.

### Contabilità

Modulo a sé, diviso in quattro:

- **Riepilogo** — conto economico del mese: ricavi da vendite, acquisti, costo del personale, altre entrate e uscite, margine. Ricavi divisi per reparto, acquisti per fornitore, costo per persona. Ogni riga con la sua incidenza percentuale.
- **Prima nota** — quello che non passa dal magazzino: affitto, utenze, stipendi, manutenzioni, marketing, imposte.
- **Chiusura di cassa** — atteso contro contato, con la differenza in verde, giallo o rosso.
- **IVA** — lordo, imponibile e imposta divisi per aliquota. In Italia la somministrazione sta al 10%, gli alcolici venduti a sé stanti al 22: l'aliquota si imposta per categoria.

Gli acquisti si leggono dai **carichi di magazzino** valorizzati al costo, il
personale dalle **ore timbrate o pianificate**. Tutto esportabile in CSV per il
commercialista.

> Il prospetto IVA serve a te e al tuo commercialista. **Non è una liquidazione
> IVA** e non sostituisce il registratore telematico.

### Foglio presenze

Griglia del mese, una riga per persona e una colonna per giorno, con le ore di
ogni giornata. Le **assenze** hanno il loro colore: malattia, ferie, permesso,
infortunio, maternità. I giorni di assenza non contano ore. Si stampa in
orizzontale su A4 con lo spazio per le due firme, e si esporta in CSV.

### Codici, permessi e chi tocca cosa

Ogni persona in organico ha il **suo codice di quattro cifre**, e un livello:

| Livello | Chi | Cosa può fare |
| --- | --- | --- |
| **Operatore** | camerieri, runner, commis, cuochi, barman, lavapiatti | prendere comande, aggiungere piatti, incassare senza sconto |
| **Responsabile** | direttore, supervisore, maître, chef, sous chef | **tutto**, senza che nessuno gli chieda niente |

L'organico copre tutta la brigata, divisa per reparto: **direzione** (direttore,
supervisore), **sala** (maître, chef de rang, cameriere, runner, commis,
accoglienza, fattorino), **bar** (barman, barista, aiuto barman), **cucina**
(chef, sous chef, capo partita, cuoco, aiuto cuoco, pizzaiolo, pasticcere,
lavapiatti). Scegliendo la mansione, il livello del codice si propone da solo.

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

### Sul touch screen

Sui dispositivi senza mouse la **modalità tocco** si accende da sola: pulsanti,
piastrelle, tastierino e caselle diventano più grandi, per battere col dito di
fretta e senza sbagliare. Si forza o si spegne da Impostazioni. In cassa, ogni
piastrella mostra **quanti pezzi hai già messo**, così non devi guardare il
carrello.

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

### La carta del bar

Vini, birre, amari, distillati e acqua stanno divisi per famiglia, come su una
carta vera, ognuno con la **misura** e la **provenienza**:

| Famiglia | Cosa c'è |
| --- | --- |
| **Aperitivi e vermouth** | vermouth rosso e dry, Aperol, Campari, analcolico |
| **Vini bianchi** | la Liguria per prima — Vermentino, Pigato, Cinque Terre, Bianchetta — poi Gavi, Soave, Sauvignon |
| **Vini rossi** | Rossese di Dolceacqua, Ormeasco di Pornassio, Barbera, Montepulciano, Nero d'Avola, Malbec, Rioja |
| **Bollicine e rosati** | Prosecco, Franciacorta, Champagne, Cava, rosato ligure |
| **Birre nazionali** | spina 0,2 e 0,4, IPA, frumento, ambrata, 0,66, analcolica |
| **Birre estere** | lager e weiss tedesche, pilsner ceca alla spina, IPA inglese, stout irlandese, blanche e trappista belghe |
| **Amari e digestivi** | amaro della casa, alle erbe, limoncello, grappa bianca e barricata, sambuca, mirto |
| **Distillati** | gin italiano e London Dry, whisky blended e single malt, rum bianco e invecchiato, vodka, tequila, cognac, brandy |
| **Acqua** | naturale e frizzante in 0,5, 0,75 e 1 litro, più la caraffa microfiltrata |
| **Salse e condimenti** | olio extravergine, balsamico, pesto, salsa verde, e le monoporzioni |

I nomi propri — Vermentino, Rossese, Franciacorta — **non si traducono**: restano
gli stessi in tutte e sei le lingue, com'è giusto.

### Magazzino
| Sezione | Cosa fa |
| --- | --- |
| **Magazzino del bar** | Ogni voce della carta ha il suo articolo di magazzino con la **resa** giusta: una bottiglia di vino fa sei calici, un fusto da 30 litri fa 150 birre piccole, una bottiglia di gin regge 25 bicchierini da 4 cl. **Quando vendi, il magazzino si scarica da solo**: tre birre alla spina da 0,4 tolgono 1,2 litri dal fusto. |
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

## Sul telefono: si installa come una app

Il cameriere prende le comande dal telefono. La pagina è una **PWA**: si installa
sulla schermata Home e si apre a schermo intero, senza barra del browser.

**iPhone e iPad** — apri l'indirizzo con **Safari** (solo Safari può installare su
iOS), tocca **Condividi** → **Aggiungi a Home**.

**Android** — apri con **Chrome**, tre puntini → **Installa applicazione**. Chrome
mostra anche da solo il suo invito.

Dentro l'app c'è **Installa sul telefono** nella barra laterale, che spiega i passi
del telefono che hai in mano.

**Funziona senza linea.** Un service worker tiene la pagina in memoria: se il wifi
della sala cade, il gestionale si apre lo stesso e continua a lavorare. Quando la
linea torna, si aggiorna da solo.

Senza il server di sala (qui sotto) ogni dispositivo tiene i **suoi** dati e le
comande restano sul telefono che le ha scritte. Con il server acceso viaggiano.

---

## Il server di sala: le comande arrivano in cucina

`server.js` è un programma piccolo che gira su un computer del locale — il PC
della cassa va benissimo — e fa due cose:

1. **serve l'applicazione** ai telefoni e ai tablet, così non c'è niente da
   installare su ogni apparecchio: si apre l'indirizzo e basta;
2. **tiene insieme i dati**, così la comanda scritta sul telefono del cameriere
   compare sul monitor della cucina, sul tablet della cassa e sugli altri telefoni.

Non serve internet: basta il wifi del locale. Non serve un abbonamento, non serve
un account, e i dati restano dentro il locale.

```bash
node server.js          # oppure:  node server.js 8081  per cambiare porta
```

All'accensione scrive l'indirizzo da usare sui telefoni:

```
  Dai telefoni e dai tablet, sullo stesso wifi:
     ->  http://192.168.1.50:8080
```

Sui telefoni si apre quell'indirizzo e **il collegamento si accende da solo**.
Se invece la pagina arriva da un'altra parte, si scrive l'indirizzo a mano in
**menu → Collegamento**. In alto a destra c'è una spia: verde collegato, gialla
sta cercando, grigia da solo.

### Come si mettono d'accordo

Ogni scheda — una comanda, un tavolo, un articolo — porta con sé l'ora
dell'ultima modifica: **vince la più recente**. Le righe della comanda hanno
un'ora ciascuna, così la cucina può segnare *pronto* mentre il cameriere sta
aggiungendo un dolce, senza che uno cancelli il lavoro dell'altro. Una riga tolta
resta tolta e non ricompare.

Se il wifi cade, il telefono continua a lavorare da solo e manda tutto appena la
linea torna. Un apparecchio riacceso dopo un'ora prende la versione buona e non
riporta indietro il lavoro degli altri.

### Quanti apparecchi

Misurato davvero, con 100 telefoni collegati insieme: **tutto consegnato, ritardo
tipico 3 millisecondi**, il peggiore 6. Il primo aggancio di un apparecchio nuovo
scarica il quadro completo in poco più di un decimo di secondo. Per un locale
normale — sei camerieri, due monitor in cucina, il bar e la cassa — il server non
è nemmeno impegnato.

Il limite vero non è il numero di telefoni: è la memoria del browser, circa 5 MB
per apparecchio. A cento comande al giorno sono **due o tre mesi di servizio**
prima che convenga archiviare. L'applicazione avvisa quando la memoria si riempie;
si esporta un backup e si riparte.

---

## Le comande escono dalla stampante

Il foglio esce dalla stampante del reparto giusto: i primi alla partita dei primi,
il caffè al bar, il conto alla cassa. Si tocca **Manda in cucina** e la carta esce.

### Che stampante serve

Una **stampante termica da scontrino con la presa di rete**: Epson TM-T20III,
TM-m30, Star TSP100 / TSP143 o equivalenti. Parlano tutte la stessa lingua
(ESC/POS) sulla porta **9100**.

- **Carta da 80 mm** (48 caratteri per riga). Va bene anche la 58 mm, si imposta.
- **Taglio automatico**: il foglio si stacca da solo.
- **In rete, con un indirizzo fisso** dato dal router: va bene sia col cavo sia
  col **wifi** (vedi sotto).
- Alla cassa serve anche l'attacco per il **cassetto dei soldi**, che si apre da
  solo quando si stampa il conto.

### Wifi o cavo

**Il wifi funziona.** Il sistema non vede differenza: apre il filo verso un
indirizzo sulla porta 9100, e come ci arriva non gli interessa. Modelli che
vanno: Epson **TM-m30II** (wifi di serie), Star **TSP143IIIW**, Star **TSP654II
WLAN**. Si mette la stampante sul wifi del locale, le si dà un indirizzo fisso e
si scrive quello nel programma.

Detto questo, dove puoi tirare un cavo, tiralo:

| | Cavo | Wifi |
|---|---|---|
| **In cucina** | fra acciaio, forni e vapore non salta mai | ogni tanto perde il collegamento |
| **Se manca la corrente** | riparte da sola | deve prima riagganciarsi all'access point |
| **Da spostare** | serve una presa di rete | la porti dove vuoi |
| **Costo** | uguale o meno | qualcosa in più |

**Il banco, la cassa e il bar sul wifi vanno benissimo.** In cucina il cavo è più
tranquillo — ma se il wifi è l'unica strada, il sistema è fatto per reggerlo:

- **se il filo cade, riprova da solo una volta**, dopo mezzo secondo. Un cadere
  di wifi non ti fa perdere la comanda;
- **non riprova mai dopo un'attesa lunga**, perché lì il foglio potrebbe essere
  già uscito: due comande uguali in cucina fanno danno quanto nessuna;
- se non ce la fa, **te lo dice in mezzo secondo** e la comanda resta comunque
  sul monitor della cucina.

### Il foglio non è uscito

Capita: carta finita, wifi giù, qualcuno l'ha strappato. Sul monitor della
cucina, su ogni comanda, c'è il tasto con la stampante: **rifà il foglio senza
rimandare la comanda**. Esce con scritto sopra `*** RISTAMPA ***` a caratteri
grandi, così in cucina nessuno cucina la stessa cosa due volte.

Non serve installare driver, né su Windows né sui telefoni: parla il server. Non
esce nessuna finestra di stampa — la carta esce e basta.

### Come si impostano

Dal menu → **Stampanti**. Per ognuna: nome, indirizzo, larghezza della carta,
**lingua del foglio** (la cucina può leggere in italiano anche se il cameriere
lavora in arabo) e i **reparti** che le toccano:

| Reparto | Cosa ci finisce |
|---|---|
| Primi, Caldo, Freddo, Pizza, Pasticceria | le partite della cucina |
| Bar | caffè, cappuccino, spremute, vini, birre, cocktail |
| Conto e cassa | il conto, con il cassetto |

Chi fa tutto con una stampante sola le assegna tutti i reparti: esce un foglio
unico. Chi ha la partita pizza separata le dà solo *Pizza*.

C'è il **foglio di prova** per capire subito se è attaccata bene.

### Cosa esce sulla carta

```
                 TAVOLO 7
             4 coperti - Natalia
------------------------------------------------
PRIMO
2  SPAGHETTI ALLA CARBONARA
   - senza pepe
SECONDO
1  TAGLIATA DI MANZO
   - al sangue
------------------------------------------------
                  19:42
```

Il tavolo a caratteri doppi, i piatti a doppia altezza perché si leggano da
lontano e con le mani occupate, la quantità incolonnata a sinistra, le modifiche
rientrate sotto il loro piatto. Gli accenti italiani escono giusti (`però`,
`già`, `caffè`), non a punti interrogativi, e il nome lungo va a capo senza
uscire dalla carta.

**Se la stampante è spenta il lavoro non si ferma:** il programma lo dice in due
secondi e la comanda resta comunque sul monitor della cucina.

## Le immagini dei piatti

Il listino senza immagini si legge male e si batte lento. Ma le foto giuste sono
quelle **dei piatti che si cucinano qui**: quelle scaricate da internet mostrano
roba che in cucina non esiste, e l'ospite se ne accorge. È scritto anche nella
guida ai volantini, dentro questo stesso programma.

Allora, finché la foto vera non c'è, **il piatto se lo disegna il programma**.
Trentaquattro disegni, visti dall'alto, riconoscibili a colpo d'occhio anche
sulla piastrella piccola del telefono: espresso, cappuccino, cornetto, spremuta,
uova, yogurt, toast, pizza rossa e margherita, tre tipi di pasta, risotto,
tagliata, pesce, insalata, contorni, tagliere, bruschette, burrata, dolci,
gelato, vini bianchi rossi e bollicine, cocktail, birra, amari, acqua, lattine,
salse.

Non pesano niente, non si scaricano, funzionano senza linea e non sono di
nessun altro: li disegna l'applicazione ogni volta, in una riga di codice.
**Appena metti la foto vera del tuo piatto, il disegno sparisce.**

Il disegno si sceglie dal nome del piatto e dalla sua categoria. Quando la
categoria è già sicura comanda lei: dentro *Distillati* una grappa **bianca** non
diventa un vino bianco, e un whisky s**cozz**ese non diventa un piatto di cozze.

Le immagini si vedono dove servono: nella **presa comanda**, in **cassa**, nelle
righe dell'**elenco** e sullo **schermo LED** — piatto del giorno, cocktail,
reparti e muro di immagini. Prima lo schermo LED restava vuoto finché qualcuno
non caricava le fotografie.

### Se la foto non entra

Il programma adesso dice **perché**, invece di lasciarti col dubbio:

| Cosa vedi | Cosa è successo | Come si risolve |
|---|---|---|
| *Foto in formato HEIC* | L'iPhone salva in HEIC e fuori da Safari nessun browser lo apre | iPhone: **Impostazioni → Fotocamera → Formati → Massima compatibilità**. Poi riscatta |
| *Questo file non è una foto* | Hai scelto un PDF o un documento | Servono JPG o PNG |
| *Foto troppo pesante da aprire* | Uno scatto in RAW, o un file enorme | Usa uno scatto normale |
| *Non la lascia salvare* | Navigazione privata, o la pagina è dentro una cornice | La foto **si vede lo stesso** per tutta la giornata, ma chiudendo si perde. Apri il programma dal suo indirizzo, non dentro un'anteprima |
| *Memoria piena* | Troppe foto su questo apparecchio | Esporta un backup e togli le foto vecchie |

La foto viene rimpicciolita da sola a 1100 punti **sul lato lungo**, così anche
le foto in verticale scendono di peso (una foto da telefono passa da 4 MB a
circa 150 KB) e restano dritte.

### Quando fai le foto vere

Con il telefono, senza attrezzatura: **luce di giorno da una finestra**, mai il
flash; il piatto **dall'alto** o a 45 gradi; tovaglia chiara e niente in giro;
il piatto **pieno come lo servi**, non di più. Tre minuti a piatto, e il listino
diventa il tuo.

## Foto o elenco, come preferisci

Quando prendi la comanda o batti alla cassa, un selettore in alto cambia come si
vedono i prodotti:

- **Foto** — piastrelle grandi con l'immagine. Per chi va a colpo d'occhio, e per chi è nuovo.
- **Foto e nome** — piastrelle piccole, ne stanno molte di più sotto il pollice.
- **Elenco** — righe scritte con nome, misura e prezzo. A menu imparato è la più veloce.

La scelta resta quella che hai messo, e vale sia in cassa che nella comanda.

## Come si usa

**Per provarlo:** apri `index.html` con un doppio clic.

**Nel locale, con più apparecchi:** accendi il server di sala e apri l'indirizzo
che scrive.

```sh
node server.js
```

Serve l'applicazione *e* fa viaggiare le comande, quindi è l'unico comando che
serve. In alternativa, per la sola pagina su un apparecchio solo:

```sh
python3 -m http.server 8000
```

e vai su `http://localhost:8000`. Così però le comande non escono da quel
dispositivo, e le stampanti non funzionano.

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

Con il server di sala acceso i dati stanno anche su `dati.json`, sul computer del
locale, e si scaricano da `http://<indirizzo>:8080/api/backup`. Restano comunque
dentro il locale: non escono su internet e non passano da nessun servizio esterno.

Lo scontrino prodotto dalla cassa è un promemoria interno: non sostituisce il
documento commerciale del registratore telematico. Anche il conto stampato sulla
termica lo dice sopra: *non è uno scontrino fiscale*.

---

## Struttura

```
index.html              il gestionale, tutto dentro un file
server.js               il server di sala: comande fra gli apparecchi e stampanti
stampanti.json          le stampanti del locale (nasce da solo alla prima accensione)
dati.json               i dati tenuti dal server (nasce da solo)
manifest.webmanifest    per installarlo sul telefono
sw.js                   fa funzionare l'app senza linea
icon-*.png              icone dell'app
vercel.json             configurazione per il deploy
```

`server.js` non ha nessuna dipendenza: gira con il solo Node, senza `npm install`.
I due file che si scrive da solo si possono mettere altrove:

```sh
DATI=/mnt/backup/dati.json STAMPANTI=/etc/barcapri/stampanti.json node server.js
```

Il cuore è `index.html`, con dentro tutto: design system, icone SVG, bandiere
disegnate in SVG (si vedono uguali su ogni sistema, anche dove le emoji-bandiera
non esistono), dizionario delle sei lingue, dati e logica. Nessun passaggio di
compilazione.
