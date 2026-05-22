// Drop-in replacement helper for `getErrorRate` / `hasPendingSyncs` / etc.
// Returns lifecycle state for unverified coaches. Null for verified.
//
// Pure read-only: derives stage from account_created_at. Server-side worker
// performs the actual purge at day 90; this helper only describes where
// the row sits in the lifecycle.

import type { CoachSummaryRow } from "@/app/components/admin/CoachDetailDrawer";

export const PURGE_WINDOW_DAYS = 90;
export const NUDGE_WINDOW_DAYS = 7;
export const IMMINENT_WINDOW_DAYS = 7;

export type PurgeStage = "nudge" | "scheduled" | "imminent";

export interface PurgeState {
  stage: PurgeStage;
  /** Days since account_created_at, rounded. */
  daysOld: number;
  /** Days until scheduled purge, never negative. */
  daysRemaining: number;
  /** ISO timestamp of the scheduled purge. */
  purgeDate: string;
}

/**
 * Lifecycle stages (anchored to account_created_at):
 *   nudge      day 0–6     automated reminders firing, no admin action
 *   scheduled  day 7–82    final notice sent, on the clock
 *   imminent   ≤7d remain  needs review before server purges
 *
 * Hard purge happens server-side at day 90. This helper is read-only.
 */
export function getPurgeState(row: CoachSummaryRow): PurgeState | null {
  if (row.email_verified) return null;
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
  };
}
