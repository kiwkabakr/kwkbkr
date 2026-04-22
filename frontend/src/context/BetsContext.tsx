import { createContext, useContext, useState, type ReactNode } from 'react'
import type { BetOption } from '../components/BetCard'

export type SelectedBet = {
  betId: string
  title: string
  image?: string
  option: BetOption
}

type BetsContextValue = {
  bets: SelectedBet[]
  stake: string
  setStake: (v: string) => void
  toggleBet: (bet: SelectedBet) => void
  removeBet: (betId: string) => void
  isSelected: (betId: string, optionLabel: string) => boolean
}

const BetsContext = createContext<BetsContextValue | null>(null)

export function BetsProvider({ children }: { children: ReactNode }) {
  const [bets, setBets] = useState<SelectedBet[]>([])
  const [stake, setStake] = useState('100')

  const toggleBet = (bet: SelectedBet) => {
    setBets((prev) => {
      const idx = prev.findIndex((b) => b.betId === bet.betId)
      if (idx !== -1) {
        if (prev[idx].option.label === bet.option.label) {
          return prev.filter((_, i) => i !== idx)
        }
        const next = [...prev]
        next[idx] = bet
        return next
      }
      return [...prev, bet]
    })
  }

  const removeBet = (betId: string) =>
    setBets((prev) => prev.filter((b) => b.betId !== betId))

  const isSelected = (betId: string, optionLabel: string) =>
    bets.some((b) => b.betId === betId && b.option.label === optionLabel)

  return (
    <BetsContext.Provider value={{ bets, stake, setStake, toggleBet, removeBet, isSelected }}>
      {children}
    </BetsContext.Provider>
  )
}

export function useBets() {
  const ctx = useContext(BetsContext)
  if (!ctx) throw new Error('useBets must be used within BetsProvider')
  return ctx
}
