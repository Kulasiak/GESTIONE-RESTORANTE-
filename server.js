#!/usr/bin/env node
/* ============================================================
   BAR CAPRI - SERVER DI SALA
   ------------------------------------------------------------
   Fa due lavori:
     1. serve l'applicazione ai telefoni e ai tablet del locale;
     2. tiene insieme i dati, cosi la comanda scritta sul telefono
        del cameriere arriva sul monitor della cucina.

   Non serve internet: basta il wifi del locale. Non ha bisogno di
   installare niente, solo Node.

     node server.js

   Poi sul telefono si apre l'indirizzo che compare qui sotto.
   ============================================================ */
"use strict";

const http = require("http");
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const ROOT  = __dirname;
const PORT  = Number(process.env.PORT || process.argv[2] || 8080);
const FILE  = process.env.DATI || path.join(ROOT, "dati.json");

/* ---------- memoria ---------- */
/* Ogni riga e una scheda: una comanda, un tavolo, un articolo.
   Si tiene l'ultima versione di ognuna, riconosciuta dall'ora in
   cui e stata scritta (_v). Chi scrive per ultimo vince.       */
let DATA = { seq: 0, recs: {} };

function loadData(){
  try{
    const raw = fs.readFileSync(FILE, "utf8");
    const d = JSON.parse(raw);
    if(d && d.recs && typeof d.seq === "number") DATA = d;
    log("dati letti da " + path.basename(FILE) + " (" + Object.keys(DATA.recs).length + " schede)");
  }catch(e){
    if(e.code !== "ENOENT") log("dati illeggibili, si riparte da zero: " + e.message);
  }
}

let saveTimer = null, saving = false, saveAgain = false;
function saveData(){
  if(saveTimer) return;
  saveTimer = setTimeout(flush, 400);
}
function flush(){
  saveTimer = null;
  if(saving){ saveAgain = true; return; }
  saving = true;
  const tmp = FILE + ".tmp";
  fs.writeFile(tmp, JSON.stringify(DATA), (err)=>{
    if(err){ saving = false; log("scrittura fallita: " + err.message); return; }
    fs.rename(tmp, FILE, (err2)=>{
      saving = false;
      if(err2) log("salvataggio fallito: " + err2.message);
      if(saveAgain){ saveAgain = false; saveData(); }
    });
  });
}

/* ---------- chi e collegato ---------- */
const clients = new Set();   /* {res, dev, name} */

function broadcast(recs, fromDev){
  if(!recs.length) return;
  const msg = "data: " + JSON.stringify({ seq: DATA.seq, recs: recs }) + "\n\n";
  for(const c of clients){
    if(c.dev && c.dev === fromDev) continue;   /* a chi l'ha scritto non serve */
    try{ c.res.write(msg); }catch(e){ clients.delete(c); }
  }
}

/* ---------- unione ---------- */
/* Accetta una scheda solo se e piu recente di quella che c'e gia.
   Cosi due telefoni che scrivono insieme non si cancellano a vicenda
   e un telefono che si ricollega non riporta indietro il lavoro. */
function merge(list){
  const out = [];
  for(const it of list){
    if(!it || !it.c || !it.id) continue;
    const key = it.c + "/" + it.id;
    const old = DATA.recs[key];
    const nv  = Number(it.r && it.r._v) || 0;
    const ov  = Number(old && old.r && old.r._v) || 0;
    if(old && nv <= ov) continue;
    DATA.seq += 1;
    DATA.recs[key] = { c: it.c, id: it.id, r: it.r, seq: DATA.seq };
    out.push(DATA.recs[key]);
  }
  if(out.length) saveData();
  return out;
}

function since(n){
  const out = [];
  for(const k in DATA.recs){ if(DATA.recs[k].seq > n) out.push(DATA.recs[k]); }
  out.sort((a,b)=> a.seq - b.seq);
  return out;
}

/* ---------- file dell'applicazione ---------- */
const MIME = {
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",   ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg",
  ".svg":"image/svg+xml", ".ico":"image/x-icon", ".webp":"image/webp",
  ".woff2":"font/woff2", ".txt":"text/plain; charset=utf-8", ".md":"text/markdown; charset=utf-8"
};

function serveFile(req, res, urlPath){
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if(rel === "/" || rel === "") rel = "/index.html";
  const full = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if(!full.startsWith(ROOT)){ res.writeHead(403).end("Vietato"); return; }
  fs.stat(full, (err, st)=>{
    if(err || !st.isFile()){
      /* l'applicazione e una pagina sola: qualsiasi indirizzo apre quella */
      if(!path.extname(full)) return serveFile(req, res, "/index.html");
      res.writeHead(404, {"Content-Type":"text/plain; charset=utf-8"}).end("Non trovato");
      return;
    }
    const ext = path.extname(full).toLowerCase();
    const noCache = (ext === ".html" || rel === "/sw.js" || ext === ".webmanifest");
    const head = {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": noCache ? "no-cache" : "public, max-age=3600"
    };
    if(rel === "/sw.js") head["Service-Worker-Allowed"] = "/";
    res.writeHead(200, head);
    fs.createReadStream(full).pipe(res);
  });
}

/* ============================================================
   STAMPANTI DELLE COMANDE
   ------------------------------------------------------------
   Le stampanti termiche da scontrino parlano tutte la stessa
   lingua, ESC/POS, e si attaccano alla rete: hanno un indirizzo
   come i telefoni e ascoltano sulla porta 9100. Il server apre
   il filo, manda i caratteri e la comanda esce.

   Non serve nessun programma da installare, ne il driver di
   Windows: il foglio esce da solo, senza la finestra di stampa.

   Le stampanti si scrivono in stampanti.json, che nasce da solo
   la prima volta con un esempio dentro.
   ============================================================ */
const net = require("net");
const PFILE = path.join(ROOT, "stampanti.json");
let STAMPANTI = [];

const ESEMPIO_STAMPANTI = [
  { nome:"Cucina",  ip:"192.168.1.60", porta:9100, colonne:48, reparti:["caldo","primi","freddo","pizza","pasticceria"], attiva:false },
  { nome:"Bar",     ip:"192.168.1.61", porta:9100, colonne:48, reparti:["bar"], attiva:false },
  { nome:"Cassa",   ip:"192.168.1.62", porta:9100, colonne:48, reparti:["conto"], attiva:false, cassetto:true }
];

function leggiStampanti(){
  try{
    STAMPANTI = JSON.parse(fs.readFileSync(PFILE, "utf8"));
    if(!Array.isArray(STAMPANTI)) STAMPANTI = [];
    const on = STAMPANTI.filter(x=> x.attiva).length;
    log("stampanti: " + STAMPANTI.length + " scritte, " + on + " accese");
  }catch(e){
    if(e.code === "ENOENT"){
      STAMPANTI = ESEMPIO_STAMPANTI;
      try{
        fs.writeFileSync(PFILE, JSON.stringify(ESEMPIO_STAMPANTI, null, 2));
        log("stampanti: creato " + path.basename(PFILE) + " con un esempio da correggere");
      }catch(e2){}
    }else log("stampanti.json illeggibile: " + e.message);
  }
}
function salvaStampanti(){
  try{ fs.writeFileSync(PFILE, JSON.stringify(STAMPANTI, null, 2)); return true; }
  catch(e){ log("stampanti.json non salvato: " + e.message); return false; }
}

/* --- i comandi della stampante --- */
const ESC = "\x1b", GS = "\x1d";
const CMD = {
  avvio:      ESC + "@",
  tabella:    ESC + "t" + "\x10",       /* CP1252: accenti italiani e simbolo euro */
  centro:     ESC + "a" + "\x01",
  sinistra:   ESC + "a" + "\x00",
  destra:     ESC + "a" + "\x02",
  grassetto:  ESC + "E" + "\x01",
  normale:    ESC + "E" + "\x00",
  grande:     GS  + "!" + "\x11",       /* doppia altezza e doppia larghezza */
  alto:       GS  + "!" + "\x01",       /* solo doppia altezza */
  piccolo:    GS  + "!" + "\x00",
  taglia:     "\n\n\n\n" + GS + "V" + "\x42" + "\x00",
  cassetto:   ESC + "p" + "\x00" + "\x19" + "\xfa"
};

/* Nella tabella CP1252 i caratteri fino a 255 stanno al loro posto, quindi
   "latin1" va bene. Quello che non c'e - l'arabo, per esempio - si scrive
   come si puo, altrimenti la stampante sputa segni a caso. */
const SEGNI = {
  "€":"\x80", "’":"'", "‘":"'", "“":'"', "”":'"',
  "–":"-", "—":"-", "…":"...", " ":" ", "•":"*"
};
function perStampante(t){
  let s = String(t == null ? "" : t);
  for(const k in SEGNI) s = s.split(k).join(SEGNI[k]);
  let out = "";
  for(let i=0;i<s.length;i++){
    const c = s.charCodeAt(i);
    out += c < 256 ? s[i] : "?";
  }
  return out;
}

/** Una riga di comanda: a sinistra il piatto, a destra il prezzo. */
function duecolonne(sx, dx, col){
  sx = perStampante(sx); dx = perStampante(dx);
  const spazio = col - sx.length - dx.length;
  if(spazio >= 1) return sx + " ".repeat(spazio) + dx;
  return sx.slice(0, Math.max(1, col - dx.length - 1)) + " " + dx;
}
/** Va a capo senza spezzare le parole: sulla carta stretta serve.
    Il rientro vale su tutte le righe, anche la prima, cosi la nota
    del cliente resta incolonnata sotto il suo piatto. */
function acapo(t, col, rientro){
  const pad = rientro ? " ".repeat(rientro) : "";
  const largo = Math.max(8, col - pad.length);
  const parole = perStampante(t).split(/\s+/).filter(Boolean);
  const righe = []; let r = "";
  parole.forEach(p=>{
    while(p.length > largo){ if(r){ righe.push(r); r = ""; } righe.push(p.slice(0, largo)); p = p.slice(largo); }
    if(!r.length) r = p;
    else if((r + " " + p).length <= largo) r += " " + p;
    else { righe.push(r); r = p; }
  });
  if(r.length) righe.push(r);
  if(!righe.length) righe.push("");
  return righe.map(x=> pad + x);
}

/** Una riga di comanda con la quantita incolonnata a sinistra:
      2  SPAGHETTI ALLA CARBONARA
         senza pepe
    Il piatto che va a capo resta sotto se stesso, non sotto il numero. */
function conQuantita(q, t, col){
  const n = String(q);
  const cassa = Math.max(3, n.length + 2);
  const testo = acapo(t, col, cassa);
  testo[0] = n + " ".repeat(cassa - n.length) + testo[0].slice(cassa);
  return testo;
}

/** Trasforma la comanda in quello che la stampante capisce. */
function componi(doc, st){
  const col = Number(st.colonne) || 48;
  let b = CMD.avvio + CMD.tabella + CMD.sinistra;

  if(doc.titolo){
    b += CMD.centro + CMD.grande + perStampante(doc.titolo) + "\n" + CMD.piccolo;
    if(doc.sottotitolo) b += perStampante(doc.sottotitolo) + "\n";
    b += CMD.sinistra + "-".repeat(col) + "\n";
  }
  (doc.righe || []).forEach(r=>{
    if(r == null) return;
    if(typeof r === "string"){ acapo(r, col).forEach(x=> b += x + "\n"); return; }
    if(r.riga){ b += "-".repeat(col) + "\n"; return; }
    if(r.vuota){ b += "\n"; return; }
    const stile = r.g ? CMD.grande : r.a ? CMD.alto : "";
    const fine  = stile ? CMD.piccolo : "";
    const largo = r.g ? Math.floor(col/2) : col;
    if(r.dx != null){
      /* sul conto: quantita a sinistra, piatto in mezzo, prezzo a destra */
      const q = (r.q != null && r.q !== "") ? String(r.q) : "";
      const cassa = q ? Math.max(3, q.length + 2) : 0;
      const sx = q ? q + " ".repeat(cassa - q.length) + perStampante(r.t || "") : (r.t || "");
      b += stile + duecolonne(sx, r.dx, largo) + fine + "\n";
      return;
    }
    if(r.b) b += CMD.grassetto;
    const testo = (r.q != null && r.q !== "")
      ? conQuantita(r.q, r.t || "", largo)
      : acapo(r.t || "", largo, r.rientro || 0);
    testo.forEach(x=> b += stile + x + fine + "\n");
    if(r.b) b += CMD.normale;
  });
  if(doc.piede){
    b += "-".repeat(col) + "\n" + CMD.centro;
    String(doc.piede).split("\n").forEach(riga=>{
      acapo(riga, col).forEach(x=> b += x.trim() + "\n");
    });
    b += CMD.sinistra;
  }
  b += CMD.taglia;
  if(doc.cassetto && st.cassetto) b += CMD.cassetto;
  return Buffer.from(b, "latin1");
}

/** Apre il filo con la stampante e manda i caratteri. */
function stampa(st, dati){
  return new Promise((ok)=>{
    const s = new net.Socket();
    let chiuso = false;
    const fine = (esito, err)=>{
      if(chiuso) return; chiuso = true;
      try{ s.destroy(); }catch(e){}
      ok({ ok:esito, stampante:st.nome, err:err || "" });
    };
    s.setTimeout(6000);
    s.on("timeout", ()=> fine(false, "non risponde"));
    s.on("error", (e)=> fine(false, e.code === "ECONNREFUSED" ? "spenta o porta chiusa"
                             : e.code === "EHOSTUNREACH" || e.code === "ENETUNREACH" ? "non raggiungibile"
                             : e.code === "ETIMEDOUT" ? "non risponde" : e.message));
    s.connect(Number(st.porta) || 9100, st.ip, ()=>{
      s.write(dati, ()=> setTimeout(()=> fine(true), 250));
    });
  });
}

/** Sceglie la stampante giusta per il reparto: la cucina, il bar, la cassa. */
function stampanteDi(reparto, nome){
  if(nome){
    const x = STAMPANTI.find(p=> p.attiva && p.nome === nome);
    if(x) return x;
  }
  return STAMPANTI.find(p=> p.attiva && (p.reparti || []).indexOf(reparto) >= 0) || null;
}

/* ---------- il server ---------- */
function json(res, code, obj){
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, {
    "Content-Type":"application/json; charset=utf-8",
    "Content-Length": b.length,
    "Access-Control-Allow-Origin":"*",
    "Cache-Control":"no-store"
  });
  res.end(b);
}

function readBody(req, cb){
  let n = 0; const parts = [];
  req.on("data", (c)=>{
    n += c.length;
    if(n > 12 * 1024 * 1024){ req.destroy(); return; }   /* 12 MB, piu che abbastanza */
    parts.push(c);
  });
  req.on("end", ()=>{
    try{ cb(null, JSON.parse(Buffer.concat(parts).toString("utf8") || "{}")); }
    catch(e){ cb(e); }
  });
  req.on("error", (e)=> cb(e));
}

const server = http.createServer((req, res)=>{
  const u = req.url || "/";

  if(req.method === "OPTIONS"){
    res.writeHead(204, {
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type"
    });
    return res.end();
  }

  /* --- c'e qualcuno? --- */
  if(u.startsWith("/api/info")){
    return json(res, 200, {
      ok:true, nome:"Bar Capri", seq:DATA.seq,
      schede:Object.keys(DATA.recs).length,
      collegati:clients.size, ora:new Date().toISOString()
    });
  }

  /* --- dammi tutto quello che e cambiato --- */
  if(u.startsWith("/api/pull")){
    const n = Number(new URL(u, "http://x").searchParams.get("since")) || 0;
    return json(res, 200, { seq:DATA.seq, recs:since(n) });
  }

  /* --- ecco cosa ho scritto io --- */
  if(u.startsWith("/api/push") && req.method === "POST"){
    return readBody(req, (err, body)=>{
      if(err) return json(res, 400, {ok:false, err:"dati non leggibili"});
      const recs = Array.isArray(body.recs) ? body.recs : [];
      const done = merge(recs);
      broadcast(done, body.dev || "");
      json(res, 200, { ok:true, seq:DATA.seq, presi:done.length });
    });
  }

  /* --- avvisami appena cambia qualcosa --- */
  if(u.startsWith("/api/stream")){
    const q = new URL(u, "http://x").searchParams;
    const dev = q.get("dev") || "";
    const n   = Number(q.get("since")) || 0;
    res.writeHead(200, {
      "Content-Type":"text/event-stream; charset=utf-8",
      "Cache-Control":"no-store, no-transform",
      "Connection":"keep-alive",
      "X-Accel-Buffering":"no",
      "Access-Control-Allow-Origin":"*"
    });
    res.write("retry: 3000\n\n");
    const arretrati = since(n);
    if(arretrati.length) res.write("data: " + JSON.stringify({seq:DATA.seq, recs:arretrati}) + "\n\n");
    else res.write("data: " + JSON.stringify({seq:DATA.seq, recs:[]}) + "\n\n");

    const c = { res:res, dev:dev };
    clients.add(c);
    const ping = setInterval(()=>{ try{ res.write(": ci sono\n\n"); }catch(e){} }, 25000);
    req.on("close", ()=>{ clearInterval(ping); clients.delete(c); });
    return;
  }

  /* --- quali stampanti ci sono --- */
  if(u.startsWith("/api/stampanti")){
    if(req.method === "POST"){
      return readBody(req, (err, body)=>{
        if(err || !Array.isArray(body.stampanti)) return json(res, 400, {ok:false, err:"elenco non valido"});
        STAMPANTI = body.stampanti;
        json(res, 200, {ok:salvaStampanti(), stampanti:STAMPANTI});
      });
    }
    return json(res, 200, { ok:true, stampanti:STAMPANTI.map(p=>({
      nome:p.nome, ip:p.ip, porta:p.porta || 9100, colonne:p.colonne || 48,
      reparti:p.reparti || [], attiva:!!p.attiva, cassetto:!!p.cassetto })) });
  }

  /* --- stampa una comanda o un conto --- */
  if(u.startsWith("/api/stampa") && req.method === "POST"){
    return readBody(req, (err, body)=>{
      if(err) return json(res, 400, {ok:false, err:"dati non leggibili"});
      const doc = body.doc || body;
      const st = stampanteDi(doc.reparto || "conto", doc.stampante);
      if(!st) return json(res, 200, {ok:false, err:"nessuna stampante accesa per " + (doc.reparto || "il conto")});
      const copie = Math.min(Math.max(Number(doc.copie) || 1, 1), 3);
      const dati = componi(doc, st);
      let fatte = [];
      const giro = (i)=>{
        if(i >= copie){
          const buone = fatte.filter(x=> x.ok).length;
          return json(res, 200, {ok:buone > 0, fatte:buone, di:copie,
            stampante:st.nome, err:(fatte.find(x=> !x.ok) || {}).err || ""});
        }
        stampa(st, dati).then(r=>{ fatte.push(r); giro(i + 1); });
      };
      giro(0);
    });
  }

  /* --- foglio di prova, per capire se e attaccata bene --- */
  if(u.startsWith("/api/prova") && req.method === "POST"){
    return readBody(req, (err, body)=>{
      const st = STAMPANTI.find(p=> p.nome === (body || {}).nome) ||
                 STAMPANTI.find(p=> p.attiva);
      if(!st) return json(res, 200, {ok:false, err:"nessuna stampante scritta"});
      const col = Number(st.colonne) || 48;
      const doc = {
        titolo:"BAR CAPRI", sottotitolo:"foglio di prova",
        righe:[
          {t:"Stampante:", dx:st.nome},
          {t:"Indirizzo:", dx:st.ip + ":" + (st.porta || 9100)},
          {t:"Larghezza:", dx:col + " caratteri"},
          {t:"Reparti:", dx:(st.reparti || []).join(" ") || "-"},
          {vuota:true},
          {t:"Accenti: pero, gia, cosi, e, piu", b:true},
          {t:"Accentate: per" + "\u00f2" + ", gi" + "\u00e0" + ", cos" + "\u00ec" + ", " + "\u00e8" + ", pi" + "\u00f9"},
          {t:"Prezzo di prova", dx:"12,50 \u20ac"},
          {vuota:true},
          {q:2, t:"Spaghetti alla carbonara", a:true},
          {t:"senza pepe", rientro:3},
          {riga:true},
          {t:"SE LEGGI QUESTO FOGLIO", g:true},
          {t:"la stampante e a posto."}
        ],
        piede:new Date().toLocaleString("it-IT")
      };
      stampa(st, componi(doc, st)).then(r=> json(res, 200, r));
    });
  }

  /* --- copia di sicurezza scaricabile --- */
  if(u.startsWith("/api/backup")){
    const b = Buffer.from(JSON.stringify(DATA, null, 1));
    res.writeHead(200, {
      "Content-Type":"application/json; charset=utf-8",
      "Content-Length": b.length,
      "Content-Disposition":'attachment; filename="barcapri-' + new Date().toISOString().slice(0,10) + '.json"'
    });
    return res.end(b);
  }

  /* --- svuota tutto (solo dal computer del server) --- */
  if(u.startsWith("/api/azzera") && req.method === "POST"){
    const ip = req.socket.remoteAddress || "";
    if(!/^(::1|::ffff:127\.|127\.)/.test(ip)) return json(res, 403, {ok:false, err:"solo dal computer del server"});
    DATA = { seq:0, recs:{} }; flush();
    broadcast([], "");
    return json(res, 200, {ok:true});
  }

  if(req.method !== "GET" && req.method !== "HEAD"){
    return json(res, 405, {ok:false, err:"metodo non previsto"});
  }
  serveFile(req, res, u);
});

/* ---------- avvio ---------- */
function addresses(){
  const out = [];
  const nets = os.networkInterfaces();
  for(const nome in nets){
    for(const n of nets[nome] || []){
      if(n.family === "IPv4" && !n.internal) out.push(n.address);
    }
  }
  return out;
}
function log(s){ console.log("  " + s); }

loadData();
leggiStampanti();
server.listen(PORT, "0.0.0.0", ()=>{
  const riga = "=".repeat(52);
  console.log("\n" + riga);
  console.log("  BAR CAPRI - server di sala acceso");
  console.log(riga);
  log("");
  log("Su questo computer:  http://localhost:" + PORT);
  const ips = addresses();
  if(ips.length){
    log("");
    log("Dai telefoni e dai tablet, sullo stesso wifi:");
    ips.forEach(ip=> log("   ->  http://" + ip + ":" + PORT));
  }else{
    log("Nessuna rete trovata: collega il computer al wifi del locale.");
  }
  log("");
  log("Le comande scritte su un telefono arrivano subito sugli altri");
  log("apparecchi e sul monitor della cucina.");
  log("");
  const acc = STAMPANTI.filter(x=> x.attiva);
  if(acc.length){
    log("Stampanti accese:");
    acc.forEach(x=> log("   ->  " + x.nome + "  " + x.ip + ":" + (x.porta || 9100) +
                        "  (" + (x.reparti || []).join(", ") + ")"));
  }else{
    log("Stampanti: nessuna accesa. Scrivile in stampanti.json,");
    log("           oppure dal programma: menu > Stampanti.");
  }
  log("");
  log("Dati salvati in: " + FILE);
  log("Copia di sicurezza: http://localhost:" + PORT + "/api/backup");
  log("");
  log("Per spegnere: Ctrl+C");
  console.log(riga + "\n");
});

server.on("error", (e)=>{
  if(e.code === "EADDRINUSE"){
    console.error("\n  La porta " + PORT + " e gia occupata.");
    console.error("  Prova con un altro numero:  node server.js 8081\n");
  }else console.error("\n  Errore: " + e.message + "\n");
  process.exit(1);
});

process.on("SIGINT", ()=>{
  console.log("\n  Chiudo e salvo...");
  flush();
  setTimeout(()=>{ console.log("  Fatto.\n"); process.exit(0); }, 500);
});
