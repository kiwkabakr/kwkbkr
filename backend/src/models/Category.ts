import mongoose, { Schema, Document } from 'mongoose'

export interface ICategory extends Document {
  name: string
  autoCreated: boolean
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    autoCreated: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export const Category = mongoose.model<ICategory>('Category', categorySchema)
