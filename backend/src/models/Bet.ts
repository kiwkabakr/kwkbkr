import mongoose, { Schema, Document } from 'mongoose'
import crypto from 'crypto'

export interface IBetSubGroup {
  /** Stable id for options.subGroupId (do not use field name `id` — Mongoose reserves it) */
  groupKey: string
  title: string
  /** Shown left of the category title on the bet page */
  image?: string
  personId?: string
  /** Own bet card on home grid with top sub-options (links to parent bet). */
  promoted?: boolean
  /** Hover tooltip for the info icon next to this category title on the bet page */
  infoTooltip?: string
}

export interface IBetOption {
  id: string
  label: string
  multiplier: string
  oldMultiplier?: string
  personId?: string
  result?: 'won' | 'lost'
  /** Main = home grid + featured; sub = extra rows on bet detail only */
  tier?: 'main' | 'sub'
  /** When tier=sub, links to subGroups[].groupKey */
  subGroupId?: string
  /** Render this option as its own bet card on the home grid (links to parent bet page). */
  promoted?: boolean
}

export interface IBet extends Document {
  shortId: string
  title: string
  banner?: string
  pfp?: string
  date: Date
  options: IBetOption[]
  /** Grouped “Więcej opcji” markets (title + optional person); sub options reference by subGroupId */
  subGroups: IBetSubGroup[]
  settlementRules: string
  /** Hover tooltip for the info icon next to the Główne block on the bet page */
  mainMarketTooltip?: string
  category: string
  personId?: string
  /** open = accepting wagers; pending = past cutoff, awaiting admin resolution */
  status: 'open' | 'pending' | 'resolved' | 'cancelled'
  featuredOrder: number
  createdAt: Date
}

function generateShortId(): string {
  return crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase()
}

const betSubGroupSchema = new Schema<IBetSubGroup>(
  {
    groupKey: { type: String, required: true },
    title: { type: String, required: true },
    image: { type: String },
       personId: { type: String },
    promoted: { type: Boolean, default: false },
    infoTooltip: { type: String },
  },
  { _id: false, id: false }
)

const betOptionSchema = new Schema<IBetOption>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    multiplier: { type: String, required: true },
    oldMultiplier: { type: String },
    personId: { type: String },
    result: { type: String, enum: ['won', 'lost'] },
    tier: { type: String, enum: ['main', 'sub'], default: 'main' },
    subGroupId: { type: String },
    promoted: { type: Boolean, default: false },
  },
  { _id: false, id: false }
)

const betSchema = new Schema<IBet>(
  {
    shortId: { type: String, unique: true, default: generateShortId, index: true },
    title: { type: String, required: true },
    banner: { type: String },
    pfp: { type: String },
    date: { type: Date, required: true },
    options: { type: [betOptionSchema], required: true },
    subGroups: { type: [betSubGroupSchema], default: [] },
    settlementRules: { type: String, default: '' },
    mainMarketTooltip: { type: String, default: '' },
    category: { type: String, default: '' },
    personId: { type: String },
    status: { type: String, enum: ['open', 'pending', 'resolved', 'cancelled'], default: 'open' },
    featuredOrder: { type: Number, default: 0, min: 0, max: 3 },
  },
  { timestamps: true }
)

// Public listings are always filtered by `status` and commonly sorted by createdAt or featuredOrder.
// These indexes let the hot-path queries in routes/public.ts hit a single b-tree scan.
betSchema.index({ status: 1, createdAt: -1 })
betSchema.index({ status: 1, category: 1, createdAt: -1 })
betSchema.index({ status: 1, featuredOrder: 1 })
// The `date` field is used by closeBetsPastDeadline (status:'open', date:{$lte:now})
betSchema.index({ status: 1, date: 1 })

export const Bet = mongoose.model<IBet>('Bet', betSchema)
