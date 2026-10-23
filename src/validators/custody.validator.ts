import { z } from 'zod';
import { AssetCondition } from '../constants/enums';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const assignAssetSchema = z.object({
  assetId: z
    .string({ required_error: 'Asset ID is required' })
    .regex(objectIdRegex, 'Invalid Asset ObjectId'),
  userId: z
    .string({ required_error: 'Target User / Employee is required' })
    .min(1, 'Target User is required'),
  expectedReturnDate: z.string().datetime({ message: 'Invalid ISO date string for expected return date' }).optional(),
  quantity: z.number().int().min(1).optional().default(1),
  remarks: z.string().max(500, 'Remarks cannot exceed 500 characters').optional(),
});

export const returnAssetSchema = z.object({
  assetId: z
    .string({ required_error: 'Asset ID is required' })
    .regex(objectIdRegex, 'Invalid Asset ObjectId'),
  condition: z.nativeEnum(AssetCondition).optional(),
  remarks: z.string().max(500, 'Remarks cannot exceed 500 characters').optional(),
});

export type AssignAssetInput = z.infer<typeof assignAssetSchema>;
export type ReturnAssetInput = z.infer<typeof returnAssetSchema>;
