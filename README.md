# GPS Noise Challenge

Raw GPS is noisy (4–30 m error). Drawing a line through fixes as they arrive zigzags off the road and spikes at corners.

**Your job:** record a **smooth red line that follows real roads**, live, like Google Maps / Uber.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173` → **Start mock drive** → **Start recording**.

## How smoothing works (one pipeline)

Each GPS fix goes through `src/utils/routeSmoothing.ts`:

1. **Filter** — drop jitter, impossible speed, outliers, backward spikes  
2. **Snap** — OSRM `nearest` → point on the road  
3. **Route** — OSRM `route` from previous snap to this snap → append geometry  

The path only **grows** (never rewritten), so corners stay smooth.

```
noisy GPS → acceptFix? → snapToRoad → routeOnRoad → append to red polyline
```

OSRM calls go through `/osrm` in dev (Vite proxy) to avoid CORS.

## Project layout

```
src/
├── components/
│   ├── MapView.tsx          # map + red line + blue live dot
│   └── RouteRecorder.tsx    # buttons + feeds GPS into recorder
├── hooks/
│   └── useGeolocation.ts    # real browser GPS
├── utils/
│   ├── geo.ts               # distance / bearing helpers
│   ├── mockDrive.ts         # noisy 50 km/h simulator (do not reduce noise)
│   ├── osrm.ts              # snap + route (2 small functions)
│   ├── osrmConfig.ts        # /osrm proxy in dev
│   └── routeSmoothing.ts    # ★ main feature: SmoothPathRecorder
├── App.tsx
├── main.tsx
└── styles.css
```

## Rules

- UI: map + **Start mock drive** + **Start recording** only  
- Do not lower noise in `mockDrive.ts`  
- Real GPS must still work  

Good luck.
