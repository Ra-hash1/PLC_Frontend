# PLC Frontend — Industrial IoT Monitoring Dashboard

React + Vite web dashboard for real-time PLC machine monitoring, remote control, and telemetry export. Communicates with the backend over WebSocket (live telemetry) and REST (commands, history, CSV export).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Architecture](#architecture)
- [Pages & Components](#pages--components)
- [WebSocket Protocol](#websocket-protocol)
- [API Integration](#api-integration)
- [CSV Export](#csv-export)
- [Telemetry Decoder](#telemetry-decoder)
- [Deployment](#deployment)

---

## Overview

Single-page application connecting to the PLC backend to monitor servo-driven machines across factory sites. Renders live telemetry streamed via WebSocket, decodes CAN bus / CiA 402 data, surfaces per-drive fault diagnostics, and exports full telemetry history to CSV.

---

## Features

### Dashboard
- Multi-site machine overview with status cards
- Machine list with search, sort, and status filtering
- Aggregate statistics: Total / Operational / Idle / Fault counts
- Auto-refresh every 30 seconds

### Live View (per-machine)
- Real-time WebSocket telemetry with automatic reconnect
- Machine status badge: RUNNING / STOPPED / POWER OFF
- Remote Start / Stop commands with optimistic UI feedback
- Active fault banners (only when `errorCode ≠ 0` — no false positives)
- **Drive Selection** — up to 16 servo drives, fault-priority selection
- **DriveSummaryPanel** — per-drive status word bits, axis state flags (RDY/RUN/FLT/STP/STND/DSB/HOM/FRESH), torque, load % bar, motion mode pills
- **CANopen Network panel** — per-node health grid (NMT state, error, load, torque, counters)
- PLC State Flags grid (7 boolean flags from machine_state)
- Message counters (RPDO RX, Telemetry TX)
- Session Runtime clock and Production counters (pouches, rate ppm)
- Timestamp displayed as `30-May-2026 12:56:55 IST`

### CSV Export
- IST date/time pickers (From / To)
- Progress bar with row count and ETA
- Cursor-based pagination (500 rows/batch) — safe against concurrent inserts
- Dynamic columns: scalar fields + all servo fields (30 per drive) + all CANopen node fields (16 per node)
- `raw_payload` excluded from history queries — prevents Railway 502 timeouts

---

## Tech Stack

| Category | Library | Version |
|---|---|---|
| UI Framework | React | 19 |
| Routing | React Router DOM | 7 |
| Build Tool | Vite | 6 |
| HTTP Client | Axios | 1 |
| WebSocket | Native browser WebSocket | — |
| Notifications | React Toastify | 11 |
| Production Server | serve | 14 |
| Linting | ESLint | 9 |

> No Bootstrap, no socket.io, no xlsx/jspdf. CSV export uses native `Blob` API. Styles use custom CSS variables.

---

## Project Structure

```
plc-frontend/
├── public/
├── src/
│   ├── assets/
│   │   └── Intute.png              Company logo
│   ├── components/
│   │   ├── Dashboard.jsx           Multi-site machine list
│   │   ├── LiveView.jsx            Per-machine real-time view (~2500 lines)
│   │   ├── LoginModal.jsx          Auth page
│   │   ├── Header.jsx              Sticky global header
│   │   └── FooterFixed.jsx         Fixed bottom footer
│   ├── context/
│   │   └── AuthContext.jsx         JWT auth state
│   ├── hooks/
│   │   └── useWebSocket.js         WebSocket lifecycle, decoding, plcState
│   ├── services/
│   │   ├── api.js                  Axios instance with JWT interceptors
│   │   ├── machineService.js       Machine CRUD API calls
│   │   └── websocket.js            Singleton WS service with reconnect
│   ├── utils/
│   │   └── telemetryDecoder.js     CiA 402 decoder, VEICHI error codes
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── nixpacks.toml                   Railway build: runs `npm run build` before `npm start`
├── vite.config.js
├── eslint.config.js
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- A running PLC backend

### Install & Run

```bash
npm install

# Development (proxies /api and /ws to backend)
npm run dev     # http://localhost:5173

# Production preview
npm run build
npm run preview
```

---

## Environment Variables

```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
VITE_MACHINE_ID=machine_01        # Default machine (optional)
```

Set to production backend URLs before `npm run build`. Values are inlined at build time.

---

## Available Scripts

```bash
npm run dev       # Vite dev server (HMR, port 5173)
npm run build     # Production bundle → dist/
npm run preview   # Serve dist/ locally
npm start         # serve dist/ (used by Railway)
```

---

## Architecture

### Routing

| Path | Component | Access |
|---|---|---|
| `/login` | `LoginModal` | Public |
| `/` | `Dashboard` | Protected |
| `/machine/:machineId` | `LiveView` | Protected |

### Data Flow

```
Backend REST API  →  Axios (api.js)  →  machineService / telemetryService  →  Component state
Backend WebSocket →  websocket.js   →  useWebSocket hook  →  LiveView.jsx
                                          ↓
                                    decodeTelemetry()
                                          ↓
                              decoded servos / canopenNodes
```

### State Layers

| Layer | What it holds |
|---|---|
| `AuthContext` | JWT token, user, login/logout |
| `useWebSocket` | `telemetry`, `decoded`, `servos`, `canopenNodes`, `plcState`, `connected` |
| Component `useState` | Local UI (drive selection, CSV state, commands) |

---

## Pages & Components

### LiveView

The main component (`~2500 lines`). Key sections rendered in order:

1. **Hero Status Card** — machine status badge, online/alarm badges, CAN state strip
2. **Remote Control** — Start / Stop buttons; Start shows readiness modal if blocked
3. **Runtime Clock** — live session timer
4. **Production Counter** — total pouches (K), total runtime, reset button
5. **Batch Cutter** — OFF / ON toggle
6. **Active Drive Alarms** — conditional; only shown when `errorCode ≠ 0`
7. **Drive Selection** — chip row with fault-priority coloring
8. **DriveSummaryPanel** — status word bit grid, axis flags, load bar, torque
9. **CANopen Network** — auto-fit node cards (NMT state, error, load)
10. **CAN Bus Telemetry** — scalar stat cards
11. **Drive Diagnostics** — full diag card with all per-drive fields
12. **PLC State Flags** — 7 boolean cards from `machine_status` WS channel
13. **Message Counters** — RPDO RX / Telemetry TX progress bars
14. **CSV Export** — date range pickers, progress bar, ETA display

### useWebSocket

Manages the WS connection lifecycle. Returns:

```js
{
  telemetry,      // raw merged frame object
  decoded,        // output of decodeTelemetry()
  connected,      // boolean
  servos,         // decoded?.servos ?? []
  canopenNodes,   // decoded?.canopenNodes ?? []
  plcState,       // { readyToRun, actuallyRunning, faulted, ... } from machine_status
  lastAlarm,
  dbStatus,
  lastDataAt,
}
```

---

## WebSocket Protocol

**Connect URL:** `VITE_WS_URL`

**Subscribe (client → server):**
```json
{ "action": "subscribe", "siteId": "site_01", "lineId": "line_01", "machineId": "machine_01" }
```

**Server → client message types:**

| Type | Payload | Description |
|---|---|---|
| `connected` | — | Subscription acknowledged |
| `disconnected` | — | Connection dropped |
| `snapshot` | `{ data: {...} }` | Initial DB row on connect — not treated as live data |
| `telemetry` | `{ data: { ...mapRow fields } }` | Live telemetry frame |
| `machine_status` | `{ status, machineId, plcFeedbackFresh, machineActuallyRunning, ... }` | DB status change |
| `alarm` | `{ data: {...} }` | New alarm |
| `alarm_cleared` | — | Alarm resolved |

Reconnect: exponential backoff 3 s → 30 s.

---

## API Integration

All requests go through `src/services/api.js` which attaches `Authorization: Bearer <token>` and handles 401 → auto-logout.

### Telemetry endpoints used by LiveView

| Method | Path | Description |
|---|---|---|
| GET | `/telemetry/:machineId/latest` | Latest snapshot for live display |
| GET | `/telemetry/:machineId/count?from&to` | Row count for CSV progress bar |
| GET | `/telemetry/:machineId/array-widths?from&to` | Max servo + node array lengths for dynamic CSV columns |
| GET | `/telemetry/:machineId/history?from&to&limit&after_id` | Paginated rows for CSV export |

---

## CSV Export

Export flow (`handleExportCsv` in LiveView.jsx):

1. **Parallel pre-flight:** `/count` + `/array-widths` — determines total rows and how many servo/node columns to generate
2. **Build column list** dynamically: 23 scalar columns + (maxServos × 30) servo columns + (maxNodes × 16) CANopen node columns
3. **Cursor loop** — fetches 500 rows/batch using `after_id` cursor (`WHERE id > $N ORDER BY id ASC`). Starting at `id = 0` ensures all batches use ASC order — no DESC/ASC switch, no duplicate rows.
4. **Retry** — each batch retries once on 5xx/network error after 1.5 s
5. **Download** — builds CSV as a `Blob`, triggers browser download via `URL.createObjectURL`

**Why 500 rows/batch:** `raw_payload` is excluded server-side, making each row ~6 KB. 500 × 6 KB = 3 MB/batch — well within Railway's request timeout.

**Timestamp format:** `30-May-2026 12:56:55 IST` — unambiguous, no millisecond noise.

---

## Telemetry Decoder

`src/utils/telemetryDecoder.js` mirrors the mobile app's `plcTelemetry.ts`.

Key exports:

| Export | Description |
|---|---|
| `decodeTelemetry(data)` | Full decoder — returns decoded telemetry with `servos[]`, `canopenNodes[]`, aggregated flags |
| `decodeServo(servo)` | Per-drive decoder — 30 fields including `faultActiveRaw`, `loadPercent`, `torqueActual`, motion flags |
| `decodeCANopenNode(node)` | Per-node decoder — 16 fields from Lambda schema |
| `decodeStatusWordText(sw)` | CiA 402 status word → human label |
| `decodeModeDisplayText(mode)` | CiA 402 mode → label (Profile Position, CSV, CST…) |
| `decodeErrorCode(code)` | VEICHI 3-digit hex error code → description |
| `STATUS_WORD_BITS` | Full 16-bit status word bit definitions for the bit-grid UI |

**Important:** `faultActive` maps to `servo.faultActiveRaw ?? servo.faultActive`. The Lambda sends `faultActiveRaw` (raw CiA 402 FAULT bit); `faultActive` is the legacy alias.

---

## Deployment

### Railway

`nixpacks.toml` handles build + serve:

```toml
[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"    # serve -s dist
```

Set `VITE_API_URL` and `VITE_WS_URL` in Railway environment variables before deploying. Vite inlines these at build time.

### Manual

```bash
npm run build
PORT=3001 npm start
```

---

## License

Proprietary — Intute.ai. All rights reserved.
