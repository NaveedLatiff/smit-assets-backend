import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { TicketCategory, TicketPriority, TicketStatus } from '../constants/enums';
import { getNextSequentialTag } from './Counter';

export interface ITicketComment {
  _id?: Types.ObjectId;
  sender: Types.ObjectId;
  senderName: string;
  senderRole?: string;
  message: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface ITicket extends Document {
  ticketNumber: string; // e.g. SMIT-IT-2026-000001
  requester: Types.ObjectId;
  campusId: Types.ObjectId;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTechnicianId?: Types.ObjectId;
  linkedAssetId?: Types.ObjectId;
  subject: string;
  description: string;
  comments: ITicketComment[];
  resolutionNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  closedAt?: Date;
  closedBy?: Types.ObjectId;

  // SLA tracking
  firstResponseDeadline: Date;
  firstRespondedAt?: Date;
  targetResolutionDeadline: Date;
  isSlaBreached: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const TicketCommentSchema = new Schema<ITicketComment>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderRole: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const TicketSchema = new Schema<ITicket>(
  {
    ticketNumber: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester reference is required'],
      index: true,
    },
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      required: [true, 'Campus reference is required'],
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(TicketCategory),
      default: TicketCategory.HARDWARE,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      default: TicketPriority.P3_MEDIUM,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.OPEN,
      index: true,
    },
    assignedTechnicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    linkedAssetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Ticket subject is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Ticket description is required'],
      trim: true,
    },
    comments: [TicketCommentSchema],
    resolutionNotes: {
      type: String,
      trim: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    closedAt: {
      type: Date,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // SLA Deadlines
    firstResponseDeadline: {
      type: Date,
      required: true,
    },
    firstRespondedAt: {
      type: Date,
    },
    targetResolutionDeadline: {
      type: Date,
      required: true,
    },
    isSlaBreached: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-validate hook to generate sequential ticket number and calculate SLA deadlines if not set
TicketSchema.pre('validate', async function (next) {
  if (!this.ticketNumber) {
    const year = new Date().getFullYear();
    try {
      this.ticketNumber = await getNextSequentialTag(`SMIT-IT-${year}`, 6);
    } catch {
      this.ticketNumber = `SMIT-IT-${year}-${Date.now().toString().slice(-6)}`;
    }
  }

  // Calculate default SLA based on priority if not already explicitly provided
  if (!this.firstResponseDeadline || !this.targetResolutionDeadline) {
    const now = this.createdAt ? new Date(this.createdAt).getTime() : Date.now();
    let responseHours = 8;
    let resolutionHours = 48;

    switch (this.priority) {
      case TicketPriority.P1_CRITICAL:
        responseHours = 1;
        resolutionHours = 4;
        break;
      case TicketPriority.P2_HIGH:
        responseHours = 4;
        resolutionHours = 24;
        break;
      case TicketPriority.P3_MEDIUM:
        responseHours = 8;
        resolutionHours = 48;
        break;
      case TicketPriority.P4_LOW:
        responseHours = 24;
        resolutionHours = 72;
        break;
    }

    if (!this.firstResponseDeadline) {
      this.firstResponseDeadline = new Date(now + responseHours * 60 * 60 * 1000);
    }
    if (!this.targetResolutionDeadline) {
      this.targetResolutionDeadline = new Date(now + resolutionHours * 60 * 60 * 1000);
    }
  }

  next();
});

// Compound indexes for searching and filtering tickets
TicketSchema.index({ campusId: 1, status: 1 });
TicketSchema.index({ assignedTechnicianId: 1, status: 1 });
TicketSchema.index({ requester: 1, createdAt: -1 });
TicketSchema.index({ linkedAssetId: 1, status: 1 });
TicketSchema.index({
  subject: 'text',
  description: 'text',
  ticketNumber: 'text',
});

export const Ticket: Model<ITicket> = mongoose.model<ITicket>('Ticket', TicketSchema);
