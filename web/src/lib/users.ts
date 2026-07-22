import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from './firebase'

// The permanent super admin. Mirrors the hardcoded value in firestore.rules.
export const SUPER_ADMIN_EMAIL = 'john.davis.92790@gmail.com'

export type UserRole = 'owner' | 'member'

export interface AllowedUser {
  email: string
  role: UserRole
  displayName?: string
  addedBy?: string
  addedAt?: { toDate: () => Date } | null
}

export const usersCollection = collection(db, 'allowedUsers')

export function userDocRef(email: string) {
  return doc(db, 'allowedUsers', email.trim().toLowerCase())
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export async function addAllowedUser(
  email: string,
  addedByEmail: string,
  role: UserRole = 'member',
) {
  const normalized = email.trim().toLowerCase()
  await setDoc(
    userDocRef(normalized),
    {
      email: normalized,
      role,
      addedBy: addedByEmail,
      addedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function removeAllowedUser(email: string) {
  await deleteDoc(userDocRef(email))
}
