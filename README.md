# Davis Budget (v4)

A private family budget tracker for John & Hillary Davis. Manual entry (no bank
integration), a 4-week/13-period fiscal calendar, HSA reimbursement tracking, AI
receipt scanning, and what-if scenarios. Rebuild of
[budget-app-v3](https://github.com/johndavis92790/budget-app-v3) on a modern,
scalable stack.

## Stack

- **Web:** Vite + React + TypeScript + Tailwind v4 + shadcn/ui (dark), installable PWA
- **Backend:** Firebase — Firestore (direct client access via security rules),
  Cloud Functions v2 (Node 22) for AI scanning, scheduled jobs, exports, and notifications
- **AI:** Gemini / Vertex AI for receipt extraction
- **Reporting:** Firestore → BigQuery → Looker Studio, plus in-app charts and Google Sheet export
- **Auth:** Firebase Auth (Google), allowlisted to the household

## Layout

```
web/        React app (Vite)
functions/  Cloud Functions (v2, TypeScript)
shared/     Types + fiscal calendar shared by web and functions
reference/  v3 source snapshots & data (gitignored, local only)
```

## Develop

```bash
cd web && npm install && npm run dev      # web app at http://localhost:5173
```

Deploys are done via the Firebase CLI against project `davis-budget-v4`.

## Firebase project

`davis-budget-v4` (personal Google account). Firestore in `us-central1`.
