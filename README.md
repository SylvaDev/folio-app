# Folio

Your reading life, finally organized. A TBR-first book tracker built as a modern alternative to Goodreads.

> Built by [Exovara Labs](https://exovaralabs.com).

## Stack

| Layer | Tech |
|---|---|
| Web | Next.js 15 App Router, React 19, Tailwind, Radix UI |
| Auth + DB | Supabase (Postgres + RLS) |
| Mobile | Expo + React Native (in progress) |
| AI | Anthropic Claude (Pro feature: "what should I read next") |
| Book catalog | Open Library (primary) + Google Books (fallback) |
| Analytics + flags | PostHog |
| Hosting | Vercel |

## Features

- Library with TBR / Reading / Read / DNF / Paused shelves
- Smart TBR queue with mood matching and AI recommendations (Pro)
- Reading session logging with auto-finish + pace tracking
- Series detection across a curated map of popular series
- Reading analytics: streaks, monthly pace, ratings, genres
- Goodreads import with ISBN-first matching and Google Books fallback
- Public profiles (`foliotbr.app/u/your-name`) with privacy controls
- Social feed: follow, like, comment, activity stream
- Per-user notifications with deep-links
- PWA-installable on mobile + desktop

## Local development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Fill in your Supabase + Anthropic + PostHog keys
pnpm --filter @folio/web dev
```

App runs at [http://localhost:3001](http://localhost:3001).

## Project layout

```
folio-app/
├── apps/
│   ├── web/          Next.js web app
│   └── mobile/       Expo React Native (work in progress)
├── packages/
│   └── shared/       Shared types, API clients, utils
├── supabase/
│   └── migrations/   Versioned database migrations (apply in order)
└── test-data/        Sample Goodreads CSV for local testing
```

## Documentation

- **[DESIGN.md](./DESIGN.md)** — Visual + motion standards
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Vercel + Supabase setup, migration workflow
- **[SECURITY.md](./SECURITY.md)** — Security model + how to report vulnerabilities

## License

Source-available for transparency. We're working out a sustainable license model. Contributions welcome via PR — please open an issue first to discuss anything substantial.
