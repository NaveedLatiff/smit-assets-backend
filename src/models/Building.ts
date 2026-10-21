import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IBuilding extends Document {
  campusId: Types.ObjectId;
  name: string;
  code: string;
  totalFloors?: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BuildingSchema = new Schema<IBuilding>(
  {
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      required: [true, 'Campus reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Building name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Building code is required'],
      trim: true,
      uppercase: true,
    },
    totalFloors: {
      type: Number,
      min: 0,
      default: 1,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure building codes are unique per campus
BuildingSchema.index({ campusId: 1, code: 1 }, { unique: true });

// Virtual to populate rooms within building
BuildingSchema.virtual('rooms', {
  ref: 'Room',
  localField: '_id',
  foreignField: 'buildingId',
});

export const Building: Model<IBuilding> = mongoose.model<IBuilding>('Building', BuildingSchema);
