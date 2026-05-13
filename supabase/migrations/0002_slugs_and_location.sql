-- Adds:
--   - trips.slug (short URL-safe id for /trip/[slug])
--   - location verification columns on card_submissions
--     (browser geo at upload, EXIF GPS from photo, computed distance to
--     stop, location_score 0-1, activity_score 0-1 separated from final
--     awarded_points so we can introspect the grade after the fact)

-- =============================================================
-- trips.slug
-- =============================================================

alter table trips
  add column slug text;

-- Backfill not needed (no rows yet); enforce now.
alter table trips
  alter column slug set not null,
  add constraint trips_slug_unique unique (slug);

-- =============================================================
-- card_submissions: location verification
-- =============================================================

alter table card_submissions
  add column upload_lat       numeric(9, 6),
  add column upload_lng       numeric(9, 6),
  add column photo_lat        numeric(9, 6),
  add column photo_lng        numeric(9, 6),
  add column distance_meters  numeric(10, 2),
  add column location_score   numeric(4, 3) check (location_score >= 0 and location_score <= 1),
  add column activity_score   numeric(4, 3) check (activity_score >= 0 and activity_score <= 1);

-- `matches` becomes a derived convenience flag: did we award any points
-- at all. We don't drop it — RLS-friendly and useful for filters.
