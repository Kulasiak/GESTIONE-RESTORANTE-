import { useEffect, useMemo, useRef, useState } from 'react';
import L_ from 'leaflet';
import { useApp } from '../state';
import { L, fmt } from '../i18n';
import { EXTRA, MODES, PLACES, RISK_LINES, RISK_ZONES, ROME_CENTER, stopPoint } from '../data/rome';
import { buildSteps, nowIndex, stopName } from '../lib/planview';
import { distance, fmtDistance, mapsDirections, walkMinutes, type LatLng } from '../lib/geo';
import { nearbyServices, type Poi } from '../lib/nearby';
import { speak, stopSpeaking, canSpeak } from '../lib/speech';
import { initials } from '../components/ui';

type Layers = { route: boolean; risk: boolean; group: boolean };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function markerIcon(label: string, name: string, fill: string, stroke: string, color: string, size: number, right: boolean) {
  return L_.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div class="mk" style="flex-direction:${right ? 'row-reverse' : 'row'};transform:translate(${right ? `calc(-100% + ${size / 2}px)` : `-${size / 2}px`},-${size / 2}px)">
      <div class="dot" style="width:${size}px;height:${size}px;background:${fill};border-color:${stroke};color:${color}">${esc(label)}</div>
      <span class="lbl">${esc(name)}</span></div>`,
  });
}

const meIcon = (c: string) => L_.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10], html: `<div class="me"><i style="background:${c}"></i><b style="background:${c}"></b></div>` });

export default function MapScreen() {
  const { t, lang, profile, plan, pos, posError, group, members, zone, inRisk, go } = useApp();
  const [layers, setLayers] = useState<Layers>({ route: true, risk: true, group: true });
  const [pois, setPois] = useState<Poi[]>([]);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L_.Map | null>(null);
  const groups = useRef<{ route: L_.LayerGroup; risk: L_.LayerGroup; group: L_.LayerGroup; me: L_.LayerGroup } | null>(null);
  const centered = useRef(false);
  const isSolo = profile.role === 'solo' || !profile.groupId;
  const isMember = profile.role === 'member';
  const isLeader = profile.role === 'leader';
  const out = !!zone?.out;

  // Crea la mappa una volta
  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const m = L_.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView([ROME_CENTER.lat, ROME_CENTER.lng], 14);
    L_.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'map-tiles', attribution: '© OpenStreetMap' }).addTo(m);
    groups.current = { risk: L_.layerGroup().addTo(m), route: L_.layerGroup().addTo(m), group: L_.layerGroup().addTo(m), me: L_.layerGroup().addTo(m) };
    map.current = m;
    return () => { m.remove(); map.current = null; groups.current = null; stopSpeaking(); };
  }, []);

  // Percorso del giorno
  useEffect(() => {
    const g = groups.current?.route;
    if (!g) return;
    g.clearLayers();
    if (!plan || !layers.route) return;
    const now = nowIndex(plan);
    const pts = plan.stops.map(stopPoint);
    plan.stops.forEach((s, i) => {
      const a = pts[i - 1], b = pts[i];
      if (i > 0 && a && b && s.mode) {
        const md = MODES[s.mode];
        L_.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: md.color, weight: s.mode === 'walk' ? 3.5 : 4, dashArray: s.mode === 'walk' ? '2 7' : undefined, lineCap: 'round', opacity: i <= now ? 0.4 : 1 }).addTo(g);
      }
    });
    const seen = new Set<string>();
    plan.stops.forEach((s, i) => {
      const p = pts[i];
      const key = s.place ?? `${s.lat},${s.lng}`;
      if (!p || seen.has(key)) return;
      seen.add(key);
      const isH = s.place === 'hotel';
      const isNow = i === now;
      const size = isNow ? 24 : 20;
      const right = map.current ? map.current.latLngToContainerPoint([p.lat, p.lng]).x > (mapEl.current?.clientWidth ?? 400) * 0.66 : false;
      L_.marker([p.lat, p.lng], {
        icon: markerIcon(isH ? 'H' : String(i), isH ? 'Hotel' : stopName(s, lang, profile), isNow ? '#B5502F' : i < now || isH ? '#2A211B' : '#fff', isNow ? '#fff' : '#2A211B', isNow || i < now || isH ? '#fff' : '#2A211B', size, right),
        interactive: false, zIndexOffset: isNow ? 300 : 100,
      }).addTo(g);
    });
  }, [plan, layers.route, lang, profile]);

  // Zone a rischio borseggi
  useEffect(() => {
    const g = groups.current?.risk;
    if (!g) return;
    g.clearLayers();
    if (!layers.risk) return;
    RISK_ZONES.forEach((z) => L_.circle([z.lat, z.lng], { radius: z.r, color: '#B3261E', weight: 1.5, dashArray: '3 3', fillColor: '#B3261E', fillOpacity: 0.13, interactive: false }).addTo(g));
    RISK_LINES.forEach((l) => L_.polyline(l.points, { color: '#B3261E', weight: 2, dashArray: '1 6', lineCap: 'round', opacity: 0.8, interactive: false }).addTo(g));
  }, [layers.risk]);

  // Gruppo: zona, membri, guida, punto d'incontro
  useEffect(() => {
    const g = groups.current?.group;
    if (!g) return;
    g.clearLayers();
    if (isSolo || !layers.group || !group) return;
    if (zone) L_.circle([zone.center.lat, zone.center.lng], { radius: zone.radius, color: '#4E6B4A', weight: 1.5, dashArray: '5 4', fillColor: '#4E6B4A', fillOpacity: 0.14, interactive: false }).addTo(g);
    if (group.meeting) {
      L_.marker([group.meeting.lat, group.meeting.lng], { icon: markerIcon('★', `${t.meetingPoint}${group.meeting.time ? ' · ' + group.meeting.time : ''}`, '#4E6B4A', '#fff', '#fff', 22, false), interactive: false }).addTo(g);
    }
    members.forEach((m) => {
      if (m.lat == null || m.lng == null || m.userId === profile.userId) return;
      const isGuide = m.role === 'leader';
      const outside = zone ? distance({ lat: m.lat, lng: m.lng }, zone.center) > zone.radius : false;
      const c = isGuide ? '#2A211B' : outside ? '#B3261E' : '#4E6B4A';
      const label = isGuide ? t.guide : isLeader || outside ? m.name : '';
      if (label) L_.marker([m.lat, m.lng], { icon: markerIcon(initials(m.name), label, c, '#fff', '#fff', isGuide ? 22 : 18, false), interactive: false, zIndexOffset: outside ? 400 : 200 }).addTo(g);
      else L_.circleMarker([m.lat, m.lng], { radius: 4.5, color: '#fff', weight: 1.5, fillColor: c, fillOpacity: 1, interactive: false }).addTo(g);
      if (outside && zone) L_.polyline([[m.lat, m.lng], [zone.center.lat, zone.center.lng]], { color: '#B3261E', weight: 2, dashArray: '4 4', interactive: false }).addTo(g);
    });
    if (out && pos && zone) L_.polyline([[pos.lat, pos.lng], [zone.center.lat, zone.center.lng]], { color: '#B3261E', weight: 2, dashArray: '4 4', interactive: false }).addTo(g);
  }, [isSolo, layers.group, group, zone, members, profile.userId, isLeader, out, pos, t]);

  // La mia posizione
  useEffect(() => {
    const g = groups.current?.me;
    if (!g || !map.current) return;
    g.clearLayers();
    if (!pos) return;
    L_.marker([pos.lat, pos.lng], { icon: meIcon(out ? '#B3261E' : '#2F6FDB'), interactive: false, zIndexOffset: 1000 }).addTo(g);
    if (!centered.current) { centered.current = true; map.current.setView([pos.lat, pos.lng], 15); }
  }, [pos, out]);

  // Se la posizione non arriva, inquadra il programma
  useEffect(() => {
    if (pos || !map.current || !plan) return;
    const pts = plan.stops.map(stopPoint).filter(Boolean) as LatLng[];
    if (pts.length > 1) map.current.fitBounds(L_.latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [40, 60] });
  }, [plan, pos]);

  // Servizi vicini (farmacia, bagni) da OpenStreetMap
  const poiKey = pos ? `${pos.lat.toFixed(3)},${pos.lng.toFixed(3)}` : '';
  useEffect(() => {
    if (!pos || !navigator.onLine) return;
    nearbyServices(pos, 1200).then(setPois).catch(() => {});
  }, [poiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Luogo in cui mi trovo: il luogo noto piu vicino entro 400 m
  const here = useMemo(() => {
    if (!pos) return null;
    let best: { id: string; d: number } | null = null;
    for (const p of Object.values(PLACES)) {
      if (p.kind === 'hotel') continue;
      const d = distance(pos, p);
      if (!best || d < best.d) best = { id: p.id, d };
    }
    return best;
  }, [pos]);
  const herePlace = here && here.d < 400 ? PLACES[here.id] : null;

  const around = useMemo(() => {
    if (!pos) return [];
    const places = Object.values(PLACES).filter((p) => p.kind !== 'hotel' && p.id !== herePlace?.id)
      .map((p) => ({ n: L(p.name, lang), d: distance(pos, p) })).sort((a, b) => a.d - b.d).slice(0, 3);
    const extra = (['pharmacy', 'toilets'] as const).map((k) => pois.find((x) => x.kind === k)).filter(Boolean)
      .map((x) => ({ n: (x!.kind === 'pharmacy' ? L(EXTRA['Farmacia'], lang) : L(EXTRA['Bagni pubblici'], lang)) + (x!.name ? ' · ' + x!.name : ''), d: x!.dist }));
    return [...places, ...extra].sort((a, b) => a.d - b.d);
  }, [pos, pois, lang, herePlace?.id]);

  // Prossimo spostamento
  const steps = plan ? buildSteps(plan, lang, t, profile) : [];
  const nowI = steps.findIndex((s) => s.isNow);
  const next = steps[nowI + 1] ?? (nowI < 0 ? steps[1] : undefined);
  const nextPt = next && plan ? stopPoint(plan.stops[next.i]) : null;

  const story = herePlace?.story ? L(herePlace.story, lang) : '';
  const showStory = !isMember && !!story;
  const storyLabel = isLeader ? t.storyLeader : t.storySolo;
  useEffect(() => { stopSpeaking(); setPlaying(false); setProg(0); }, [herePlace?.id, lang]);

  function togglePlay() {
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    setPlaying(true);
    speak(story, lang, setProg, () => setPlaying(false));
  }

  const chip = (k: keyof Layers, label: string) => (
    <button key={k} className={layers[k] ? 'on' : ''} aria-pressed={layers[k]} onClick={() => setLayers({ ...layers, [k]: !layers[k] })}>{label}</button>
  );

  return (
    <div className="col">
      <div className="map-wrap">
        <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
        <div className="map-chips">
          {chip('route', t.layerRoute)}
          {chip('risk', t.layerRisk)}
          {!isSolo && chip('group', t.layerGroup)}
        </div>
        <button className="map-recenter" aria-label={t.youAreAt} onClick={() => pos && map.current?.setView([pos.lat, pos.lng], 16)}>◎</button>
      </div>
      <div className="map-sheet">
        <div className="grabber" />
        <div className="col gap4">
          <span className="eyebrow">{t.youAreAt}</span>
          <div className="h3" style={{ fontSize: 32 }}>
            {pos ? (herePlace ? L(herePlace.name, lang) : here ? `${fmtDistance(here.d)} · ${L(PLACES[here.id].name, lang)}` : '…') : posError ? t.noGps : t.locating}
          </div>
          {!pos && posError && <span className="small muted">{t.locOff}</span>}
          {inRisk && <div className="badge" style={{ alignSelf: 'flex-start', marginTop: 6, color: 'var(--red)', background: 'var(--red-soft)', borderRadius: 8 }}>{t.riskNear}</div>}
        </div>

        {showStory && (
          <div className="card col gap12">
            <span className="eyebrow" style={{ color: 'var(--terra-dark)' }}>{storyLabel}</span>
            <div style={{ fontSize: 16, lineHeight: 1.5 }}>{story}</div>
            {canSpeak() && (
              <div className="row gap12">
                <button onClick={togglePlay} aria-label={playing ? 'Pausa' : 'Play'} style={{ flex: 'none', width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--terra)', color: '#fff', fontSize: 14, fontWeight: 700 }}>{playing ? '❚❚' : '▶'}</button>
                <div className="grow" style={{ height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: prog * 100 + '%', background: 'var(--terra)' }} /></div>
                <span className="small muted tnum b">{Math.max(1, Math.round(story.split(/\s+/).length / 150 * 60))}″</span>
              </div>
            )}
          </div>
        )}

        {isMember && (
          <div className="note green col gap6" style={{ padding: 16, borderRadius: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{t.guideTells}</span>
            <span>{t.guideTellsD.replace('Marco', group?.leaderName || t.guide)}</span>
          </div>
        )}

        {isMember && out && zone ? (
          <div className="card col gap10">
            <span className="eyebrow">{t.backToGroup}</span>
            <div className="row gap8 wrap"><span className="pill" style={{ background: MODES.walk.soft, color: MODES.walk.color }}>{t.walk} · {walkMinutes(zone.distance ?? 0)} min</span><span style={{ fontSize: 15, fontWeight: 600 }}>{fmtDistance(zone.distance ?? 0)}</span></div>
            <a className="btn sm red" href={mapsDirections(zone.center)} target="_blank" rel="noreferrer">{t.zoneGo}</a>
          </div>
        ) : next ? (
          <div className="card col gap10">
            <span className="eyebrow">{t.nextLeg}</span>
            <div className="row gap8 wrap">{next.legLabel && <span className="pill" style={{ background: next.legSoft, color: next.legColor }}>{next.legLabel}</span>}<span style={{ fontSize: 15, fontWeight: 600 }}>{next.name}</span></div>
            <div className="col gap8" style={{ paddingTop: 4 }}>
              {next.detail.map((d, k) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '42px minmax(0,1fr)', gap: 8, fontSize: 13, lineHeight: 1.4 }}><span className="b tnum">{d.tm}</span><span>{d.x}</span></div>)}
            </div>
            {nextPt && <a className="btn sm outline" href={mapsDirections(nextPt, plan!.stops[next.i].mode === 'walk' ? 'walking' : 'transit')} target="_blank" rel="noreferrer">{fmt(t.routeTo, { place: next.name })}</a>}
          </div>
        ) : null}

        {around.length > 0 && (
          <div className="col" style={{ gap: 2 }}>
            <span className="eyebrow" style={{ paddingBottom: 6 }}>{t.around}</span>
            {around.map((a) => <div key={a.n} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)', fontSize: 15 }}><span className="b">{a.n}</span><span className="muted tnum">{fmtDistance(a.d)}</span></div>)}
          </div>
        )}

        <div className="legend">
          <span><span style={{ width: 18, borderTop: '3px dotted var(--terra)' }} />{t.walk}</span>
          <span><span style={{ width: 18, height: 4, background: 'var(--ink)', borderRadius: 2 }} />Metro</span>
          <span><span style={{ width: 18, height: 4, background: '#8A5E0E', borderRadius: 2 }} />Bus</span>
          <span><span style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(179,38,30,.15)', border: '1.5px dashed var(--red)' }} />{t.layerRisk}</span>
          {!isSolo && <span><span style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(78,107,74,.15)', border: '1.5px dashed var(--green)' }} />{t.layerGroup}</span>}
        </div>
        {isLeader && <button className="btn outline sm" onClick={() => go({ sub: 'editor' })}>{t.editPlan}</button>}
      </div>
    </div>
  );
}
