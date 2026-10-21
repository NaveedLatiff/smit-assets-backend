import { Router } from 'express';
import {
  createTicket,
  listTickets,
  getTicketById,
  assignTicket,
  updateTicketStatus,
  addComment,
} from '../controllers/ticket.controller';
import { authenticate, requirePermissions } from '../middlewares/auth.middleware';
import { Permission } from '../constants/permissions';

const router = Router();

/**
 * @route   POST /api/tickets
 * @desc    Submit an IT support or equipment maintenance ticket
 * @access  Private (Requires tickets:create)
 */
router.post('/', authenticate, requirePermissions(Permission.TICKETS_CREATE), createTicket);

/**
 * @route   GET /api/tickets
 * @desc    List tickets with role-based visibility and filters
 * @access  Private (Requires tickets:read)
 */
router.get('/', authenticate, requirePermissions(Permission.TICKETS_READ), listTickets);

/**
 * @route   GET /api/tickets/:id
 * @desc    Get detailed ticket view with conversation replies and SLA status
 * @access  Private (Requires tickets:read)
 */
router.get('/:id', authenticate, requirePermissions(Permission.TICKETS_READ), getTicketById);

/**
 * @route   PUT /api/tickets/:id/assign
 * @desc    Assign a ticket to a campus IT technician
 * @access  Private (Requires tickets:assign)
 */
router.put('/:id/assign', authenticate, requirePermissions(Permission.TICKETS_ASSIGN), assignTicket);

/**
 * @route   PUT /api/tickets/:id/status
 * @desc    Update ticket lifecycle status (e.g. IN_PROGRESS, RESOLVED, CLOSED)
 * @access  Private (Requires tickets:update)
 */
router.put('/:id/status', authenticate, requirePermissions(Permission.TICKETS_UPDATE), updateTicketStatus);

/**
 * @route   POST /api/tickets/:id/comments
 * @desc    Add a public reply or internal note to a ticket
 * @access  Private (Requires tickets:read)
 */
router.post('/:id/comments', authenticate, requirePermissions(Permission.TICKETS_READ), addComment);

export default router;
