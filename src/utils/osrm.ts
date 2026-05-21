import { OSRM_BASE } from './osrmConfig';

export type LatLng = { lat: number; lng: number };

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Project a noisy GPS point onto the nearest drivable road. */
export async function snapToRoad(
  lat: number,
  lng: number,
): Promise<LatLng | null> {
  const url = `${OSRM_BASE}/nearest/v1/driving/${round(lng)},${round(lat)}?number=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const loc = json?.waypoints?.[0]?.location as [number, number] | undefined;
    return loc ? { lat: loc[1], lng: loc[0] } : null;
  } catch {
    return null;
  }
}

/** Road geometry between two snapped points (smooth corners, no chords). */
export async function routeOnRoad(from: LatLng, to: LatLng): Promise<LatLng[]> {
  const url =
    `${OSRM_BASE}/route/v1/driving/${round(from.lng)},${round(from.lat)};` +
    `${round(to.lng)},${round(to.lat)}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [to];
    const coords: [number, number][] =
      (await res.json())?.routes?.[0]?.geometry?.coordinates ?? [];
    if (coords.length < 2) return [to];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return [to];
  }
}
