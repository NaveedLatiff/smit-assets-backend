import { z } from 'zod';
import { AssetCondition, TransferStatus } from '../constants/enums';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const requestTransferSchema = z.object({
  assetId: z
    .string({ required_error: 'Asset ID is required' })
    .regex(objectIdRegex, 'Invalid Asset ObjectId'),
  toCampusId: z
    .string({ required_error: 'Destination Campus ID is required' })
    .regex(objectIdRegex, 'Invalid Destination Campus ObjectId'),
  reason: z
    .string({ required_error: 'Transfer reason is required' })
    .min(3, 'Reason must be at least 3 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
  quantity: z.number().int().min(1).max(1000).optional().default(1),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

export const approveTransferSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']).optional(),
    approved: z.boolean().optional(),
    rejectionReason: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
  })
  .transform((data) => {
    let resolvedAction = data.action;
    if (!resolvedAction && data.approved !== undefined) {
      resolvedAction = data.approved ? 'APPROVE' : 'REJECT';
    }
    return {
      action: (resolvedAction || 'APPROVE') as 'APPROVE' | 'REJECT',
      rejectionReason: data.rejectionReason || (resolvedAction === 'REJECT' ? 'Rejected by administrator' : undefined),
      notes: data.notes,
    };
  });

export const dispatchTransferSchema = z.object({
  dispatchNotes: z.string().max(1000, 'Dispatch notes cannot exceed 1000 characters').optional(),
});

export const receiveTransferSchema = z.object({
  receivingCondition: z.nativeEnum(AssetCondition).optional(),
  receivingNotes: z.string().max(1000, 'Receiving notes cannot exceed 1000 characters').optional(),
});

export const queryTransferSchema = z.object({
  page: z.string().optional().default('1').transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z.string().optional().default('10').transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 10))),
  status: z.nativeEnum(TransferStatus).optional(),
  campusId: z.string().optional(),
  assetId: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type RequestTransferInput = z.infer<typeof requestTransferSchema>;
export type ApproveTransferInput = z.infer<typeof approveTransferSchema>;
export type DispatchTransferInput = z.infer<typeof dispatchTransferSchema>;
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;
export type QueryTransferInput = z.infer<typeof queryTransferSchema>;
