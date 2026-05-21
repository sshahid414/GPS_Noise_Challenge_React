# GPS Noise Challenge

GPS fixes are messy. Draw them as they arrive and the line zigzags through buildings, wobbles at standstill, and spikes at corners. Navigation apps do not do that — they show a **smooth red route on the real road**, updated **while you are still moving**.

This project is a small React app that does exactly one thing: **turn noisy GPS into that kind of line, live.**

---

## Try it in a minute

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5173** in a normal browser tab (Chrome or Edge works best).

1. Allow location if asked — or skip it; mock drive does not need it.
2. Click **Start mock drive** — a simulated car starts at ~50 km/h with realistic GPS noise (4–30 m error).
3. Click **Start recording** — the **red line** is your smoothed trip; the **blue dot** is the raw noisy position.

Within a few seconds you should see why the challenge exists: the blue dot jitters, but the red line should hug the streets. If OSRM is busy, wait a minute and try again.

---

## What you see on the map

| On screen | Meaning |
|-----------|---------|
| **Blue dot** | Latest GPS fix, exactly as received (noisy). |
| **Red line** | What we **record** — filtered, snapped to roads, routed between snaps. |
| **Stats** | Point count and distance along the red line. |

The goal is not to hide noise on the dot. The goal is to **record** a path that looks like Google Maps / Uber, not like a straight line through rooftops.

---

## Workflow (while you drive)

Think of recording as a short assembly line. Every time a new GPS fix arrives (~1 per second in mock mode):

```
  ┌─────────────┐     ┌─────────────┐      ┌─────────────┐     	┌─────────────┐
  │  GPS fix    │ ──▶ │   Filter    │ ──▶ │ Snap to     │ ──▶  │ Route on    │
  │  (noisy)    │     │ bad fixes   │      │ nearest road│     	│ road graph  │
  └─────────────┘     └─────────────┘      └─────────────┘     	└─────────────┘
                                                                      │
                                                                      ▼
                                                            Append to red line
                                                            (never erase tail)
```

**Step 1 — Filter** (`acceptFix` in `routeSmoothing.ts`)

Skip fixes that would ruin the line: standing still jitter, impossible speed, big accuracy spikes, backward jumps.

**Step 2 — Snap** (`snapToRoad` in `osrm.ts`)

Ask OSRM: “where is the nearest point on a drivable road?”

**Step 3 — Route** (`routeOnRoad` in `osrm.ts`)

Ask OSRM: “how do you drive from the **previous** snap to **this** snap?”  
That geometry follows real corners — no diagonal cuts through blocks.

**Step 4 — Append**

Add those points to the red polyline. We only **grow** the path during recording, so corners do not get wiped and redrawn (that was a common source of spikes).

All of that lives in one class: **`SmoothPathRecorder`** in `src/utils/routeSmoothing.ts`.

---

## Workflow (in the codebase)

If you open the repo for the first time, follow the data in this order:

1. **`src/main.tsx`** — boots React.
2. **`src/App.tsx`** — renders the recorder UI.
3. **`src/components/RouteRecorder.tsx`** — map, buttons, wires GPS into the recorder.
4. **`src/hooks/useGeolocation.ts`** — real browser GPS (`watchPosition`).
5. **`src/utils/mockDrive.ts`** — optional fake car + noisy fixes (OSRM roads, do not lower noise constants).
6. **`src/utils/routeSmoothing.ts`** — **main feature**: smooth pipeline.
7. **`src/utils/osrm.ts`** — two API helpers (snap + route).
8. **`src/components/MapView.tsx`** — Leaflet map, red polyline, blue dot.

In dev, OSRM calls go to **`/osrm/...`** (Vite proxy in `vite.config.ts`) so the browser does not hit CORS errors.

---

## Project layout

```
src/
├── components/
│   ├── MapView.tsx           # map + red line + blue dot
│   └── RouteRecorder.tsx     # Start mock drive / Start recording
├── hooks/
│   └── useGeolocation.ts     # real GPS from the browser
├── utils/
│   ├── routeSmoothing.ts     # ★ smooth pipeline (start here)
│   ├── osrm.ts               # snapToRoad + routeOnRoad
│   ├── osrmConfig.ts         # /osrm proxy in dev
│   ├── mockDrive.ts          # noisy simulator
│   └── geo.ts                # distance & bearing helpers
├── App.tsx
├── main.tsx
└── styles.css
```

---

## Challenge rules (what reviewers care about)

- **UI stays minimal** — map, **Start mock drive**, **Start recording** only.
- **Do not cheat** by turning down noise in `mockDrive.ts`.
- **Real GPS must still work** — same pipeline for browser location and mock.
- Smoothing must be **live**, not a post-processing step after you stop.

**Good result:** red line follows the road, no zigzags or backward hooks, grows smoothly like a taxi app.

**Where to improve the line:** `src/utils/routeSmoothing.ts` — filters and when to accept a snap.

---

## Commands

| Command | What it does |
|---------|----------------|
| `npm run dev` | Local app at http://127.0.0.1:5173 |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build locally |

---

## When something looks wrong

- **Red line stops growing** — OSRM demo server may be rate-limited; pause and retry.
- **CORS errors in console** — restart `npm run dev`; calls should go to `/osrm/...`, not directly to `router.project-osrm.org`.
- **Corner still kinky** — usually a noisy fix snapped to the wrong arm of an intersection; tighten filters in `snapFitsPath` / `acceptFix`.

Good luck — and have fun.
