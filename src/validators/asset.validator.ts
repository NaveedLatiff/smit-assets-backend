import { z } from 'zod';
import { AssetCondition, AssetStatus } from '../constants/enums';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createAssetSchema = z.object({
  name: z.string({ required_error: 'Asset name is required' }).min(2, 'Name must be at least 2 characters'),
  categoryId: z.string({ required_error: 'Category ID is required' }).regex(objectIdRegex, 'Invalid Category ObjectId'),
  brand: z.string().optional(),
  modelNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  assetTag: z.string().optional(), // if omitted, auto-generated sequentially
  status: z.nativeEnum(AssetStatus).optional().default(AssetStatus.AVAILABLE),
  condition: z.nativeEnum(AssetCondition).optional().default(AssetCondition.NEW),
  location: z.object({
    campusId: z.string({ required_error: 'Campus ID is required' }).regex(objectIdRegex, 'Invalid Campus ObjectId'),
    buildingId: z.string({ required_error: 'Building ID is required' }).regex(objectIdRegex, 'Invalid Building ObjectId'),
    roomId: z.string({ required_error: 'Room ID is required' }).regex(objectIdRegex, 'Invalid Room ObjectId'),
  }),
  assignedTo: z
    .object({
      userId: z.string().regex(objectIdRegex, 'Invalid User ObjectId').optional(),
      remarks: z.string().optional(),
    })
    .optional(),
  specs: z.record(z.any()).optional().default({}),
  financials: z
    .object({
      purchaseDate: z.string().or(z.date()).optional(),
      purchaseCost: z.number().min(0).optional(),
      currency: z.string().optional().default('PKR'),
      vendor: z.string().optional(),
      invoiceNumber: z.string().optional(),
      warrantyExpiryDate: z.string().or(z.date()).optional(),
    })
    .optional(),
  notes: z.string().optional(),
  images: z.array(z.string()).optional(),
});

export const updateAssetSchema = createAssetSchema.partial();

export const queryAssetSchema = z.object({
  page: z.string().optional().default('1').transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z.string().optional().default('10').transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 10))),
  campusId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  condition: z.nativeEnum(AssetCondition).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const bulkImportSchema = z.object({
  assets: z.array(createAssetSchema).min(1, 'At least one asset is required for import'),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type QueryAssetInput = z.infer<typeof queryAssetSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
