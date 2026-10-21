import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export enum AssetHistoryAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  ASSIGNED = 'ASSIGNED',
  UNASSIGNED = 'UNASSIGNED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  CONDITION_CHANGED = 'CONDITION_CHANGED',
  LOCATION_CHANGED = 'LOCATION_CHANGED',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED',
  RESTORED = 'RESTORED',
  BULK_IMPORTED = 'BULK_IMPORTED',
}

export interface IAssetHistory extends Document {
  assetId: Types.ObjectId;
  action: AssetHistoryAction;
  performedBy?: Types.ObjectId;
  performedByName?: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  remarks?: string;
  timestamp: Date;
}

const AssetHistorySchema = new Schema<IAssetHistory>(
  {
    assetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(AssetHistoryAction),
      required: true,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    performedByName: {
      type: String,
      trim: true,
    },
    previousValues: {
      type: Schema.Types.Mixed,
    },
    newValues: {
      type: Schema.Types.Mixed,
    },
    remarks: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Query optimization for asset timeline retrieval
AssetHistorySchema.index({ assetId: 1, timestamp: -1 });

export const AssetHistory: Model<IAssetHistory> = mongoose.model<IAssetHistory>(
  'AssetHistory',
  AssetHistorySchema
);
