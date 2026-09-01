/* Service worker del gestionale.
   Il locale deve funzionare anche quando la linea cade: la pagina si tiene in
   cache e si riapre lo stesso. Quando la rete c'e, si prende la versione nuova
   e si aggiorna la copia, cosi gli aggiornamenti arrivano senza reinstallare. */
const CACHE = "barcapri-v2";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable.png", "./apple-touch-icon.png"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=> Promise.allSettled(SHELL.map(u=> c.add(u))))
      .then(()=> self.skipWaiting())
  );
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys()
      .then(ks=> Promise.all(ks.filter(k=> k !== CACHE).map(k=> caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener("fetch", (e)=>{
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   /* i font di Google se la vedono da soli */

  /* Il filo con il server di sala non si tiene MAI in cache: sono comande,
     stampanti e stato del momento. Una risposta vecchia rimessa dalla cache
     manderebbe la comanda alla stampante sbagliata, o non la manderebbe. */
  if(url.pathname.indexOf("/api/") > -1) return;

  /* La pagina: prima la rete, cosi si aggiorna; se manca, la copia in cache. */
  const isDoc = req.mode === "navigate" || (req.destination === "document");
  if(isDoc){
    e.respondWith(
      fetch(req).then(r=>{
        const copy = r.clone();
        caches.open(CACHE).then(c=> c.put("./index.html", copy));
        return r;
      }).catch(()=> caches.match("./index.html").then(r=> r || caches.match("./")))
    );
    return;
  }
  /* Il resto: prima la cache, che e piu veloce e regge senza linea. */
  e.respondWith(
    caches.match(req).then(hit=> hit || fetch(req).then(r=>{
      if(r && r.status === 200){
        const copy = r.clone();
        caches.open(CACHE).then(c=> c.put(req, copy));
      }
      return r;
    }).catch(()=> new Response("", {status:504, statusText:"Senza connessione"})))
  );
});
