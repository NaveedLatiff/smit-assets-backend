import { z } from 'zod';
import { TicketCategory, TicketPriority, TicketStatus } from '../constants/enums';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createTicketSchema = z.object({
  campusId: z
    .string({ required_error: 'Campus ID is required' })
    .regex(objectIdRegex, 'Invalid Campus ObjectId')
    .optional(),
  category: z.nativeEnum(TicketCategory).optional().default(TicketCategory.HARDWARE),
  priority: z.nativeEnum(TicketPriority).optional().default(TicketPriority.P3_MEDIUM),
  subject: z
    .string({ required_error: 'Subject is required' })
    .min(3, 'Subject must be at least 3 characters')
    .max(200, 'Subject cannot exceed 200 characters'),
  description: z
    .string({ required_error: 'Description is required' })
    .min(5, 'Description must be at least 5 characters')
    .max(3000, 'Description cannot exceed 3000 characters'),
  linkedAssetId: z.string().regex(objectIdRegex, 'Invalid Linked Asset ObjectId').optional(),
});

export const assignTicketSchema = z.object({
  technicianId: z
    .string({ required_error: 'Technician User ID is required' })
    .regex(objectIdRegex, 'Invalid Technician User ObjectId'),
});

export const updateTicketStatusSchema = z
  .object({
    status: z.nativeEnum(TicketStatus, {
      required_error: 'Status is required',
    }),
    resolutionNotes: z.string().max(2000, 'Resolution notes cannot exceed 2000 characters').optional(),
  })
  .refine(
    (data) => {
      if (data.status === TicketStatus.RESOLVED) {
        return !!data.resolutionNotes && data.resolutionNotes.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Resolution notes are required when marking a ticket as RESOLVED',
      path: ['resolutionNotes'],
    }
  );

export const addCommentSchema = z.object({
  message: z
    .string({ required_error: 'Comment message is required' })
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters'),
  isInternal: z.boolean().optional().default(false),
});

export const queryTicketSchema = z.object({
  page: z.string().optional().default('1').transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z.string().optional().default('10').transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 10))),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  campusId: z.string().optional(),
  technicianId: z.string().optional(),
  requesterId: z.string().optional(),
  linkedAssetId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type QueryTicketInput = z.infer<typeof queryTicketSchema>;
