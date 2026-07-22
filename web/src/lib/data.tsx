import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import {
  metaCol,
  recurringCol,
  scenariosCol,
  tagsCol,
  transactionsCol,
  weeklyGoalsCol,
} from './db'
import type {
  LedgerAnchor,
  RecurringTemplate,
  Scenario,
  Transaction,
  WeeklyGoal,
} from './types'

type DataContextValue = {
  transactions: Transaction[]
  recurring: RecurringTemplate[]
  tags: string[]
  weeklyGoals: Record<string, WeeklyGoal>
  scenarios: Scenario[]
  ledgerAnchor: LedgerAnchor | null
  loading: boolean
}

export const DataContext = createContext<DataContextValue | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recurring, setRecurring] = useState<RecurringTemplate[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [weeklyGoals, setWeeklyGoals] = useState<Record<string, WeeklyGoal>>({})
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [ledgerAnchor, setLedgerAnchor] = useState<LedgerAnchor | null>(null)
  const [txLoaded, setTxLoaded] = useState(false)
  const [recLoaded, setRecLoaded] = useState(false)

  useEffect(() => {
    return onSnapshot(
      transactionsCol,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Transaction)
        // Newest transaction date first; within a day, input order (sortTime asc).
        list.sort(
          (a, b) =>
            b.date.localeCompare(a.date) || (a.sortTime ?? 0) - (b.sortTime ?? 0),
        )
        setTransactions(list)
        setTxLoaded(true)
      },
      () => setTxLoaded(true),
    )
  }, [])

  useEffect(() => {
    return onSnapshot(
      recurringCol,
      (snap) => {
        setRecurring(snap.docs.map((d) => d.data() as RecurringTemplate))
        setRecLoaded(true)
      },
      () => setRecLoaded(true),
    )
  }, [])

  useEffect(() => {
    return onSnapshot(tagsCol, (snap) => {
      setTags(
        snap.docs
          .map((d) => (d.data() as { name: string }).name)
          .sort((a, b) => a.localeCompare(b)),
      )
    })
  }, [])

  useEffect(() => {
    return onSnapshot(weeklyGoalsCol, (snap) => {
      const map: Record<string, WeeklyGoal> = {}
      snap.docs.forEach((d) => {
        const w = d.data() as WeeklyGoal
        map[w.fiscalWeekKey] = w
      })
      setWeeklyGoals(map)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(scenariosCol, (snap) => {
      setScenarios(snap.docs.map((d) => d.data() as Scenario))
    })
  }, [])

  useEffect(() => {
    return onSnapshot(doc(metaCol, 'ledger'), (snap) => {
      setLedgerAnchor(snap.exists() ? (snap.data() as LedgerAnchor) : null)
    })
  }, [])

  const value = useMemo(
    () => ({
      transactions,
      recurring,
      tags,
      weeklyGoals,
      scenarios,
      ledgerAnchor,
      loading: !txLoaded || !recLoaded,
    }),
    [
      transactions,
      recurring,
      tags,
      weeklyGoals,
      scenarios,
      ledgerAnchor,
      txLoaded,
      recLoaded,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
