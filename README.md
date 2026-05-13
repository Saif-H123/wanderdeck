# wanderdeck

Describe a trip in plain English. wanderdeck plans the route, the stops, and a deck of hidden activity cards. At each stop you pick up a card, see what it asks for, snap a photo — AI scores it.

## The idea

Two layers:

1. **Route layer** — an AI-generated itinerary from your description (origin → destination, with stops that match your vibe).
2. **Game layer** — each stop has hidden activity cards. You don't know what's on them until you flip. Submit a photo that matches the card's criteria and earn points.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Google Maps (Directions for routing, JS API for the map)
- Claude (vision scoring + structured itinerary reasoning) + Gemini (cheap first-pass image classification)
- Supabase (auth + Postgres + storage for photo uploads)

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in keys
pnpm dev
```

Required env keys (see `.env.example`):

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `GOOGLE_MAPS_SERVER_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`

## Layout

```
src/
  app/
    page.tsx              landing
    plan/page.tsx         trip-description form
    trip/[id]/page.tsx    map + card deck for a generated trip
    api/
      plan/route.ts       POST: prompt + origin/destination -> itinerary
      score-photo/route.ts  POST: image + card -> score
  lib/
    ai/claude.ts          itinerary + photo scoring
    ai/gemini.ts          first-pass image classification
    db/supabase.ts        client/server Supabase clients
    types.ts              Trip / TripStop / ActivityCard / PhotoScore
```

## Status

Scaffold only — UI stubs, AI client wiring, route handlers. Next up: real schema, map view, card-reveal mechanic, photo upload flow.
