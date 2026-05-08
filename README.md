# SmartDTC — Frontend

Next.js 14 web application for the SmartDTC AI-Powered Bus Scheduling & Tracking System.  
Provides a public passenger portal (route search, live tracking) and a secure admin/dispatcher dashboard with AI scheduling, demand forecasting, fleet management, and real-time alerts.

---

## Tech Stack

| Category        | Library / Tool                                  |
|-----------------|-------------------------------------------------|
| Framework       | Next.js 14 (App Router)                         |
| Language        | TypeScript                                      |
| Styling         | Tailwind CSS (custom `dtc-blue`, `dtc-orange`)  |
| State           | Zustand (persisted to localStorage)             |
| HTTP Client     | Axios (JWT interceptors + auto-refresh)         |
| Real-time       | Socket.io-client                                |
| Maps            | Leaflet + React-Leaflet + Leaflet.heat          |
| Charts          | Recharts                                        |
| UI Primitives   | Radix UI                                        |
| Notifications   | react-hot-toast                                 |
| Icons           | Lucide React                                    |

---

## Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org/)
- **npm 10+** (bundled with Node 20)
- A running **SmartDTC backend** (see `backend/README.md`)

---

## Local Development Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your backend URLs:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
# Base URL of the backend server (no trailing slash, no /api/v1)
NEXT_PUBLIC_API_URL=http://localhost:5000

# Socket.io server URL (same as backend)
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

> **Important:** `NEXT_PUBLIC_API_URL` must be the server root only (e.g., `http://localhost:5000`).  
> The API client automatically appends `/api/v1` to every request.

### 3. Start the development server

```bash
npm run dev
```

The app opens at **http://localhost:3000**.

### 4. Build for production

```bash
npm run build
npm start        # runs the production server on port 3000
```

---

## Environment Variables Reference

| Variable                   | Required | Description                              | Example                        |
|----------------------------|----------|------------------------------------------|--------------------------------|
| `NEXT_PUBLIC_API_URL`      | ✅       | Backend server base URL (no `/api/v1`)   | `https://smartdtc.onrender.com`|
| `NEXT_PUBLIC_SOCKET_URL`   | ✅       | Socket.io server URL (same as backend)   | `https://smartdtc.onrender.com`|

Both variables are prefixed with `NEXT_PUBLIC_` so they are exposed to the browser bundle.

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── page.tsx                # Public homepage
│   │   ├── layout.tsx              # Root layout (Inter font + Toaster)
│   │   ├── not-found.tsx           # 404 page
│   │   ├── login/page.tsx          # Sign-in page
│   │   ├── register/page.tsx       # Passenger self-registration
│   │   ├── search/page.tsx         # Public route search
│   │   ├── track/page.tsx          # Public live bus tracker
│   │   └── admin/                  # Protected admin area
│   │       ├── layout.tsx          # Auth guard → redirects to /login
│   │       ├── page.tsx            # Dashboard (KPIs + charts)
│   │       ├── buses/page.tsx      # Fleet management (CRUD)
│   │       ├── routes/page.tsx     # Route management (CRUD)
│   │       ├── drivers/page.tsx    # Driver management + bus assignment
│   │       ├── schedule/page.tsx   # Schedule management + AI generation
│   │       ├── tracking/page.tsx   # Live map (admin view + heatmap)
│   │       ├── demand/page.tsx     # AI demand prediction + 24h curve
│   │       ├── alerts/page.tsx     # Real-time alerts (resolve / delete)
│   │       └── reports/page.tsx    # Analytics & PDF/Excel export
│   │
│   ├── components/
│   │   ├── admin/
│   │   │   └── Sidebar.tsx         # Admin navigation sidebar
│   │   ├── map/
│   │   │   ├── LiveMap.tsx         # Leaflet map with live bus markers + heatmap
│   │   │   ├── RouteMap.tsx        # Route-specific map with stops + polyline
│   │   │   └── HeatmapLayer.tsx    # Standalone heatmap layer component
│   │   └── ui/
│   │       └── Skeleton.tsx        # Loading skeleton components
│   │
│   ├── lib/
│   │   ├── api.ts                  # Axios instance + JWT interceptors
│   │   ├── socket.ts               # Socket.io singleton client
│   │   └── utils.ts                # cn(), formatDate(), timeAgo(), crowdColor()
│   │
│   ├── store/
│   │   └── authStore.ts            # Zustand auth store (persisted)
│   │
│   └── types/
│       └── index.ts                # Shared TypeScript interfaces
│
├── .env.example                    # Environment variable template
├── next.config.js                  # Next.js config (image domains, rewrites)
├── tailwind.config.js              # Tailwind config (custom colors)
├── tsconfig.json
└── Dockerfile                      # Docker build file
```

---

## Page Overview

### Public Pages (no login required)

| Route      | Page               | Description                                              |
|------------|--------------------|----------------------------------------------------------|
| `/`        | Homepage           | Hero section + feature highlights; links to `/track` and `/admin` |
| `/login`   | Sign In            | Email/password auth; redirects to `/admin` on success    |
| `/register`| Create Account     | Passenger self-registration (role: `passenger`)          |
| `/search`  | Route Search       | Search DTC routes by name, number, or stops              |
| `/track`   | Live Tracker       | Public live bus map with real-time Socket.io updates     |

### Admin Pages (requires `admin` or `dispatcher` role)

| Route               | Page                | Description                                              |
|---------------------|---------------------|----------------------------------------------------------|
| `/admin`            | Dashboard           | KPIs, fleet utilization, active alerts, socket updates   |
| `/admin/buses`      | Fleet Management    | Add / edit / delete buses; status management             |
| `/admin/routes`     | Route Management    | Add / edit / delete routes; searchable list              |
| `/admin/drivers`    | Driver Management   | Add drivers; assign buses; view status                   |
| `/admin/schedule`   | Schedule            | View/create schedules; AI batch generation + apply       |
| `/admin/tracking`   | Live Map            | Real-time bus positions + demand heatmap overlay         |
| `/admin/demand`     | Demand AI           | LSTM demand prediction; 24h curve; history table         |
| `/admin/alerts`     | Alerts              | Real-time alerts; resolve/delete; socket-driven          |
| `/admin/reports`    | Reports & Analytics | KPIs + charts + export to PDF / Excel                    |

---

## Authentication Flow

```
User visits /admin
    │
    ▼
admin/layout.tsx → fetchMe() called
    │
    ├── 200 OK (admin/dispatcher) ──→ renders page
    │
    └── 401 / wrong role ──────────→ redirect to /login

/login page
    │
    ▼
useAuthStore.login(email, password)
    │
    ├── POST /api/v1/auth/login
    │   ← { accessToken, user }
    │
    ├── Stores accessToken in localStorage
    ├── Stores user in Zustand (persisted)
    │
    └── redirect to /admin

Every API request (api.ts interceptor):
    → Attaches: Authorization: Bearer <accessToken>

On 401 response:
    → Calls POST /api/v1/auth/refresh-token
    ├── Success → retries original request with new token
    └── Failure → clears auth state → redirect to /login
```

---

## Real-time (Socket.io)

The frontend connects to the backend Socket.io server using a lazy singleton (`src/lib/socket.ts`).

```typescript
import { connectSocket } from '@/lib/socket';

const socket = connectSocket(); // connects once, reuses existing connection

socket.on('bus:location_update', (pos: BusPosition) => { /* update map */ });
socket.on('admin:new_alert',     (alert: Alert)       => { /* add to list */ });
socket.on('admin:alert_resolved',(data)               => { /* remove from list */ });
```

The socket auto-disconnects when the component unmounts:

```typescript
return () => socket.off('bus:location_update');
```

---

## Maps (Leaflet)

Map components are dynamically imported to avoid SSR issues:

```tsx
const LiveMap = dynamic(() => import('@/components/map/LiveMap'), { ssr: false });
```

**`LiveMap`** — shows live bus positions as colored dots (blue = on time, red = delayed).  
**`RouteMap`** — shows all stops for a specific route with a polyline connecting them.  
**Heatmap** — uses `Leaflet.heat` (loaded from CDN on demand) to visualize demand intensity.

---

## API Client (`src/lib/api.ts`)

All backend requests go through the shared Axios instance:

```typescript
import api from '@/lib/api';

// GET with query params
const { data } = await api.get('/routes?limit=20&search=ring');

// POST with body
const { data } = await api.post('/demand/predict', { route_id, date, hour, weather });

// File download
const res = await api.get('/reports/export/pdf?type=daily', { responseType: 'blob' });
```

**Base URL:** `NEXT_PUBLIC_API_URL` + `/api/v1`  
**Auth:** Bearer token injected automatically by request interceptor  
**401 handling:** Auto-refresh + retry (response interceptor)

---

## Custom Tailwind Colors

Defined in `tailwind.config.js`:

| Class            | Hex       | Usage                        |
|------------------|-----------|------------------------------|
| `dtc-blue`       | `#1a56db` | Primary brand color          |
| `dtc-orange`     | `#ff6b00` | Accent / CTAs                |
| `dtc-green`      | `#16a34a` | Success / active status      |
| `dtc-red`        | `#dc2626` | Error / critical alerts      |

---

## Docker

Build and run the frontend container:

```bash
# Build
docker build -t smartdtc-frontend .

# Run (point to deployed backend)
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://smartdtc.onrender.com \
  -e NEXT_PUBLIC_SOCKET_URL=https://smartdtc.onrender.com \
  smartdtc-frontend
```

---

## Deployment — Vercel (Recommended, Free)

Vercel is the easiest and fastest way to deploy Next.js apps — zero configuration needed.

### Step 1 — Push to GitHub

Make sure your frontend code is in a GitHub repository.

### Step 2 — Import on Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Click **Import** next to your GitHub repo
3. Set the **Root Directory** to `frontend`
4. Framework Preset: **Next.js** (auto-detected)
5. Click **Deploy**

### Step 3 — Add environment variables

In the Vercel dashboard → **Project Settings** → **Environment Variables**, add:

| Name                       | Value                                            |
|----------------------------|--------------------------------------------------|
| `NEXT_PUBLIC_API_URL`      | `https://your-backend.onrender.com`              |
| `NEXT_PUBLIC_SOCKET_URL`   | `https://your-backend.onrender.com`              |

> Replace `your-backend.onrender.com` with your actual backend URL from Render/Railway.

### Step 4 — Redeploy

After adding env vars, click **Redeploy** in the Vercel dashboard. Your app will be live at `https://your-project.vercel.app`.

---

## Deployment — Netlify (Alternative, Free)

1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Select your repo; set **Base directory** to `frontend`
3. Build command: `npm run build`
4. Publish directory: `.next`
5. Add the same environment variables under **Site Settings** → **Environment Variables**
6. Install the [Netlify Next.js plugin](https://github.com/netlify/netlify-plugin-nextjs) for full compatibility

---

## Common Issues

### `Error: NEXT_PUBLIC_API_URL is not set`
Create `.env.local` from `.env.example` and fill in the backend URL.

### Map is blank / Leaflet CSS not loading
Map components use `dynamic(() => import(...), { ssr: false })`. If the map still doesn't render, ensure `leaflet/dist/leaflet.css` is imported inside the component (already done in `LiveMap.tsx` and `RouteMap.tsx`).

### Socket not connecting
Ensure the backend server is running and `NEXT_PUBLIC_SOCKET_URL` matches the backend host exactly (no trailing slash). Also check that the backend has CORS configured to allow your frontend origin.

### 401 on every request (infinite redirect loop)
This means the backend is not setting the `refreshToken` HttpOnly cookie correctly. Ensure `withCredentials: true` is set in the Axios instance (already configured) **and** the backend has `credentials: true` in its CORS config.

### Build fails with `Module not found: leaflet`
Run `npm install` — Leaflet is a required dependency listed in `package.json`.

---

## Scripts

| Command         | Description                                    |
|-----------------|------------------------------------------------|
| `npm run dev`   | Start development server on http://localhost:3000 |
| `npm run build` | Create optimised production build               |
| `npm start`     | Start production server (requires `build` first)|
| `npm run lint`  | Run ESLint                                      |

---

## Related Services

| Service      | README                   | Default Port |
|--------------|--------------------------|--------------|
| Backend API  | `backend/README.md`      | 5000         |
| AI Service   | `ai-service/README.md`   | 8000         |
