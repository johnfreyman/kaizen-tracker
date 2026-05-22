// Pure read-only helper that returns lifecycle state for unverified coaches.
// Null for verified coaches (no coach_purge_state row in the view).
//
// Reads authoritative purge state from the DB columns added by migration 007.
// Falls back to deriving from account_created_at when purge columns are absent
// (e.g. before the migration is applied or in test fixtures).

import type { CoachSummaryRow } from "@/app/components/admin/CoachDetailDrawer";

export const PURGE_WINDOW_DAYS = 90;
export const NUDGE_WINDOW_DAYS = 7;
export const IMMINENT_WINDOW_DAYS = 7;

export type PurgeStage = "nudge" | "scheduled" | "imminent" | "soft_deleted";

export interface PurgeState {
  stage: PurgeStage;
  /** Days since the purge clock started (account_created_at), rounded. */
  daysOld: number;
  /** Days until scheduled purge (soft-delete), never negative. 0 if already purged. */
  daysRemaining: number;
  /** ISO timestamp of the scheduled purge (soft-delete deadline). */
  purgeDate: string;
  /** How many times an admin extended the deadline. */
  extendedCount: number;
  /** ISO timestamp of hard-delete (only set after soft-delete). */
  hardDeleteAt: string | null;
}

/**
 * Lifecycle stages:
 *   nudge         day 0–6      automated reminders firing, no admin action
 *   scheduled     day 7–82     on the clock, final notice sent at day 83
 *   imminent      ≤7d remain   needs review before server purges
 *   soft_deleted  day 90+      PII anonymized, row retained for metrics
 *
 * Reads from DB columns when available; falls back to derivation.
 */
export function getPurgeState(row: CoachSummaryRow): PurgeState | null {
  if (row.email_verified) return null;

  // ── DB-backed path (migration 007 applied) ──────────────────────────────
  if (row.purge_status != null && row.purge_deadline != null) {
    if (row.purge_status === "soft_deleted") {
      const DAY_MS = 86_400_000;
      const clockStartMs = row.original_deadline
        ? new Date(row.original_deadline).getTime() - 90 * DAY_MS
        : row.account_created_at
          ? new Date(row.account_created_at).getTime()
          : null;
      const daysOld = clockStartMs != null
        ? Math.round((Date.now() - clockStartMs) / DAY_MS)
        : PURGE_WINDOW_DAYS;

      return {
        stage: "soft_deleted",
        daysOld,
        daysRemaining: 0,
        purgeDate: row.purge_deadline,
        extendedCount: row.extended_count ?? 0,
        hardDeleteAt: row.hard_delete_at ?? null,
      };
    }

    // purge_status === 'active'
    const DAY = 86_400_000;
    const deadlineMs = new Date(row.purge_deadline).getTime();
    const daysRemaining = Math.max(
      0,
      Math.round((deadlineMs - Date.now()) / DAY)
    );

    const clockStartMs = row.original_deadline
      ? new Date(row.original_deadline).getTime() - 90 * DAY
      : row.account_created_at
        ? new Date(row.account_created_at).getTime()
        : null;
    const daysOld = clockStartMs != null
      ? Math.round((Date.now() - clockStartMs) / DAY)
      : PURGE_WINDOW_DAYS - daysRemaining;

    let stage: PurgeStage;
    if (daysOld < NUDGE_WINDOW_DAYS) stage = "nudge";
    else if (daysRemaining <= IMMINENT_WINDOW_DAYS) stage = "imminent";
    else stage = "scheduled";

    return {
      stage,
      daysOld,
      daysRemaining,
      purgeDate: row.purge_deadline,
      extendedCount: row.extended_count ?? 0,
      hardDeleteAt: null,
    };
  }

  // ── Fallback: derive from account_created_at (pre-migration compat) ─────
  if (!row.account_created_at) return null;

  const DAY = 86_400_000;
  const daysOld = (Date.now() - new Date(row.account_created_at).getTime()) / DAY;
  const daysRemaining = Math.max(0, Math.round(PURGE_WINDOW_DAYS - daysOld));

  let stage: PurgeStage;
  if (daysOld < NUDGE_WINDOW_DAYS) stage = "nudge";
  else if (daysRemaining <= IMMINENT_WINDOW_DAYS) stage = "imminent";
  else stage = "scheduled";

  return {
    stage,
    daysOld: Math.round(daysOld),
    daysRemaining,
    purgeDate: new Date(Date.now() + daysRemaining * DAY).toISOString(),
    extendedCount: 0,
    hardDeleteAt: null,
  };
}
