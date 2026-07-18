import { initializeApp } from 'firebase-admin/app'

initializeApp()

export { dailyRecurring, materializeRecurringNow } from './recurring'
