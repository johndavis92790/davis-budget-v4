import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getStorage } from 'firebase-admin/storage'
import { defineSecret } from 'firebase-functions/params'
import { assertAllowed } from './lib/auth'
import { denverToday } from './lib/fiscal'

const REGION = 'us-central1'
const BUCKET = 'davis-budget-v4-receipts'
// The SimpleFIN access URL (embeds a permanent username:password) is set once via:
//   firebase functions:secrets:set SIMPLEFIN_ACCESS_URL --project davis-budget-v4 --account john.davis.92790@gmail.com
const SIMPLEFIN_ACCESS_URL = defineSecret('SIMPLEFIN_ACCESS_URL')

// SimpleFIN's own guidance: overlap each fetch window by a few days so
// transactions that post late don't fall through the gap between daily runs.
const OVERLAP_DAYS = 5

interface SimpleFinResponse {
  errors?: string[]
  accounts?: unknown[]
}

async function fetchAndArchive(accessUrl: string) {
  const startDate = Math.floor(Date.now() / 1000) - OVERLAP_DAYS * 86_400

  // The access URL embeds Basic Auth credentials (user:pass@host); Node's
  // fetch() refuses to build a Request from a URL containing credentials
  // (per the Fetch spec), so pull them out into an explicit header instead.
  const parsed = new URL(accessUrl)
  const authHeader =
    'Basic ' +
    Buffer.from(
      `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`,
    ).toString('base64')
  const target = new URL(
    `${parsed.pathname.replace(/\/$/, '')}/accounts`,
    `${parsed.protocol}//${parsed.host}`,
  )
  target.search = new URLSearchParams({
    'start-date': String(startDate),
    pending: '1',
    version: '2',
  }).toString()

  const res = await fetch(target.toString(), {
    headers: { Authorization: authHeader },
  })
  const body = await res.text()
  if (!res.ok) {
    throw new HttpsError(
      'internal',
      `SimpleFIN request failed: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`,
    )
  }

  let json: SimpleFinResponse
  try {
    json = JSON.parse(body)
  } catch {
    throw new HttpsError('internal', 'SimpleFIN response was not valid JSON')
  }
  if (json.errors?.length) {
    console.error('SimpleFIN returned errors:', json.errors)
  }

  const today = denverToday() // YYYY-MM-DD
  const [year, month] = today.split('-')
  const path = `simplefin-raw/${year}/${month}/${today}.json`
  await getStorage()
    .bucket(BUCKET)
    .file(path)
    .save(body, { contentType: 'application/json' })

  return {
    path,
    bytes: body.length,
    accounts: json.accounts?.length ?? 0,
    errors: json.errors ?? [],
  }
}

// Runs daily; archives the raw SimpleFIN /accounts response to Cloud Storage.
// Overwrites the same day's object if it runs more than once (idempotent).
export const dailySimpleFinSync = onSchedule(
  {
    schedule: '17 6 * * *',
    timeZone: 'America/Denver',
    region: REGION,
    secrets: [SIMPLEFIN_ACCESS_URL],
    timeoutSeconds: 60,
  },
  async () => {
    const result = await fetchAndArchive(SIMPLEFIN_ACCESS_URL.value())
    console.log('dailySimpleFinSync', result)
  },
)

// Manual trigger (testing / catch-up).
export const syncSimpleFinNow = onCall(
  { region: REGION, secrets: [SIMPLEFIN_ACCESS_URL], timeoutSeconds: 60 },
  async (req) => {
    await assertAllowed(req)
    return fetchAndArchive(SIMPLEFIN_ACCESS_URL.value())
  },
)
