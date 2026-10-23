import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { AssetCondition, TransferStatus } from '../constants/enums';
import { getNextSequentialTag } from './Counter';

export interface IAssetTransfer extends Document {
  transferNumber: string; // e.g. SMIT-TRF-000001
  assetId: Types.ObjectId;
  fromCampusId: Types.ObjectId;
  toCampusId: Types.ObjectId;
  status: TransferStatus;
  quantity: number;
  reason: string;
  notes?: string;

  // Request stage
  requestedBy: Types.ObjectId;
  requestedAt: Date;

  // Approval / Rejection stage
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;

  // Dispatch stage
  dispatchedBy?: Types.ObjectId;
  dispatchedAt?: Date;
  dispatchNotes?: string;

  // Receiving stage
  receivedBy?: Types.ObjectId;
  receivedAt?: Date;
  receivingCondition?: AssetCondition;
  receivingNotes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const AssetTransferSchema = new Schema<IAssetTransfer>(
  {
    transferNumber: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    assetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'Asset reference is required'],
      index: true,
    },
    fromCampusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      required: [true, 'Origin campus is required'],
      index: true,
    },
    toCampusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      required: [true, 'Destination campus is required'],
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TransferStatus),
      default: TransferStatus.PENDING,
      index: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    reason: {
      type: String,
      required: [true, 'Transfer reason is required'],
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    dispatchedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dispatchedAt: {
      type: Date,
    },
    dispatchNotes: {
      type: String,
      trim: true,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    receivedAt: {
      type: Date,
    },
    receivingCondition: {
      type: String,
      enum: Object.values(AssetCondition),
    },
    receivingNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-validate hook: generate sequential transfer number if not set
AssetTransferSchema.pre('validate', async function (next) {
  if (!this.transferNumber) {
    try {
      this.transferNumber = await getNextSequentialTag('SMIT-TRF', 6);
    } catch {
      this.transferNumber = `SMIT-TRF-${Date.now().toString().slice(-6)}`;
    }
  }
  next();
});

// Compound indexes for searching transfers
AssetTransferSchema.index({ fromCampusId: 1, status: 1 });
AssetTransferSchema.index({ toCampusId: 1, status: 1 });
AssetTransferSchema.index({ assetId: 1, status: 1 });

export const AssetTransfer: Model<IAssetTransfer> = mongoose.model<IAssetTransfer>(
  'AssetTransfer',
  AssetTransferSchema
);
