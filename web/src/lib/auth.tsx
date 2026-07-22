import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, googleProvider, db } from './firebase'
import { SUPER_ADMIN_EMAIL, type UserRole } from './users'

type AuthContextValue = {
  user: User | null
  loading: boolean
  authorized: boolean
  isSuperAdmin: boolean
  role: UserRole | null
  signIn: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [membershipChecked, setMembershipChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [role, setRole] = useState<UserRole | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
  }, [])

  // Resolve household membership from the allowedUsers roster.
  useEffect(() => {
    let cancelled = false
    const email = user?.email?.toLowerCase()

    if (!email) {
      setAuthorized(false)
      setRole(null)
      setMembershipChecked(true)
      return
    }

    setMembershipChecked(false)

    if (email === SUPER_ADMIN_EMAIL) {
      // Super admin is always allowed. Ensure a roster doc exists (once).
      const ref = doc(db, 'allowedUsers', email)
      getDoc(ref)
        .then((snap) => {
          if (!snap.exists()) {
            void setDoc(ref, {
              email,
              role: 'owner',
              addedBy: 'system',
              addedAt: serverTimestamp(),
            }).catch(() => {})
          }
        })
        .catch(() => {})
      setAuthorized(true)
      setRole('owner')
      setMembershipChecked(true)
      return
    }

    getDoc(doc(db, 'allowedUsers', email))
      .then((snap) => {
        if (cancelled) return
        if (snap.exists()) {
          setAuthorized(true)
          setRole(((snap.data().role as UserRole) ?? 'member') as UserRole)
        } else {
          setAuthorized(false)
          setRole(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthorized(false)
          setRole(null)
        }
      })
      .finally(() => {
        if (!cancelled) setMembershipChecked(true)
      })

    return () => {
      cancelled = true
    }
  }, [user?.email])

  const loading = authLoading || (!!user && !membershipChecked)
  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider)
  }
  const signOutUser = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authorized,
        isSuperAdmin,
        role,
        signIn,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
