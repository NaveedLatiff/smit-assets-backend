import mongoose, { Document, Model, Schema } from 'mongoose';
import { Permission } from '../constants/permissions';

export interface IRole extends Document {
  name: string;
  displayName: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    permissions: [
      {
        type: String,
        enum: Object.values(Permission),
      },
    ],
    isSystem: {
      type: Boolean,
      default: false,
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

export const Role: Model<IRole> = mongoose.model<IRole>('Role', RoleSchema);
