-- wanderdeck initial schema
-- Run: supabase db push  (or paste into the Supabase SQL editor)

-- =============================================================
-- Enums
-- =============================================================

create type trip_status as enum ('planning', 'active', 'completed', 'abandoned');

-- =============================================================
-- Tables
-- =============================================================

-- A user's trip. Origin/destination kept inline (no separate locations
-- table) — fine for MVP, swap to PostGIS later if we need geo queries.
create table trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  prompt      text not null,
  status      trip_status not null default 'planning',

  origin_label       text not null,
  origin_lat         numeric(9, 6) not null,
  origin_lng         numeric(9, 6) not null,
  destination_label  text not null,
  destination_lat    numeric(9, 6) not null,
  destination_lng    numeric(9, 6) not null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index trips_user_id_idx on trips (user_id, created_at desc);

-- Stops along a trip, ordered by `sequence`.
create table trip_stops (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references trips(id) on delete cascade,
  sequence          int  not null,
  name              text not null,
  description       text not null,
  lat               numeric(9, 6) not null,
  lng               numeric(9, 6) not null,
  arrival_estimate  text,
  created_at        timestamptz not null default now(),

  unique (trip_id, sequence)
);

create index trip_stops_trip_id_idx on trip_stops (trip_id, sequence);

-- Hidden activity cards. `hidden_hint` is what the user sees pre-reveal,
-- `revealed_description` is unlocked when they flip the card.
-- `completed_at` is denormalized for fast list rendering — it's set when a
-- submission for this card has matches=true.
create table activity_cards (
  id                    uuid primary key default gen_random_uuid(),
  stop_id               uuid not null references trip_stops(id) on delete cascade,
  title                 text not null,
  hidden_hint           text not null,
  revealed_description  text not null,
  scoring_criteria      text not null,
  base_points           int  not null check (base_points > 0),
  revealed_at           timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now()
);

create index activity_cards_stop_id_idx on activity_cards (stop_id);

-- Each photo upload + AI scoring result for a card. A card can have
-- multiple attempts; the highest-scoring one is the player's score.
create table card_submissions (
  id              uuid primary key default gen_random_uuid(),
  card_id         uuid not null references activity_cards(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  photo_path      text not null,  -- storage path within `card-photos` bucket
  matches         boolean not null,
  confidence      numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  awarded_points  int not null check (awarded_points >= 0),
  ai_reasoning    text not null,
  submitted_at    timestamptz not null default now()
);

create index card_submissions_card_id_idx on card_submissions (card_id, submitted_at desc);
create index card_submissions_user_id_idx on card_submissions (user_id, submitted_at desc);

-- =============================================================
-- Triggers
-- =============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trips_set_updated_at
  before update on trips
  for each row execute function set_updated_at();

-- Mark card complete on first successful submission.
create or replace function mark_card_complete_on_match()
returns trigger language plpgsql as $$
begin
  if new.matches then
    update activity_cards
       set completed_at = coalesce(completed_at, new.submitted_at)
     where id = new.card_id;
  end if;
  return new;
end;
$$;

create trigger card_submissions_mark_complete
  after insert on card_submissions
  for each row execute function mark_card_complete_on_match();

-- =============================================================
-- Row Level Security
-- =============================================================

alter table trips             enable row level security;
alter table trip_stops        enable row level security;
alter table activity_cards    enable row level security;
alter table card_submissions  enable row level security;

-- trips: owner-only
create policy "trips owner read"   on trips for select using (auth.uid() = user_id);
create policy "trips owner insert" on trips for insert with check (auth.uid() = user_id);
create policy "trips owner update" on trips for update using (auth.uid() = user_id);
create policy "trips owner delete" on trips for delete using (auth.uid() = user_id);

-- trip_stops: gated by parent trip ownership
create policy "stops via trip" on trip_stops for all
  using   (exists (select 1 from trips t where t.id = trip_stops.trip_id and t.user_id = auth.uid()))
  with check (exists (select 1 from trips t where t.id = trip_stops.trip_id and t.user_id = auth.uid()));

-- activity_cards: gated by parent trip ownership (via stop)
create policy "cards via trip" on activity_cards for all
  using   (exists (
            select 1 from trip_stops s
              join trips t on t.id = s.trip_id
            where s.id = activity_cards.stop_id and t.user_id = auth.uid()
          ))
  with check (exists (
            select 1 from trip_stops s
              join trips t on t.id = s.trip_id
            where s.id = activity_cards.stop_id and t.user_id = auth.uid()
          ));

-- card_submissions: owner-only
create policy "submissions owner read"   on card_submissions for select using (auth.uid() = user_id);
create policy "submissions owner insert" on card_submissions for insert with check (auth.uid() = user_id);

-- =============================================================
-- Storage bucket for card photos
-- =============================================================

insert into storage.buckets (id, name, public)
  values ('card-photos', 'card-photos', false)
  on conflict (id) do nothing;

create policy "card-photos owner read" on storage.objects for select
  using (bucket_id = 'card-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "card-photos owner insert" on storage.objects for insert
  with check (bucket_id = 'card-photos' and auth.uid()::text = (storage.foldername(name))[1]);
