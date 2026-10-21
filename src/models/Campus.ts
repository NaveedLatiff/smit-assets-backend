import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICampusContact {
  name?: string;
  email?: string;
  phone?: string;
}

export interface ICampus extends Document {
  name: string;
  code: string;
  city: string;
  address?: string;
  contactPerson?: ICampusContact;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CampusSchema = new Schema<ICampus>(
  {
    name: {
      type: String,
      required: [true, 'Campus name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Campus code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    city: {
      type: String,
      required: [true, 'Campus city is required'],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    contactPerson: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
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

// Virtual relationship to child rooms
CampusSchema.virtual('rooms', {
  ref: 'Room',
  localField: '_id',
  foreignField: 'campusId',
});

export const Campus: Model<ICampus> = mongoose.model<ICampus>('Campus', CampusSchema);
