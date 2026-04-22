import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { admin, type ApiBet, type ApiPerson } from '../api/client'

export type Person = { id: string; name: string; pfp?: string }

export type AdminBetOption = {
  id: string
  label: string
  multiplier: string
  oldMultiplier?: string
  personId?: string
  result?: 'won' | 'lost'
  tier?: 'main' | 'sub'
  subGroupId?: string
  promoted?: boolean
}

export type AdminSubGroup = {
  groupKey: string
  title: string
  image?: string
  personId?: string
  promoted?: boolean
  infoTooltip?: string
}

export type AdminBet = {
  id: string
  shortId: string
  title: string
  banner?: string
  pfp?: string
  date: string
  options: AdminBetOption[]
  subGroups: AdminSubGroup[]
  settlementRules: string
  mainMarketTooltip?: string
  category: string
  personId?: string
  status: 'open' | 'pending' | 'resolved' | 'cancelled'
  featuredOrder: number
  createdAt: string
}

function normalizeOptions(options: AdminBetOption[]): AdminBetOption[] {
  return options.map(o => {
    const tier = o.tier ?? 'main'
    const next: AdminBetOption = { ...o, tier }
    if (tier === 'main') delete next.subGroupId
    return next
  })
}

function toBet(a: ApiBet): AdminBet {
  return {
    id: a._id,
    shortId: a.shortId,
    title: a.title,
    banner: a.banner,
    pfp: a.pfp,
    date: a.date,
    options: a.options,
    subGroups: (a.subGroups ?? []).map(g => ({
      groupKey: g.groupKey,
      title: g.title,
      image: g.image,
      personId: g.personId,
      promoted: g.promoted,
      infoTooltip: g.infoTooltip,
    })),
    settlementRules: a.settlementRules,
    mainMarketTooltip: a.mainMarketTooltip,
    category: a.category,
    personId: a.personId,
    status: a.status,
    featuredOrder: a.featuredOrder,
    createdAt: a.createdAt,
  }
}

function toPerson(a: ApiPerson): Person {
  return { id: a._id, name: a.name, pfp: a.pfp }
}

type AdminContextValue = {
  bets: AdminBet[]
  persons: Person[]
  categories: string[]
  loading: boolean
  refresh: () => Promise<void>
  addBet: (bet: Omit<AdminBet, 'id' | 'shortId' | 'createdAt' | 'status'>) => Promise<AdminBet>
  updateBet: (id: string, updates: Partial<AdminBet>) => Promise<void>
  deleteBet: (id: string) => Promise<void>
  resolveBet: (id: string, optionResults: Record<string, 'won' | 'lost'>) => Promise<void>
  addPerson: (person: Omit<Person, 'id'>) => Promise<Person>
  updatePerson: (id: string, updates: Partial<Person>) => Promise<void>
  deletePerson: (id: string) => Promise<void>
  addCategory: (name: string) => Promise<void>
  getBetsForPerson: (personId: string) => { bet: AdminBet; options: AdminBetOption[] }[]
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [bets, setBets] = useState<AdminBet[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [betsData, personsData, catsData] = await Promise.all([
        admin.getBets(),
        admin.getPersons(),
        admin.getCategories(),
      ])
      setBets(betsData.map(toBet))
      setPersons(personsData.map(toPerson))
      const baseline = ['Polityka', 'Sport', 'Trending']
      setCategories([...new Set([...baseline, ...catsData.map(c => c.name)])].sort((a, b) => a.localeCompare(b, 'pl')))
    } catch (err) {
      console.error('[admin] Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const addBet = async (bet: Omit<AdminBet, 'id' | 'shortId' | 'createdAt' | 'status'>) => {
    const created = await admin.createBet({
      title: bet.title,
      banner: bet.banner,
      pfp: bet.pfp,
      date: bet.date,
      options: normalizeOptions(bet.options),
      subGroups: bet.subGroups ?? [],
      settlementRules: bet.settlementRules,
      mainMarketTooltip: bet.mainMarketTooltip,
      category: bet.category,
      personId: bet.personId,
      featuredOrder: bet.featuredOrder,
    })
    const mapped = toBet(created)
    setBets(prev => [mapped, ...prev])
    return mapped
  }

  const updateBet = async (id: string, updates: Partial<AdminBet>) => {
    const existing = bets.find(b => b.id === id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    const updated = await admin.updateBet(id, {
      title: merged.title,
      banner: merged.banner,
      pfp: merged.pfp,
      date: merged.date,
      options: normalizeOptions(merged.options),
      subGroups: merged.subGroups ?? [],
      settlementRules: merged.settlementRules,
      mainMarketTooltip: merged.mainMarketTooltip,
      category: merged.category,
      personId: merged.personId,
      featuredOrder: merged.featuredOrder,
    })
    setBets(prev => prev.map(b => (b.id === id ? toBet(updated) : b)))
  }

  const deleteBet = async (id: string) => {
    await admin.deleteBet(id)
    setBets(prev => prev.filter(b => b.id !== id))
  }

  const resolveBet = async (id: string, optionResults: Record<string, 'won' | 'lost'>) => {
    const resolved = await admin.resolveBet(id, optionResults)
    setBets(prev => prev.map(b => (b.id === id ? toBet(resolved) : b)))
  }

  const addPerson = async (person: Omit<Person, 'id'>) => {
    const created = await admin.createPerson({ name: person.name, pfp: person.pfp })
    const mapped = toPerson(created)
    setPersons(prev => [...prev, mapped])
    return mapped
  }

  const updatePerson = async (id: string, updates: Partial<Person>) => {
    const existing = persons.find(p => p.id === id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    const updated = await admin.updatePerson(id, { name: merged.name, pfp: merged.pfp })
    setPersons(prev => prev.map(p => (p.id === id ? toPerson(updated) : p)))
  }

  const deletePerson = async (id: string) => {
    await admin.deletePerson(id)
    setPersons(prev => prev.filter(p => p.id !== id))
  }

  const addCategory = async (name: string) => {
    if (categories.includes(name)) return
    await admin.createCategory(name)
    setCategories(prev => [...prev, name])
  }

  const getBetsForPerson = (personId: string) => {
    return bets
      .filter(b => b.personId === personId || b.options.some(o => o.personId === personId))
      .map(b => ({
        bet: b,
        options: b.options.filter(o => o.personId === personId),
      }))
  }

  return (
    <AdminContext.Provider
      value={{
        bets, persons, categories, loading, refresh,
        addBet, updateBet, deleteBet, resolveBet,
        addPerson, updatePerson, deletePerson,
        addCategory, getBetsForPerson,
      }}
    >
      {children}
    </AdminContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
