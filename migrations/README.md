# Historical database migrations

These numbered files document the previous attendance application. They are retained for historical review and existing rehearsal references. They are **not** the production setup instructions and must not be rerun against the retained Kaizen database.

The current application uses canonical `tracker_*` tables. The old `roster`, `events`, `active_session`, and `archived_event_sets` tables were retired on October 5, 2026 (migration timestamp October 6 UTC).

See [the recorded production migration history](../supabase/migrations/README.md) and [the hosted release checkpoint](../docs/simplification-hosted-release-checkpoint.md). Earlier claims that all numbered scripts are idempotent or safe to replay are withdrawn. A new environment requires a separately reviewed baseline and rehearsal.
