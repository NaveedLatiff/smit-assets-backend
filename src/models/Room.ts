import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { RoomType } from '../constants/enums';

export interface IRoom extends Document {
  campusId: Types.ObjectId;
  buildingId: Types.ObjectId;
  name: string;
  roomNumber: string;
  floor: number;
  roomType: RoomType;
  capacity?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      required: [true, 'Campus reference is required'],
      index: true,
    },
    buildingId: {
      type: Schema.Types.ObjectId,
      ref: 'Building',
      required: [true, 'Building reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
      uppercase: true,
    },
    floor: {
      type: Number,
      required: [true, 'Floor number is required'],
      default: 0,
    },
    roomType: {
      type: String,
      enum: Object.values(RoomType),
      default: RoomType.CLASSROOM,
      index: true,
    },
    capacity: {
      type: Number,
      min: 0,
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

// Unique roomNumber within a building
RoomSchema.index({ buildingId: 1, roomNumber: 1 }, { unique: true });
RoomSchema.index({ campusId: 1, roomType: 1 });

export const Room: Model<IRoom> = mongoose.model<IRoom>('Room', RoomSchema);
