import mongoose from 'mongoose'

const tapeLineSchema = new mongoose.Schema(
  {
    betShortId: { type: String, required: true, trim: true },
    optionId: { type: String, required: true, trim: true },
  },
  { _id: false }
)

const tapeBlockSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Taśma dnia' },
    lines: { type: [tapeLineSchema], default: [] },
  },
  { _id: false }
)

export type ISiteTapes = {
  key: string
  day: { title: string; lines: { betShortId: string; optionId: string }[] }
  week: { title: string; lines: { betShortId: string; optionId: string }[] }
}

const siteTapesSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true, index: true },
    day: { type: tapeBlockSchema, default: () => ({ title: 'Taśma dnia', lines: [] }) },
    week: { type: tapeBlockSchema, default: () => ({ title: 'Taśma tygodnia', lines: [] }) },
  },
  { timestamps: true }
)

export const SiteTapes = mongoose.model('SiteTapes', siteTapesSchema)

export async function getOrCreateSiteTapes(): Promise<ISiteTapes> {
  const doc = await SiteTapes.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean()
  if (!doc) {
    return {
      key: 'main',
      day: { title: 'Taśma dnia', lines: [] },
      week: { title: 'Taśma tygodnia', lines: [] },
    }
  }
  return {
    key: 'main',
    day: { title: doc.day?.title ?? 'Taśma dnia', lines: doc.day?.lines ?? [] },
    week: { title: doc.week?.title ?? 'Taśma tygodnia', lines: doc.week?.lines ?? [] },
  }
}
