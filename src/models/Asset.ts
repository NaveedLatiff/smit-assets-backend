import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { AssetCondition, AssetStatus } from '../constants/enums';
import { generateDefaultAssetTag, generateOpaqueQRToken } from '../utils/tokenGenerator';

export interface IAssetLocation {
  campusId: Types.ObjectId;
  buildingId: Types.ObjectId;
  roomId: Types.ObjectId;
}

export interface IAssetAssignment {
  userId?: Types.ObjectId;
  assignedAt?: Date;
  remarks?: string;
}

export interface IAssetFinancials {
  purchaseDate?: Date;
  purchaseCost?: number;
  currency?: string;
  vendor?: string;
  invoiceNumber?: string;
  warrantyExpiryDate?: Date;
}

export interface IAsset extends Document {
  assetTag: string; // Unique human-readable Asset ID (e.g. AST-2026-A1B2C3)
  qrToken: string;  // Opaque, cryptographically secure random token for QR scanning
  name: string;
  categoryId: Types.ObjectId;
  brand?: string;
  modelNumber?: string;
  serialNumber?: string;
  status: AssetStatus;
  condition: AssetCondition;
  location: IAssetLocation;
  assignedTo?: IAssetAssignment;
  specs: Record<string, any>; // Flexible category-specific specifications (e.g. RAM, CPU, MAC)
  financials?: IAssetFinancials;
  images?: string[];
  notes?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssetLocationSchema = new Schema<IAssetLocation>(
  {
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      required: [true, 'Campus reference is required for asset location'],
      index: true,
    },
    buildingId: {
      type: Schema.Types.ObjectId,
      ref: 'Building',
      required: [true, 'Building reference is required for asset location'],
      index: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required for asset location'],
      index: true,
    },
  },
  { _id: false }
);

const AssetAssignmentSchema = new Schema<IAssetAssignment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    assignedAt: {
      type: Date,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const AssetFinancialsSchema = new Schema<IAssetFinancials>(
  {
    purchaseDate: { type: Date },
    purchaseCost: { type: Number, min: 0 },
    currency: { type: String, default: 'PKR', uppercase: true, trim: true },
    vendor: { type: String, trim: true },
    invoiceNumber: { type: String, trim: true },
    warrantyExpiryDate: { type: Date },
  },
  { _id: false }
);

const AssetSchema = new Schema<IAsset>(
  {
    assetTag: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    qrToken: {
      type: String,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'AssetCategory',
      required: [true, 'Asset category reference is required'],
      index: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    modelNumber: {
      type: String,
      trim: true,
    },
    serialNumber: {
      type: String,
      trim: true,
      sparse: true, // Unique only when present
      unique: true,
    },
    status: {
      type: String,
      enum: Object.values(AssetStatus),
      default: AssetStatus.AVAILABLE,
      index: true,
    },
    condition: {
      type: String,
      enum: Object.values(AssetCondition),
      default: AssetCondition.NEW,
      index: true,
    },
    location: {
      type: AssetLocationSchema,
      required: [true, 'Asset location details are required'],
    },
    assignedTo: {
      type: AssetAssignmentSchema,
    },
    // Flexible category-specific specifications schema
    specs: {
      type: Schema.Types.Mixed,
      default: {},
    },
    financials: {
      type: AssetFinancialsSchema,
    },
    images: [{ type: String }],
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save hook: Ensure assetTag and opaque qrToken are automatically assigned if not provided
AssetSchema.pre('validate', function (next) {
  if (!this.qrToken) {
    this.qrToken = generateOpaqueQRToken();
  }
  if (!this.assetTag) {
    this.assetTag = generateDefaultAssetTag();
  }
  next();
});

// Compound indexes for common queries & filtering
AssetSchema.index({ 'location.campusId': 1, status: 1 });
AssetSchema.index({ categoryId: 1, status: 1 });

// Full-text search index across asset identifiers and labels
AssetSchema.index({
  assetTag: 'text',
  name: 'text',
  brand: 'text',
  modelNumber: 'text',
  serialNumber: 'text',
});

export const Asset: Model<IAsset> = mongoose.model<IAsset>('Asset', AssetSchema);
