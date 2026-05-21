import type { GeoPosition } from '../hooks/useGeolocation';
import type { RoutePoint } from '../types';
import { bearingDeg, haversineMeters } from './geo';
import { routeOnRoad, snapToRoad, type LatLng } from './osrm';

const MIN_MOVE_M = 6;
const MAX_SPEED_MPS = 25;

type Fix = RoutePoint & { speed?: number | null; heading?: number | null };

function toFix(raw: GeoPosition): Fix {
  return {
    lat: raw.lat,
    lng: raw.lng,
    timestamp: raw.timestamp,
    accuracy: raw.accuracy,
    speed: raw.speed,
    heading: raw.heading,
  };
}

function bearingDiff(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > 180) d = 360 - d;
  return d;
}

/** Drop jitter, outliers, and backward GPS jumps. */
function acceptFix(
  sample: Fix,
  lastRaw: Fix | null,
  path: RoutePoint[],
): boolean {
  if (!lastRaw) return true;

  const dist = haversineMeters(lastRaw, sample);
  const dt = Math.max((sample.timestamp - lastRaw.timestamp) / 1000, 0.35);

  if (dist < MIN_MOVE_M) return false;
  if (dist / dt > MAX_SPEED_MPS) return false;
  if ((sample.accuracy ?? 10) >= 28 && dist < 20) return false;

  if (path.length >= 2) {
    const a = path[path.length - 2];
    const b = path[path.length - 1];
    const turn = bearingDiff(bearingDeg(a, b), bearingDeg(b, sample));
    if (turn > 150 && dist < 25) return false;
  }

  return true;
}

/** Avoid corner spikes: no backward folds, no early turn on noisy short hops. */
function snapFitsPath(
  path: RoutePoint[],
  lastSnapped: LatLng,
  snapped: LatLng,
  fix: Fix,
): boolean {
  if (path.length < 2) return true;

  const a = path[path.length - 2];
  const b = path[path.length - 1];
  const pathBearing = bearingDeg(a, b);
  const toSnap = bearingDeg(lastSnapped, snapped);
  const turn = bearingDiff(pathBearing, toSnap);
  const dist = haversineMeters(lastSnapped, snapped);

  if (turn > 150 && dist < 40) return false;

  if (turn > 50 && turn < 130 && dist < 18) return false;

  if (
    fix.heading != null &&
    (fix.speed ?? 0) > 1 &&
    dist < 45
  ) {
    const moveBearing = bearingDeg(lastSnapped, snapped);
    if (bearingDiff(fix.heading, moveBearing) > 65) return false;
  }

  return true;
}

/**
 * Live smooth pipeline (all logic in this file):
 *   GPS → filter → snap to road → route along road → append
 */
export class SmoothPathRecorder {
  private path: RoutePoint[] = [];
  private lastRaw: Fix | null = null;
  private lastSnapped: LatLng | null = null;
  private busy = false;
  private pending: Fix | null = null;
  private generation = 0;

  constructor(private readonly onUpdate: (path: RoutePoint[]) => void) {}

  reset(): void {
    this.path = [];
    this.lastRaw = null;
    this.lastSnapped = null;
    this.pending = null;
    this.generation += 1;
    this.onUpdate([]);
  }

  destroy(): void {
    this.generation += 1;
    this.pending = null;
  }

  ingest(raw: GeoPosition): void {
    const fix = toFix(raw);
    if (!acceptFix(fix, this.lastRaw, this.path)) return;

    this.lastRaw = fix;
    this.pending = fix;
    void this.drain();
  }

  flush(): Promise<void> {
    return this.drain();
  }

  private async drain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const gen = this.generation;

    while (this.pending && gen === this.generation) {
      const fix = this.pending;
      this.pending = null;
      await this.appendOne(fix, gen);
    }

    this.busy = false;
  }

  private async appendOne(fix: Fix, gen: number): Promise<void> {
    if (gen !== this.generation) return;

    const snapped = await snapToRoad(fix.lat, fix.lng);
    if (!snapped || gen !== this.generation) return;

    if (!this.lastSnapped) {
      this.lastSnapped = snapped;
      this.path = [{ ...snapped, timestamp: fix.timestamp, accuracy: fix.accuracy }];
      this.onUpdate([...this.path]);
      return;
    }

    if (haversineMeters(this.lastSnapped, snapped) < MIN_MOVE_M) return;
    if (!snapFitsPath(this.path, this.lastSnapped, snapped, fix)) return;

    const geometry = await routeOnRoad(this.lastSnapped, snapped);
    if (gen !== this.generation) return;

    const segment = geometry.slice(1).map((p) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: fix.timestamp,
      accuracy: fix.accuracy,
    }));

    if (segment.length === 0) return;

    this.path = [...this.path, ...segment];
    this.lastSnapped = snapped;
    this.onUpdate([...this.path]);
  }
}
