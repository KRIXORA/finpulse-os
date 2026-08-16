# FinPulse-OS

Production-grade personal finance dashboard. Built under the KRIXORA brand.
Runs entirely from static files + Supabase — no server to host or run yourself.

## Structure

```
finpulse-os/
├── index.html              # Dashboard shell (requires login)
├── auth.html                # Login / signup page
├── backend-supabase/
│   └── schema.sql            # Run this once in Supabase's SQL Editor
├── css/
│   ├── reset.css            # Browser normalization
│   ├── tokens.css           # Design tokens: color, type, spacing (single source of truth)
│   ├── layout.css           # Grid/flex page structure, header, sidebar
│   ├── components.css       # Reusable UI: buttons, cards, inputs, badges, modals
│   ├── dashboard.css        # Page-specific: charts, stat cards, gauges
│   └── main.css             # Imports everything, in cascade order
├── js/
│   ├── supabaseClient.js    # Supabase connection (paste your project URL + key here)
│   ├── state.js              # In-memory cache backed by Supabase, CRUD operations
│   ├── icons.js              # Hand-authored SVG icon set (no emoji, no external library)
│   ├── utils.js              # Formatters (currency, date), helpers
│   ├── transactions.js      # DOM rendering for tables/cards/lists
│   ├── charts.js             # Canvas chart rendering (cash flow, budget gauge, donut, ring)
│   └── app.js                 # Entry point: auth guard, wires events, initial data load
└── assets/
    ├── icons/
    ├── images/
    └── fonts/
```

## Setup (all from a phone browser — no terminal needed)

1. **Create a Supabase project** at supabase.com → New Project.
2. **Run the schema**: Project → SQL Editor → New Query → paste `backend-supabase/schema.sql` → Run.
3. **Get your keys**: Project Settings → API → copy "Project URL" and "anon public" key.
4. **Paste them** into `js/supabaseClient.js` (replace the two placeholder strings).
5. **Deploy**: push this folder to a GitHub repo (GitHub mobile app supports file upload/edit), then import that repo into Vercel. Vercel auto-detects it as a static site — no build config needed.
6. Visit your deployed URL → `/auth.html` → sign up → you're in.

## Conventions
- CSS: BEM-lite naming (.card, .card__header, .card--highlighted)
- JS: vanilla ES modules, no framework, no build step
- All colors/spacing/type come from tokens.css variables — never hardcode values in components
- Mobile-first responsive breakpoints: 480px / 768px / 1024px / 1440px
- No emoji anywhere in UI — all icons are hand-authored SVGs in js/icons.js
- Auth + database: Supabase (Postgres + built-in auth + Row Level Security)

## Phases
- [x] Phase 0 — Architecture & setup
- [x] Phase 1 — Design system (tokens.css)
- [x] Phase 2 — Static UI (all pages, HTML + CSS)
- [x] Phase 3 — Core JS logic (state, CRUD, charts)
- [x] Phase 4 — Backend + real auth (Supabase: Postgres, Auth, Row Level Security)
- [ ] Phase 5 — Advanced features (AI insights, analytics)
- [ ] Phase 6 — Testing, security, performance
- [ ] Phase 7 — Deployment
