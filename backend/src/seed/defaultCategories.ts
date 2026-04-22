import { Category } from '../models'

const DEFAULT_NAMES = ['Polityka', 'Sport', 'Trending'] as const

/** Ensures baseline categories exist for admin + public filters. */
export async function seedDefaultCategories() {
  await Promise.all(
    DEFAULT_NAMES.map(name =>
      Category.updateOne(
        { name },
        { $setOnInsert: { name, autoCreated: false } },
        { upsert: true },
      ),
    ),
  )
}
