import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { CustomFieldType } from '../constants/enums';

export interface ISpecDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  unit?: string;
  required: boolean;
  options?: string[]; // for SELECT type
  defaultValue?: any;
}

export interface IAssetCategory extends Document {
  name: string;
  code: string;
  description?: string;
  parentCategoryId?: Types.ObjectId;
  tagPrefix: string;
  specDefinitions: ISpecDefinition[];
  depreciationYears?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SpecDefinitionSchema = new Schema<ISpecDefinition>(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(CustomFieldType),
      default: CustomFieldType.STRING,
    },
    unit: {
      type: String,
      trim: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: [{ type: String, trim: true }],
    defaultValue: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const AssetCategorySchema = new Schema<IAssetCategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Category code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    parentCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'AssetCategory',
      default: null,
      index: true,
    },
    tagPrefix: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: 'AST',
    },
    specDefinitions: [SpecDefinitionSchema],
    depreciationYears: {
      type: Number,
      min: 0,
      default: 3,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for sub-categories
AssetCategorySchema.virtual('subCategories', {
  ref: 'AssetCategory',
  localField: '_id',
  foreignField: 'parentCategoryId',
});

export const AssetCategory: Model<IAssetCategory> = mongoose.model<IAssetCategory>(
  'AssetCategory',
  AssetCategorySchema
);
