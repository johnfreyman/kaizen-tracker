# Invited coach onboarding — October 8, 2026

## Problem and resulting flow

An invitation accepted in a browser already used by another coach authenticates the invited account in Supabase, but the app keeps its saved offline owner selected. The mismatch pauses uploads and hides password creation. Reloading after the authentication fragment is consumed also loses the original invitation indicator.

New invitations now open password creation before device preparation. If another coach's work is saved, an explicit account-switch screen appears first. The previous coach's data, queue and offline preparation remain stored under that coach; the incoming coach loads a separate record. A password-setup flag is bound to the incoming account and persists until the password is successfully saved, so reloading can resume setup.

For an already-consumed invitation that still has an authenticated session, the switch screen offers **Set a password and switch**. Expired sign-in links show an actionable message. Switching and changing a password check the current authenticated account first; a changed identity is rejected.

## Validation

- TypeScript passed.
- All 159 tests in 25 files passed on Node 24, including fresh invitations, reload continuation, expired links, account mismatch, cancellation, identity changes and preserved pending attendance.
- A Chromium check exercised the actual Supabase JS client against a localhost release build with synthetic intercepted API responses: invitation fragment, account switch, reload during password setup, one password update, then automatic preparation to Ready offline. No live account, email or production record changed.
- Release build passed with a placeholder publishable key for local validation; Vercel builds with its configured environment.
- React review checked effect cleanup, callback dependencies, account-scoped storage, labelled password fields, busy/error states and escaped account display.

## Release and real-account verification

This is frontend-only. Merge the PR to deploy through Vercel; no SQL migration or Supabase function deployment is required. After deployment, open an invitation in a browser with saved work, explicitly switch, create a password, sign out, and sign back in with that password. Confirm the previous coach's saved work is still available when that coach signs back in. A real email-link/account test remains to be performed by the owner.

If the already-opened invitation still has its authenticated session, reload after deployment and choose **Set a password and switch**. If the session or link has expired, obtain a fresh invitation or password-reset link; this code does not make expired links reusable.
