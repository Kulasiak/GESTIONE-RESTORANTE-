export type LatLng = { lat: number; lng: number };

/** Distanza in metri (formula dell'emisenoverso). */
export function distance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distanza in metri da un punto a una spezzata (approssimazione piana, ok in citta). */
export function distanceToPolyline(p: LatLng, line: [number, number][]): number {
  const kx = 111320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110540;
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][1] - p.lng) * kx, ay = (line[i][0] - p.lat) * ky;
    const bx = (line[i + 1][1] - p.lng) * kx, by = (line[i + 1][0] - p.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export function fmtDistance(m: number): string {
  return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
}

/** Minuti a piedi (circa 4,5 km/h, con fattore 1,3 per le strade reali). */
export const walkMinutes = (m: number) => Math.max(1, Math.round((m * 1.3) / 75));

export const mapsDirections = (to: LatLng, mode: 'walking' | 'transit' = 'walking') =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=${mode}`;
export const mapsLink = (p: LatLng) => `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
