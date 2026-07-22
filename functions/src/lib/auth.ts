import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'

const SUPER_ADMIN = 'john.davis.92790@gmail.com'

/** Throws unless the caller is the super admin or in allowedUsers. Returns email. */
export async function assertAllowed(
  req: CallableRequest<unknown>,
): Promise<string> {
  const email = (req.auth?.token?.email as string | undefined)?.toLowerCase()
  if (!email) throw new HttpsError('unauthenticated', 'Sign in required')
  if (email === SUPER_ADMIN) return email
  const snap = await getFirestore().doc(`allowedUsers/${email}`).get()
  if (!snap.exists) throw new HttpsError('permission-denied', 'Not authorized')
  return email
}
