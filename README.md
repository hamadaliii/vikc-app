# VIKC — Youth Community App

Full-stack Next.js 14 app with Supabase backend and real browser Geolocation check-in.

---

## Quick Start (5 minutes)

### 1. Clone & install
```bash
git clone <your-repo>
cd vikc-app
npm install
```

### 2. Create Supabase project
1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **anon key** (Settings → API)
3. Go to **SQL Editor** → paste and run `supabase/migrations/001_initial_schema.sql`
   - This creates all tables, RLS policies, functions, and seed data

### 3. Set environment variables
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase values
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # From Settings → API → service_role
```

### 4. Run
```bash
npm run dev
# Open http://localhost:3000
```

---

## Architecture

```
src/
├── app/
│   ├── (auth)/          # Login, signup, forgot password
│   ├── (app)/           # Protected user app (home, events, profile...)
│   ├── admin/           # Admin panel
│   └── api/             # API routes (server-side)
│       ├── auth/signup
│       ├── attendance/checkin   ← Core check-in logic
│       ├── attendance/checkout
│       ├── attendance/override  ← Admin manual approval
│       ├── events/
│       ├── rewards/redeem
│       └── leaderboard/
├── components/
│   └── user/CheckinScreen.tsx   ← Geolocation UI component
├── hooks/
│   ├── useGeolocation.ts        ← Browser GPS hook
│   └── useCheckin.ts            ← Full check-in flow hook
├── lib/
│   ├── geolocation.ts           ← Haversine distance, time windows
│   ├── auth-context.tsx         ← Auth provider
│   └── supabase/
│       ├── client.ts            ← Browser client
│       └── server.ts            ← Server + service role client
└── types/index.ts               ← All TypeScript types
```

---

## Geolocation System

**No external API needed.** Uses the browser's native `navigator.geolocation` API.

### How check-in works
1. User opens event → taps "Check In"
2. Browser asks for location permission (one-time prompt)
3. App gets GPS coordinates (`latitude`, `longitude`, `accuracy`)
4. Client calculates distance from venue using **Haversine formula**
5. Sends coordinates to `/api/attendance/checkin`
6. **Server-side** re-validates the distance (client can't be trusted alone)
7. If within geofence → attendance marked as `verified`, points awarded
8. If outside → error with distance shown, suspicious attempt logged

### Geofence radius
Set per event in `geofence_radius_meters` (default: 200m).
GPS accuracy is automatically factored in — if accuracy is ±50m, the effective radius is extended slightly to account for real-world GPS drift.

### Time windows
- `checkin_opens_minutes_before` (default: 60 min before)
- `checkin_closes_minutes_after` (default: 30 min after start)
- Checked server-side — can't be bypassed

### Suspicious attempt detection
The server automatically flags and logs attempts with:
- Distance > 3× the geofence radius
- GPS accuracy > 500m (possible location spoofing)
- 3+ attempts in 10 minutes
- Wrong check-in code entries

---

## Check-in Code (optional)

Events can optionally require a rotating 6-character code shown on a screen at the venue.

The code rotates every 5 minutes via a Supabase Edge Function:
```bash
supabase functions deploy rotate-checkin-codes
```

Set a cron job in Supabase to call it every 5 minutes.

---

## Fraud Prevention

| Attack | Defense |
|--------|---------|
| GPS spoofing | Distance validated server-side + accuracy check |
| Sharing QR/code | Code rotates every 5 minutes |
| Remote check-in | Server Haversine distance check (never trust client) |
| Duplicate check-in | `UNIQUE(event_id, user_id)` constraint in DB |
| Time fraud | Server-side window check using event start time |
| Rapid retries | Rate limiting + suspicious attempt logging |

---

## Database

All tables are in PostgreSQL (Supabase). Key tables:
- `profiles` — extends auth.users with points, XP, level, streak
- `events` — all event data including lat/lon for geofencing
- `attendance` — check-in records with GPS coordinates
- `suspicious_attempts` — flagged check-in attempts for admin review
- `badges`, `user_badges` — badge system with auto-award triggers
- `rewards`, `reward_redemptions` — rewards marketplace
- `points_transactions` — full audit log of all point changes
- `notifications` — per-user notification queue

Row Level Security (RLS) is enabled on all tables.

---

## Roles

| Role | Access |
|------|--------|
| `member` | Browse events, check in, earn points, redeem rewards |
| `staff` | Member access + live event view, manual attendance override |
| `admin` | Staff access + create events, manage users, manage rewards, view suspicious |
| `superadmin` | Full access including platform settings |

---

## Deploying

```bash
# Vercel (recommended)
vercel --prod

# Or any Node.js host
npm run build
npm start
```

Set the same environment variables in your hosting platform.

---

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth (JWT)
- **Realtime**: Supabase Realtime (for live event views)
- **Location**: Browser `navigator.geolocation` API — **no API key**
- **Distance calc**: Haversine formula (pure math, no external service)
