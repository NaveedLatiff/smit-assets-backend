import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICounter {
  _id: string; // Counter identifier, e.g. "SMIT-AST"
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

export const Counter: Model<ICounter> = mongoose.model<ICounter>('Counter', CounterSchema);

/**
 * Atomically increments and returns the next formatted sequential tag.
 * e.g., getNextSequentialTag("SMIT-AST", 6) -> "SMIT-AST-000001"
 */
export const getNextSequentialTag = async (
  prefix: string = 'SMIT-AST',
  digits: number = 6
): Promise<string> => {
  const counter = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const formattedNumber = String(counter.seq).padStart(digits, '0');
  return `${prefix}-${formattedNumber}`;
};
