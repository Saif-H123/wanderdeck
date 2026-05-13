-- Auth isn't wired up yet — trips and submissions are created server-side
-- via the service-role key, bypassing RLS. Drop the NOT NULL on user_id
-- so anonymous trips persist. The RLS policies still block anon clients
-- from reading directly (good — forces them through our /api routes).
--
-- When real auth lands, a follow-up migration can re-tighten user_id
-- (defaulting to auth.uid() or backfilling).

alter table trips
  alter column user_id drop not null;

alter table card_submissions
  alter column user_id drop not null;
