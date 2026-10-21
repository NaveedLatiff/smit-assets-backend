import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Permission } from '../constants/permissions';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  phone?: string;
  department?: string;
  designation?: string;
  role: Types.ObjectId;
  campusScope: Types.ObjectId[];
  isGlobalScope: boolean;
  customPermissions: Permission[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'User email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'User role reference is required'],
      index: true,
    },
    // Campus scoping: which campuses this user has authorization over.
    // If empty and isGlobalScope is false, user has no campus administrative authority.
    campusScope: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Campus',
      },
    ],
    // If true, user can access all campuses regardless of campusScope list (e.g. SUPER_ADMIN)
    isGlobalScope: {
      type: Boolean,
      default: false,
    },
    // Granular permissions explicitly granted to this individual user on top of role permissions
    customPermissions: [
      {
        type: String,
        enum: Object.values(Permission),
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Method to verify password
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.passwordHash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Helpful index for querying campus users
UserSchema.index({ campusScope: 1, isActive: 1 });

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
