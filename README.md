# PLC Frontend — Industrial IoT Monitoring Dashboard

A professional-grade real-time machine monitoring dashboard built for industrial PLC (Programmable Logic Controller) environments. It provides live telemetry streaming, multi-site machine management, CAN bus data decoding, and remote machine control through a modern React interface.

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
- [API Integration](#api-integration)
- [WebSocket Protocol](#websocket-protocol)
- [Authentication](#authentication)
- [Deployment](#deployment)

---

## Overview

This frontend application connects to an industrial backend to monitor PLC-controlled machines across multiple factory sites. It displays real-time telemetry from machines over WebSocket, decodes CAN bus protocol data, and allows operators to send start/stop commands remotely.

---

## Features

### Dashboard
- Multi-site machine overview with status cards
- Machine list with search, sort, and status filtering (Operational / Idle / Fault)
- Pagination (10 machines per page)
- Pulsing status badges for at-a-glance machine health
- Auto-refresh every 30 seconds
- Aggregate statistics: Total, Operational, Idle, Fault counts

### Live View (per-machine)
- Real-time WebSocket telemetry streaming
- Remote Start / Stop command controls with optimistic UI updates
- CAN bus telemetry: state, node ID, status word, error codes
- Drive state and operation mode display
- Status flags: operation enabled, fault, warning, remote
- Message counters (RPDO RX, Telemetry TX)
- Device uptime in HH:MM:SS
- Connection status indicator (Live / Connecting / Offline)
- Alert banners for active faults and warnings

### General
- JWT-based authentication with auto-logout on token expiry
- Protected routes (unauthenticated users redirected to login)
- Data export to PDF and Excel
- Toast notifications for user actions
- Fully responsive layout (desktop, tablet, mobile)

---

## Tech Stack

| Category | Library / Tool | Version |
|---|---|---|
| UI Framework | React | 19.0.0 |
| Routing | React Router DOM | 7.8.2 |
| Build Tool | Vite | 6.2.0 |
| HTTP Client | Axios | 1.11.0 |
| WebSocket | Socket.io-client | 4.8.1 |
| CSS Framework | Bootstrap | 5.3.3 |
| Utility CSS | Tailwind CSS | 3.4.17 |
| Charts | Recharts | 3.2.0 |
| Icons | Lucide React + React Icons | 0.477.0 / 5.5.0 |
| Notifications | React Toastify | 11.0.5 |
| PDF Export | jsPDF + jsPDF AutoTable | 3.0.3 / 5.0.7 |
| Excel Export | XLSX | 0.18.5 |
| Screenshot | html2canvas | 1.4.1 |
| Linting | ESLint | 9.21.0 |
| Production Server | Serve | 14.2.4 |

---

## Project Structure

```
plc-frontend/
├── public/                         # Static public assets
├── src/
│   ├── assets/
│   │   └── Intute.png              # Company branding logo
│   ├── components/
│   │   ├── Dashboard.jsx           # Multi-site machine list view
│   │   ├── LiveView.jsx            # Per-machine real-time telemetry view
│   │   ├── LoginModal.jsx          # Authentication page
│   │   ├── Header.jsx              # Global sticky header
│   │   └── FooterFixed.jsx         # Fixed footer with branding
│   ├── context/
│   │   └── AuthContext.jsx         # JWT auth state (React Context + localStorage)
│   ├── hooks/
│   │   ├── useWebSocket.js         # WebSocket lifecycle management hook
│   │   └── useTelemetryHistory.js  # Historical telemetry data fetching hook
│   ├── services/
│   │   ├── api.js                  # Axios instance with JWT interceptors
│   │   ├── machineService.js       # Machine CRUD API calls
│   │   ├── telemetryService.js     # Telemetry history API calls
│   │   ├── alarmService.js         # Alarm management API calls
│   │   └── websocket.js            # Singleton WebSocket service
│   ├── utils/
│   │   └── telemetryDecoder.js     # CAN bus telemetry data decoder
│   ├── App.jsx                     # Root component with route definitions
│   ├── main.jsx                    # React entry point
│   └── index.css                   # Global styles (Tailwind + custom)
├── .env                            # Environment variables (local)
├── index.html                      # HTML shell
├── vite.config.js                  # Vite bundler configuration
├── tailwind.config.js              # Tailwind theme with custom brand colors
├── postcss.config.js               # PostCSS plugins
├── eslint.config.js                # ESLint rules
└── package.json                    # Dependencies and scripts
```

---

## Getting Started

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- A running instance of the PLC backend (provides REST API + WebSocket)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd plc-frontend

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

The app will start at [http://localhost:5173](http://localhost:5173). The dev server proxies `/api` and `/ws` requests to the backend defined in `VITE_API_URL`.

---

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Base URL of the PLC backend REST API | `http://localhost:5000` |
| `VITE_WS_URL` | WebSocket server URL | `ws://localhost:5000` |

For production, set these to your deployed backend URLs.

---

## Available Scripts

```bash
npm run dev       # Start Vite development server (port 5173)
npm run build     # Build production bundle to dist/
npm run preview   # Preview the production build locally
npm run start     # Serve the dist/ folder (used in production deployments)
```

---

## Architecture

### Routing

Routes are defined in [src/App.jsx](src/App.jsx) using React Router v7:

| Path | Component | Access |
|---|---|---|
| `/login` | `LoginModal` | Public |
| `/` | `Dashboard` | Protected |
| `/machine/:machineId` | `LiveView` | Protected |

A `PrivateRoute` wrapper component checks the JWT token from `AuthContext`. Unauthenticated requests are redirected to `/login`.

### State Management

| Layer | Purpose |
|---|---|
| `AuthContext` | Global auth state (token, user, login/logout) |
| `useWebSocket` hook | Real-time telemetry, connection status, decoded CAN data |
| Component `useState` | Local UI state (filters, pagination, form fields) |

### Data Flow

```
Backend REST API  →  Axios (api.js)  →  Service layer  →  Component state
Backend WebSocket →  useWebSocket.js →  LiveView.jsx
```

---

## Pages & Components

### LoginModal ([src/components/LoginModal.jsx](src/components/LoginModal.jsx))

Two-step view: a landing/splash screen transitions into the login form. Features floating label inputs, password visibility toggle, and animated loading state during authentication.

### Dashboard ([src/components/Dashboard.jsx](src/components/Dashboard.jsx))

Displays all factory sites and their machines. Supports:
- Site-level card view with machine counts
- Machine table with column sorting, text search, and status filter
- Auto-refresh every 30 seconds via `setInterval`
- Navigates to `/machine/:machineId` on row click

### LiveView ([src/components/LiveView.jsx](src/components/LiveView.jsx))

Per-machine real-time monitoring page. Consumes the `useWebSocket` hook to receive live telemetry. Provides Start/Stop control buttons that send commands via the REST API and apply optimistic UI updates while the command is in-flight.

### Header ([src/components/Header.jsx](src/components/Header.jsx))

Sticky global header showing:
- Company logo
- On LiveView: machine name, UID, and live connection status badge
- System clock and session date
- Logged-in user name/role and logout button

### FooterFixed ([src/components/FooterFixed.jsx](src/components/FooterFixed.jsx))

Fixed bottom footer with security badge and Intute.ai branding.

---

## API Integration

The Axios client in [src/services/api.js](src/services/api.js) attaches the JWT token automatically to every request and handles 401 responses by clearing auth state and redirecting to login.

### Endpoints

| Category | Method | Path | Description |
|---|---|---|---|
| Auth | POST | `/auth/login` | Login with email and password |
| Dashboard | GET | `/dashboard/sites` | List all sites |
| Dashboard | GET | `/dashboard/sites/{siteId}/overview` | Machines for a site |
| Dashboard | GET | `/dashboard/machine/{machineId}` | Single machine status |
| Machines | GET | `/machines` | List all machines |
| Machines | GET | `/machines/{machineId}` | Machine details |
| Machines | PUT | `/machines/{machineId}/mode` | Update machine mode |
| Commands | POST | `/commands` | Send a control command |
| Commands | GET | `/commands/history/{machineId}` | Command history |
| Telemetry | GET | `/telemetry/{machineId}/latest` | Latest telemetry snapshot |
| Telemetry | GET | `/telemetry/{machineId}/history` | Historical telemetry |
| Alarms | GET | `/alarms/{machineId}` | Get machine alarms |
| Alarms | PUT | `/alarms/{alarmId}/acknowledge` | Acknowledge an alarm |

---

## WebSocket Protocol

Managed by [src/hooks/useWebSocket.js](src/hooks/useWebSocket.js) and [src/services/websocket.js](src/services/websocket.js).

**Connection URL:** `VITE_WS_URL`

**Client → Server messages:**

| Type | Payload | Description |
|---|---|---|
| `subscribe` | `{ machineId }` | Subscribe to a machine's telemetry stream |
| `ping` | — | Heartbeat sent every 30 seconds |

**Server → Client messages:**

| Type | Description |
|---|---|
| `connected` | Connection acknowledged |
| `disconnected` | Connection lost |
| `telemetry` | CAN bus telemetry data for subscribed machine |
| `machine_status` | Updated machine operational status |
| `alarm` | New alarm triggered |
| `alarm_cleared` | Existing alarm cleared |

**Reconnection:** Exponential backoff from 3 seconds up to 30 seconds on disconnect.

---

## Authentication

JWT-based auth managed by [src/context/AuthContext.jsx](src/context/AuthContext.jsx).

1. **Login:** `POST /auth/login` returns `{ token, user }`. Both are saved to `localStorage` under `plc_token` and `plc_user`.
2. **Request attachment:** Every Axios request gets `Authorization: Bearer <token>` via a request interceptor.
3. **Auto-logout:** A response interceptor detects HTTP 401 and clears auth state, then redirects to `/login`.
4. **Manual logout:** The `logout()` function from `useAuth()` clears state, localStorage, and shows a toast notification.

---

## Deployment

### Build

```bash
npm run build
```

Produces a static bundle in `dist/`.

### Serve (Production)

```bash
npm run start
```

Uses the `serve` package to host `dist/` on the port defined by the `$PORT` environment variable (binds to `0.0.0.0` for container environments).

### Environment

Set `VITE_API_URL` and `VITE_WS_URL` to your production backend URLs before building. These values are inlined at build time by Vite.

---

## Brand & Theming

Custom Tailwind colors defined in [tailwind.config.js](tailwind.config.js):

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#1B4F8A` | Primary brand blue |
| `secondary` | `#2E75B6` | Secondary blue |
| `accent` | `#00C2FF` | Accent / highlight |
| `status-running` | — | Operational badge |
| `status-stopped` | — | Idle badge |
| `status-fault` | — | Fault badge |
| `status-offline` | — | Offline badge |

Font: **Inter** (loaded from Google Fonts).

---

## License

Proprietary — Intute.ai. All rights reserved.
