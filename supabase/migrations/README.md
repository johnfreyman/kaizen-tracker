# Recorded production migration history

These files are exact copies of the SQL records already applied to the retained Kaizen Tracker project. Their content lengths and MD5 hashes were checked against `supabase_migrations.schema_migrations` on October 7, 2026. No migration was executed as part of source reconciliation.

| Version | Purpose | SHA-256 |
| --- | --- | --- |
| `20260930215729` | Introduce canonical tracker and protected admin/purge behavior | `7892a29007f8767bda250a84a59d0ec888fad8d0b52afdbed3a6fc5c52370c58` |
| `20261006023411` | Retire four obsolete attendance tables with retained-data guards | `b574d154dbb86706a80c24cd43ca948d492887204caec72a2515e53abec0f6ac` |
| `20261007211057` | Restore protected administrator details and session revocation | `d4dd0cae6e139a1ca059fef2cf501a911167ef7f0b14ca6bf03c07978f30b828` |
| `20261007232052` | Pause the daily purge job until reminder emails are really delivered (audit A2). The job stays defined; resume only with a new reviewed migration. | `a92724ac69da57eae77b62f05fff8ab632def1c44a2697bf275a615724061e48` |

These are historical upgrades from an existing database. They depend on legacy application objects and managed Auth/Storage schemas. They are not a clean-room bootstrap. The guarded retirement SQL also contains catalog/count assertions specific to its release checkpoint.

Do not rerun these files or change their contents to make them replayable. Do not run the original first-launch candidate after legacy retirement. Future changes require a new reviewed forward migration, preserving current canonical attendance and owner permissions. Reconcile remote migration history before any CLI database push.

`migrations/` contains older SQL from the retired app. `docs/*test-migration.sql` and `docs/*role-tests.sql` are isolated rehearsal material. Neither is a deployment queue.

Recovery uses the separately retained, private, restore-tested backups and a reviewed recovery procedure. No production data dump, Auth record export, database password, or service-role key is included here.
