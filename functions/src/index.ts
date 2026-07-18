import { initializeApp } from 'firebase-admin/app'

initializeApp()

export { dailyRecurring, materializeRecurringNow } from './recurring'
export { scanReceipt } from './ai'
export { dailyBigQuerySync, syncBigQueryNow } from './reporting'
