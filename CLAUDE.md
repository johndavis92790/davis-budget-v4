# Davis Budget v4 — architecture & context

Private family budget tracker for John & Hillary Davis. Manual entry (no bank
integration), a 4-week/13-period fiscal calendar, HSA reimbursement tracking, AI
receipt scanning, what-if scenarios, and a BigQuery→Looker reporting pipeline.
Mobile-first installable PWA. Rebuild of the older `budget-app-v3`.

Live: https://davis-budget-v4.web.app · Firebase project: `davis-budget-v4`
(personal Google account `john.davis.92790@gmail.com`).

## Stack

- **web/** — Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui (dark), react-router-dom 7, Recharts. PWA.
- **functions/** — Firebase Cloud Functions v2 (Node 22, TypeScript), `@google/genai` (Vertex/Gemini), `@google-cloud/bigquery`, `jszip`.
- **Firestore** — primary database (client reads/writes directly via security rules).
- **Cloud Storage** — receipts + audit exports. Bucket: `davis-budget-v4-receipts` (custom, see gotchas).
- **BigQuery** — `budget.transactions`, nightly full refresh, for Looker Studio.
- **Auth** — Firebase Auth (Google), allowlisted to a household roster.

## Commands (run via the personal account)

```bash
# Web
cd web && npm run dev            # local dev at :5173
cd web && npm run build          # tsc -b && vite build -> web/dist
firebase deploy --only hosting --project davis-budget-v4 --account john.davis.92790@gmail.com

# Functions (build is run by predeploy; deploy specific fns to be fast)
cd functions && npm run build
firebase deploy --only functions:NAME --project davis-budget-v4 --account john.davis.92790@gmail.com

# Firestore rules
firebase deploy --only firestore:rules --project davis-budget-v4 --account john.davis.92790@gmail.com
```

The Firebase CLI default account is a different (work) account, so **always pass
`--account john.davis.92790@gmail.com`**. For `gcloud`/`gsutil` use
`--account=john.davis.92790@gmail.com`. `gh` is already the personal account.

## Firestore data model

All money is **dollars** (a number, rounded to 2 decimals). Amounts are stored as
a **positive magnitude**; the sign comes from `type` via `signedAmount()`
(exception: `adjustment` stores a signed amount).

### `transactions` (the core collection)
Doc id = random UUID. Fields:
- `id`, `date` (`YYYY-MM-DD`), `sortTime` (number, ms — input-order tiebreak within a day)
- `type`: `expense | refund | income | recurring-expense | recurring-income | reimbursement | adjustment`
- `category` (one of the 17 fixed categories), `tags` (string[]), `amount`, `description`
- HSA: `hsa` (bool), `hsaReimbursedAmount`, `hsaReimbursedDate`, `hsaNotes`
- Links: `refundedFromId` (refund → its expense), `linkedExpenseIds` (reimbursement → HSA expenses it covers), `reimbursementId` (HSA expense → the reimbursement that paid it), `recurringTemplateId` (materialized recurring → its template)
- Denormalized fiscal keys: `fiscalYearKey` (`FY2026`), `fiscalMonthKey` (`FY2026-P07`), `fiscalWeekKey` (`FY2026-P07-W4`) — computed from `date`
- `createdBy` (email, or `system`/`migration`), `createdAt`, `updatedAt`

### `recurringTemplates`
Doc id = UUID. `{ id, type: income|expense, category, tags[], value (calendar-monthly $), description, active, createdAt, updatedAt }`. Editing/deleting a template does NOT touch already-materialized history rows.

### `tags`
Doc id = lowercased name. `{ name }`. Auto-created on use via `ensureTags()`.

### `weeklyGoals`
Doc id = `fiscalWeekKey`. `{ fiscalWeekKey, target ($), updatedBy, updatedAt }`. Manual per-week target.

### `scenarios` (theoretical budgets)
Doc id = UUID. `{ id, name, items: [{type, category, tags[], value, description}], createdAt, updatedAt }`. Self-contained; never affects real data.

### `allowedUsers` (household roster / access control)
Doc id = lowercased email. `{ email, role: owner|member, addedBy, addedAt }`. Only the super admin (`john.davis.92790@gmail.com`, hardcoded in rules + `users.ts`) can write it.

### `fcmTokens`
Doc id = the FCM token. `{ token, userEmail, platform, createdAt }`. One per device.

### `meta/ledger`
`{ anchorDate (YYYY-MM-DD), openingBalance ($) }`. Anchors the rolling available-funds calc.

### `meta/materializations`
`{ months: string[] }` — fiscalMonthKeys already materialized (idempotency marker; seeded through FY2026-P07 by the migration).

### Not in Firestore
- **Categories** — hardcoded 17 in `web/src/lib/categories.ts` (mirrored in `functions/src/lib/categories.ts`).
- **Fiscal calendar** — computed algorithmically, never stored (see below).

## Cloud Storage (bucket `davis-budget-v4-receipts`)
- `receipts/{transactionId}/{timestamp}.{ext}` — receipt images/PDFs.
- `exports/audit-{scope}-{ts}.zip` — audit packages.

## Fiscal calendar (`web/src/lib/fiscal.ts`, mirror in `functions/src/lib/fiscal.ts`)
4-week / 13-period accounting year. Epoch = **2021-01-10** (a Sunday). Every
fiscal year is exactly **52 weeks = 364 days** (no 53-week years). Weeks run
Sun–Sat, so a calendar week row == a fiscal week. `getFiscal(iso)` returns the
year/period/week numbers, keys, and start/end dates. All math is UTC on the
`YYYY-MM-DD` string so it's timezone-independent. Verified against v3's period ids.

## Goals logic (`web/src/lib/compute.ts`)
- **Available funds** (`availableFunds`) = `meta/ledger.openingBalance` + Σ `signedAmount(t)` for every transaction with `date >= anchorDate`. A continuous running balance that rolls over month to month and includes ALL types. Overridden by writing an `adjustment` transaction (`adjustAvailableFunds`).
- **Weekly remaining** = `weeklyGoals[currentWeekKey].target` − `weekNetSpend(currentWeek)`, where `weekNetSpend` = Σ(`expense` amounts) − Σ(`refund` amounts) in that fiscal week ONLY (recurring/income/reimbursement/adjustment are excluded). Resets each fiscal week.
- `signedAmount`: `expense`/`recurring-expense` → negative; `refund`/`income`/`recurring-income`/`reimbursement` → positive; `adjustment` → as stored (signed).

## Data flow

### Reads (client) — `web/src/lib/data.tsx`
`DataProvider` opens `onSnapshot` listeners on `transactions` (ALL docs, sorted in
memory by `date` desc then `sortTime` asc), `recurringTemplates`, `tags`,
`weeklyGoals`, `scenarios`, and `meta/ledger`, exposed via `useData()`. Everything
(history, filters, calendar, goals, reports) is computed client-side from this —
no server pagination, no composite indexes. Fine for this scale (a few thousand
rows). `UsersPage` subscribes to `allowedUsers` separately.

### Writes (client) — `web/src/lib/db.ts`
`addTransaction` / `updateTransaction` (recomputes fiscal keys if date changes) /
`deleteTransaction`; `addRefundForExpense`; `reimburseHsaExpenses` (batch) /
`undoReimbursement` / `clearHsaReimbursement`; `adjustAvailableFunds`;
`ensureTags`; `addRecurring`/`updateRecurring`/`deleteRecurring`; `setWeeklyGoal`;
`setLedgerAnchor`; `addScenario`/`updateScenario`/`deleteScenario`.
Receipts: `web/src/lib/receipts.ts` (`uploadReceipt`, `listReceipts`,
`deleteReceipt`, `copyReceipts`, `fileToBase64`).

### Cloud Functions — `functions/src/`
- `recurring.ts`: `dailyRecurring` (scheduled 6am America/Denver) → `materializeMonth` creates `recurring-*` transactions for the current fiscal month (×12/13, income-then-expense largest-first, idempotent via `meta/materializations`); `materializeRecurringNow` (callable, manual/catch-up).
- `ai.ts`: `scanReceipt` (callable) — Gemini 2.5 Flash on Vertex; returns extraction JSON (amount/date/category/description/tags/hsa + `lineItems` grouped one-per-category with tax allocated). Does NOT write; the client saves.
- `reporting.ts`: `dailyBigQuerySync` (2am) + `syncBigQueryNow` (callable) — full `WRITE_TRUNCATE` refresh of `budget.transactions`.
- `notifications.ts`: `onTransactionWrite` (Firestore trigger on `transactions/{id}`) → FCM push to OTHER users' tokens (skips `system`/`migration` actors, prunes dead tokens); `sendTestNotification` (callable → caller's own devices).
- `exports.ts`: `exportAuditZip` (callable) — zips receipts + `manifest.csv` for a scope/year, uploads to `exports/`, returns the path (client fetches a download URL).
- `lib/auth.ts`: `assertAllowed(req)` — gate for callables (super admin or `allowedUsers`).

### Client → Function callables — `web/src/lib/functions.ts`
`scanReceiptFn`, `materializeRecurringNowFn`, `syncBigQueryNowFn`,
`exportAuditZipFn`, `sendTestNotificationFn`.

## Auth & security
Firebase Auth Google sign-in. `web/src/lib/auth.tsx` resolves membership: super
admin (hardcoded) or an `allowedUsers/{email}` doc. `firestore.rules`: any allowed
user reads/writes all collections **except** `allowedUsers` (super-admin-only
write); the catch-all uses a single-level `match /{col}/{doc}` so members can't
grant themselves access (subcollections would need explicit rules).

## Routes / pages (`web/src/App.tsx`, `web/src/pages/`)
`/` Home · `/add` · `/edit/:id` · `/history` · `/calendar` · `/recurring` ·
`/hsa` · `/scenarios` + `/scenarios/:id` · `/reports` · `/scan` · `/notifications`
· `/users` (super-admin only). Shared UI in `web/src/components/` (notably
`TransactionForm`, `SplitEditor`, `TransactionRow`, `RecurringForm`,
`GoalsDialog`, `ReceiptsSection`, `AppShell`).

## Conventions
- Money: dollars, `roundMoney`/`sumMoney`; format with `formatCurrency`; parse with `parseCurrency`.
- Positive `amount` + sign-by-`type`. New transactions get `sortTime = Date.now()`.
- Dark shadcn/ui; custom Tailwind tokens `pos` (green) / `neg` (red) for money; `.tabular` for figures.
- Add shadcn components with `npx shadcn@latest add NAME --yes` (run inside `web/`).

## Gotchas
- **Storage bucket is custom** (`davis-budget-v4-receipts`), linked to Firebase via the `firebasestorage:addFirebase` API. There is **no default `.firebasestorage.app` bucket**, so `firebase deploy --only storage` fails — storage rules are deployed via the **Firebase Rules API** (create ruleset + release `firebase.storage/davis-budget-v4-receipts`), not the CLI. `firebase.json` has no `storage` block.
- Functions `firebase.json` `ignore` must NOT list `lib/` (the compiled output is uploaded).
- Local Node is 25; functions are pinned to Node 22 (`engines`).
- Migration: v4 doc ids are UUIDs; **`sortTime` = the original v3 id** for rows whose id was a valid ms timestamp (used to remap v3 receipts). ~72/117 v3 receipt folders migrated.
- Client `getStorage(app, 'gs://davis-budget-v4-receipts')` — not the config default.
- VAPID web-push key lives in `web/.env` as `VITE_FIREBASE_VAPID_KEY` (public key).
- `reference/` (v3 xlsx, screenshots, appscript) and `screenshots/` are gitignored — real financial data, never commit.

## Known / not-yet-built
- Ad-hoc Google Sheet export (BigQuery covers Looker instead).
- Bundle isn't code-split (~450 KB gzipped — acceptable for now).
- Notifications work but must be enabled per device.
