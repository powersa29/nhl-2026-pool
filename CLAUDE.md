@AGENTS.md

# NHL 2026 Playoff Pool — Codebase Guide

## What This App Does

A full-stack fantasy hockey pool for the 2026 NHL playoffs. Participants build a 16-player roster before the playoffs begin; the app fetches live stats from NHL.com and calculates running scores. Includes a leaderboard, playoff bracket view, admin panel, and signup form.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL) · Tailwind CSS v4 · Vercel

---

## Directory Structure

```
app/                   # Next.js App Router pages and API routes
  page.tsx             # Homepage: leaderboard + pool stats (server component)
  layout.tsx           # Root layout: dark theme, Header, metadata
  signup/page.tsx      # Roster builder page
  rounds/page.tsx      # Playoff bracket view
  rules/page.tsx       # Scoring rules explanation
  admin/page.tsx       # Admin panel (password-free, restrict via Vercel)
  participant/[id]/page.tsx  # Individual roster + score breakdown
  api/
    signup/route.ts    # POST: validate + insert participant roster
    scores/route.ts    # GET: all participants with live scores
    export/route.ts    # GET: CSV/JSON export of participants
    refresh/route.ts   # POST: purge Next.js cache to force refresh
    debug/route.ts     # GET: diagnostic state dump
    admin/
      participants/route.ts     # GET: list all participants
      participant/route.ts      # PUT/DELETE: edit or remove one participant
      rounds/route.ts           # PUT: update playoff bracket config
      bulk-tiebreakers/route.ts # POST: import tiebreaker values in bulk
      delete/route.ts           # POST: delete specific participants

components/            # All client components (use 'use client')
  BuilderClient.tsx    # Roster builder form with pick validation
  StandingsClient.tsx  # Leaderboard table with rank movement
  AdminClient.tsx      # Admin UI: edit rosters, manage entries
  RoundsClient.tsx     # Bracket display
  ScoreTicker.tsx      # Animated live-score ticker
  Ticker.tsx           # Generic ticker/carousel base
  Header.tsx           # Top navigation
  Avatar.tsx           # Player/participant avatar
  TeamChip.tsx         # Team badge with team color
  Sparkline.tsx        # Mini rank-movement sparkline chart

lib/
  data.ts              # Static: TEAMS[], PLAYERS[], ROUNDS[] (~36 KB)
  db.ts                # Supabase client + all database query functions
  nhl-api.ts           # NHL.com API: fetch live player stats
  nhl-rounds.ts        # NHL.com API: fetch playoff bracket
  nhl-scores.ts        # Score calculation utilities

public/                # Static assets
supabase-schema.sql    # Postgres schema (run once in Supabase SQL editor)
DEPLOY.md              # Step-by-step Vercel + Supabase deployment guide
```

---

## Environment Variables

Create `.env.local` (never commit it):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_POOL_OPEN=true        # set to "false" to lock new signups
```

Both `NEXT_PUBLIC_SUPABASE_*` vars are safe to expose in the browser; Supabase RLS enforces access control. `NEXT_PUBLIC_POOL_OPEN` is checked in `app/page.tsx` and `app/signup/page.tsx`.

---

## Database Schema

Two tables in Supabase, defined in `supabase-schema.sql`:

**`participants`**
| column | type | notes |
|---|---|---|
| `id` | bigserial PK | auto-increment |
| `name` | text | participant display name |
| `roster` | jsonb | array of `RosterPick` objects |
| `tiebreaker` | integer | predicted total goals |
| `created_at` | timestamptz | signup timestamp |

**`config`**
| column | type | notes |
|---|---|---|
| `key` | text PK | `"rounds"` or `"rankings_snapshot"` |
| `value` | jsonb | bracket data or snapshot array |

RLS policies: public read on both tables; public insert on `participants`; only service role can write `config`.

### Key Types (from `lib/db.ts`)

```ts
type RosterPick = { team: string; playerName: string; pos: Pos }
type Participant = {
  id: number; name: string; roster: RosterPick[];
  tiebreaker: number; created_at: string;
  total?: number; rank?: number;
}
```

---

## Scoring Logic

Defined in `lib/nhl-api.ts` and applied when calculating standings:

- **Skaters:** `Goals + Assists + PPGoals + SHGoals + OTGoals`
- **Goalies:** `Wins×2 − Losses + Shutouts×2 + Goals + Assists`

All stats come from NHL.com's public API (`https://api-web.nhle.com/v1`), season `20252026`.

Name matching uses diacritical normalization (`é→e`, `ü→u`) plus a first-initial + last-name fallback. See `lookupStats()` in `lib/nhl-api.ts`.

---

## Roster Validation Rules

Enforced in both `components/BuilderClient.tsx` (client) and `app/api/signup/route.ts` (server):

- Exactly **16 picks**: 1 Goalie, 6 Defensemen, 9 Forwards
- **One player per team** (all 16 participating teams must be represented)
- Player must exist in `lib/data.ts` `PLAYERS` array
- Player position must match the declared position

---

## Data Flow

```
User → BuilderClient → POST /api/signup → validate → Supabase INSERT
                                                           ↓
Homepage (60s revalidate) → getParticipants() → fetchAllTeamStats() → score calc → StandingsClient
```

Admin routes hit Supabase directly and are not cached.

---

## Development Workflow

```bash
npm run dev    # localhost:3000, hot reload
npm run build  # production build
npm run lint   # ESLint (Next.js + TypeScript preset)
```

There is no test suite. Validate changes by running `npm run build` (catches TypeScript errors and build failures) and `npm run lint`.

### Before Writing Any Code

This project uses **Next.js 16** with React 19 — both have breaking changes relative to older versions. Per `AGENTS.md`:

> Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Key things that differ from older Next.js:
- App Router only (no `pages/` directory)
- Server Components are the default; add `'use client'` only when needed (event handlers, hooks, browser APIs)
- `fetch()` caching behavior has changed — use `export const revalidate = N` at the page level
- Route Handlers use `export async function GET/POST(request)` signatures, not `export default`

---

## Styling Conventions

Tailwind CSS v4 is used via PostCSS (`@tailwindcss/postcss`). Custom design tokens are defined in `app/globals.css`:

- **Fonts:** Bricolage Grotesque (headings), Inter (body), JetBrains Mono (code)
- **Theme tokens:** `--ice` (bg), `--ink` (text), `--red`, `--cyan`, `--yellow`, `--green`, `--muted`
- **Border radii:** 18px (cards), 26px (large cards), 999px (pills)
- **Dark theme default** — set via `data-theme="dark"` on `<html>` in `app/layout.tsx`

Use existing utility classes from `globals.css` before writing new ones. The design system uses semantic color names, not raw Tailwind color scales.

---

## Static Data (`lib/data.ts`)

All 16 playoff teams and their rosters are hardcoded here. This file is ~36 KB. Do not add to it at runtime — it is a build-time constant. If player data needs updating, edit this file directly.

```ts
type Pos = 'G' | 'D' | 'F'
type Player = { name: string; first: string; last: string; team: string; pos: Pos }
type Team   = { abbr: string; name: string; color: string }  // color is hex
```

`ROUNDS[]` in this file contains a hardcoded bracket snapshot used as a fallback; live bracket data comes from the `config` table and `lib/nhl-rounds.ts`.

---

## Admin Panel

`/admin` has no authentication — protect it at the infrastructure level (Vercel password protection or IP allowlist). It can:

- List, edit, and delete participants
- Bulk-import tiebreaker values (paste CSV)
- Update the playoff bracket (`config.rounds`)

---

## NHL.com API Notes

- Base URL: `https://api-web.nhle.com/v1`
- No authentication required
- Used endpoints: team roster stats, playoff bracket
- Season ID format: `20252026`
- Rate limits are not documented; the app fetches all 16 teams in parallel on each homepage load — keep this in mind if adding more fetches

---

## Deployment

See `DEPLOY.md` for full instructions. Summary:

1. Create Supabase project → run `supabase-schema.sql`
2. Push repo to GitHub
3. Import to Vercel → add env vars
4. Done — zero ongoing cost (Vercel free + Supabase free + NHL.com API free)
