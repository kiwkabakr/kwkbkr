import mongoose, { Schema, Document } from 'mongoose'

export interface IPerson extends Document {
  name: string
  pfp?: string
}

const personSchema = new Schema<IPerson>(
  {
    name: { type: String, required: true },
    pfp: { type: String },
  },
  { timestamps: true }
)

export const Person = mongoose.model<IPerson>('Person', personSchema)
