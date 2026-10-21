import { Request, Response, NextFunction } from 'express';
import { Ticket } from '../models/Ticket';
import { Asset } from '../models/Asset';
import { Campus } from '../models/Campus';
import { User } from '../models/User';
import { AssetHistory, AssetHistoryAction } from '../models/AssetHistory';
import { AssetStatus, SystemRole, TicketStatus } from '../constants/enums';
import {
  createTicketSchema,
  assignTicketSchema,
  updateTicketStatusSchema,
  addCommentSchema,
  queryTicketSchema,
} from '../validators/ticket.validator';

/**
 * Submit a new IT support / maintenance ticket
 * POST /api/tickets
 */
export const createTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = createTicketSchema.parse(req.body);
    const userId = req.user!._id;

    // Determine campus: from input, or fallback to requester's assigned campus
    let campusId = input.campusId;
    if (!campusId) {
      if (req.user?.campusScope && req.user.campusScope.length > 0) {
        campusId = req.user.campusScope[0];
      }
    }

    if (!campusId) {
      res.status(400).json({
        success: false,
        message: 'Campus ID is required to create a ticket.',
      });
      return;
    }

    // Verify Campus exists
    const campus = await Campus.findOne({ _id: campusId, isActive: true });
    if (!campus) {
      res.status(404).json({ success: false, message: 'Campus not found or inactive.' });
      return;
    }

    // Verify Linked Asset if provided
    let asset = null;
    if (input.linkedAssetId) {
      asset = await Asset.findOne({ _id: input.linkedAssetId, isDeleted: false });
      if (!asset) {
        res.status(404).json({ success: false, message: 'Linked asset not found or retired.' });
        return;
      }

      // If user is Employee, ensure the asset is assigned to them or located at their campus
      if (req.user?.role.name === SystemRole.EMPLOYEE) {
        const isAssignedToUser = asset.assignedTo?.userId?.toString() === userId;
        const isAtUserCampus = req.user.campusScope.includes(asset.location.campusId.toString());
        if (!isAssignedToUser && !isAtUserCampus) {
          res.status(403).json({
            success: false,
            message: 'You can only link assets currently assigned to you or located at your campus.',
          });
          return;
        }
      }
    }

    // Create the Ticket
    const ticket = await Ticket.create({
      requester: userId,
      campusId,
      category: input.category,
      priority: input.priority,
      status: TicketStatus.OPEN,
      subject: input.subject,
      description: input.description,
      linkedAssetId: asset?._id,
      comments: [
        {
          sender: userId,
          senderName: req.user!.name,
          senderRole: req.user!.role.name,
          message: input.description,
          isInternal: false,
          createdAt: new Date(),
        },
      ],
    });

    // If an asset is linked, log ticket reference in AssetHistory
    if (asset) {
      await AssetHistory.create({
        assetId: asset._id,
        action: AssetHistoryAction.MAINTENANCE,
        performedBy: userId,
        performedByName: req.user!.name,
        newValues: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          category: ticket.category,
          priority: ticket.priority,
        },
        remarks: `Support Ticket ${ticket.ticketNumber} opened: ${ticket.subject}`,
      });
    }

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('requester', 'name email department designation phone')
      .populate('campusId', 'name code city address')
      .populate('linkedAssetId', 'assetTag name brand modelNumber status condition');

    res.status(201).json({
      success: true,
      message: `Support ticket ${ticket.ticketNumber} created successfully.`,
      data: populatedTicket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List tickets with filters and campus/role scoping
 * GET /api/tickets
 */
export const listTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = queryTicketSchema.parse(req.query);

    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.technicianId) {
      filter.assignedTechnicianId = query.technicianId;
    }
    if (query.requesterId) {
      filter.requester = query.requesterId;
    }
    if (query.linkedAssetId) {
      filter.linkedAssetId = query.linkedAssetId;
    }

    // Role-based visibility scoping
    const isEmployee = req.user?.role.name === SystemRole.EMPLOYEE;
    if (isEmployee) {
      // Employees only view tickets they requested
      filter.requester = req.user!._id;
    } else if (!req.user?.isGlobalScope) {
      // Campus technicians / managers view tickets in their campus or assigned to them
      filter.$or = [
        { campusId: { $in: req.user?.campusScope || [] } },
        { assignedTechnicianId: req.user!._id },
      ];
    } else if (query.campusId) {
      filter.campusId = query.campusId;
    }

    // Full text search
    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { ticketNumber: searchRegex },
        { subject: searchRegex },
        { description: searchRegex },
      ];
    }

    const skip = (query.page - 1) * query.limit;

    const [tickets, totalCount] = await Promise.all([
      Ticket.find(filter)
        .populate('requester', 'name email department designation')
        .populate('campusId', 'name code city')
        .populate('assignedTechnicianId', 'name email phone')
        .populate('linkedAssetId', 'assetTag name brand modelNumber status')
        .sort({ [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(query.limit),
      Ticket.countDocuments(filter),
    ]);

    // For employees, sanitize internal comments from response
    const sanitizedTickets = tickets.map((t) => {
      const doc = t.toObject();
      if (isEmployee && doc.comments) {
        doc.comments = doc.comments.filter((c: any) => !c.isInternal);
      }
      return doc;
    });

    res.status(200).json({
      success: true,
      data: sanitizedTickets,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / query.limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get ticket details by ID with threaded conversation
 * GET /api/tickets/:id
 */
export const getTicketById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const ticket = await Ticket.findById(id)
      .populate('requester', 'name email department designation phone')
      .populate('campusId', 'name code city address')
      .populate('assignedTechnicianId', 'name email phone department')
      .populate('linkedAssetId', 'assetTag name brand modelNumber status condition location')
      .populate('comments.sender', 'name email');

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found.' });
      return;
    }

    const isEmployee = req.user?.role.name === SystemRole.EMPLOYEE;

    // Check authority: employee can view their own; campus staff must have campus authority
    if (isEmployee) {
      const requesterId = (ticket.requester as any)?._id?.toString() || ticket.requester?.toString();
      if (requesterId !== req.user!._id) {
        res.status(403).json({ success: false, message: 'Access denied: You can only view your own tickets.' });
        return;
      }
    } else if (!req.user?.isGlobalScope) {
      const ticketCampusId = (ticket.campusId as any)?._id?.toString() || ticket.campusId?.toString();
      const isAssignedTech = ticket.assignedTechnicianId?.toString() === req.user!._id;
      if (!req.user?.campusScope.includes(ticketCampusId) && !isAssignedTech) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority over tickets in this campus.',
        });
        return;
      }
    }

    const ticketDoc = ticket.toObject();

    // Check SLA breach status dynamically
    if (
      ticket.targetResolutionDeadline &&
      new Date(ticket.targetResolutionDeadline).getTime() < Date.now() &&
      ticket.status !== TicketStatus.RESOLVED &&
      ticket.status !== TicketStatus.CLOSED
    ) {
      ticketDoc.isSlaBreached = true;
    }

    // Hide internal comments from employees
    if (isEmployee && ticketDoc.comments) {
      ticketDoc.comments = ticketDoc.comments.filter((c: any) => !c.isInternal);
    }

    res.status(200).json({
      success: true,
      data: ticketDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign a ticket to a campus IT technician
 * PUT /api/tickets/:id/assign
 */
export const assignTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const input = assignTicketSchema.parse(req.body);

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found.' });
      return;
    }

    // Campus authority check if not global scope
    if (!req.user?.isGlobalScope) {
      if (!req.user?.campusScope.includes(ticket.campusId.toString())) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority to assign tickets in this campus.',
        });
        return;
      }
    }

    // Verify technician exists and is active
    const technician = await User.findById(input.technicianId).populate('role');
    if (!technician || !technician.isActive) {
      res.status(404).json({
        success: false,
        message: 'Technician not found or user account is deactivated.',
      });
      return;
    }

    ticket.assignedTechnicianId = technician._id as any;
    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.ASSIGNED;
    }

    if (!ticket.firstRespondedAt) {
      ticket.firstRespondedAt = new Date();
    }

    // Add internal log comment
    ticket.comments.push({
      sender: req.user!._id as any,
      senderName: req.user!.name,
      senderRole: req.user!.role.name,
      message: `Ticket assigned to technician ${technician.name}`,
      isInternal: true,
      createdAt: new Date(),
    });

    await ticket.save();

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('requester', 'name email department')
      .populate('campusId', 'name code city')
      .populate('assignedTechnicianId', 'name email phone')
      .populate('linkedAssetId', 'assetTag name');

    res.status(200).json({
      success: true,
      message: `Ticket ${ticket.ticketNumber} successfully assigned to ${technician.name}.`,
      data: populatedTicket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update ticket lifecycle status (IN_PROGRESS, PENDING_PARTS, RESOLVED, CLOSED)
 * Automatically transitions linked asset to UNDER_REPAIR / IN_MAINTENANCE and updates AssetHistory
 * PUT /api/tickets/:id/status
 */
export const updateTicketStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const input = updateTicketStatusSchema.parse(req.body);

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found.' });
      return;
    }

    // Authority check
    if (!req.user?.isGlobalScope) {
      const isAssigned = ticket.assignedTechnicianId?.toString() === req.user!._id;
      const hasCampusAuthority = req.user?.campusScope.includes(ticket.campusId.toString());
      if (!isAssigned && !hasCampusAuthority) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority to update this ticket status.',
        });
        return;
      }
    }

    const previousTicketStatus = ticket.status;
    const newStatus = input.status;

    ticket.status = newStatus;

    if (newStatus === TicketStatus.RESOLVED) {
      ticket.resolutionNotes = input.resolutionNotes;
      ticket.resolvedAt = new Date();
      ticket.resolvedBy = req.user!._id as any;
    } else if (newStatus === TicketStatus.CLOSED) {
      ticket.closedAt = new Date();
      ticket.closedBy = req.user!._id as any;
    }

    if (!ticket.firstRespondedAt) {
      ticket.firstRespondedAt = new Date();
    }

    // Add status audit comment
    ticket.comments.push({
      sender: req.user!._id as any,
      senderName: req.user!.name,
      senderRole: req.user!.role.name,
      message: `Status updated from ${previousTicketStatus} to ${newStatus}.${input.resolutionNotes ? ` Resolution: ${input.resolutionNotes}` : ''}`,
      isInternal: false,
      createdAt: new Date(),
    });

    await ticket.save();

    // INTEGRATION WITH ASSET STATUS & ASSET HISTORY:
    if (ticket.linkedAssetId) {
      const asset = await Asset.findById(ticket.linkedAssetId);
      if (asset && !asset.isDeleted) {
        if (newStatus === TicketStatus.IN_PROGRESS || newStatus === TicketStatus.PENDING_PARTS) {
          // Put asset under repair if not already
          if (asset.status !== AssetStatus.UNDER_REPAIR) {
            const prevStatus = asset.status;
            asset.status = AssetStatus.UNDER_REPAIR;
            asset.updatedBy = req.user!._id as any;
            await asset.save();

            await AssetHistory.create({
              assetId: asset._id,
              action: AssetHistoryAction.MAINTENANCE,
              performedBy: req.user!._id,
              performedByName: req.user!.name,
              previousValues: { status: prevStatus },
              newValues: { status: AssetStatus.UNDER_REPAIR, ticketNumber: ticket.ticketNumber },
              remarks: `Asset placed under repair for Ticket ${ticket.ticketNumber}: ${ticket.subject}`,
            });
          }
        } else if (newStatus === TicketStatus.RESOLVED || newStatus === TicketStatus.CLOSED) {
          // Restore asset from repair
          if (asset.status === AssetStatus.UNDER_REPAIR || asset.status === AssetStatus.IN_MAINTENANCE) {
            const restoredStatus = asset.assignedTo?.userId ? AssetStatus.ASSIGNED : AssetStatus.AVAILABLE;
            asset.status = restoredStatus;
            asset.updatedBy = req.user!._id as any;
            await asset.save();

            await AssetHistory.create({
              assetId: asset._id,
              action: AssetHistoryAction.MAINTENANCE,
              performedBy: req.user!._id,
              performedByName: req.user!.name,
              previousValues: { status: AssetStatus.UNDER_REPAIR },
              newValues: { status: restoredStatus, ticketNumber: ticket.ticketNumber },
              remarks: `Repair completed and verified for Ticket ${ticket.ticketNumber}. Resolution: ${input.resolutionNotes || 'Resolved'}`,
            });
          }
        }
      }
    }

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('requester', 'name email department')
      .populate('campusId', 'name code city')
      .populate('assignedTechnicianId', 'name email phone')
      .populate('linkedAssetId', 'assetTag name status condition');

    res.status(200).json({
      success: true,
      message: `Ticket ${ticket.ticketNumber} status updated to ${newStatus}.`,
      data: populatedTicket,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Post a reply or internal note to a ticket
 * POST /api/tickets/:id/comments
 */
export const addComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const input = addCommentSchema.parse(req.body);

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found.' });
      return;
    }

    const isEmployee = req.user?.role.name === SystemRole.EMPLOYEE;

    // Authorization check
    if (isEmployee) {
      if (ticket.requester.toString() !== req.user!._id) {
        res.status(403).json({ success: false, message: 'Access denied: You can only reply to your own tickets.' });
        return;
      }
      // Employees cannot post internal notes
      input.isInternal = false;
    } else if (!req.user?.isGlobalScope) {
      const hasCampusAuthority = req.user?.campusScope.includes(ticket.campusId.toString());
      const isAssigned = ticket.assignedTechnicianId?.toString() === req.user!._id;
      if (!hasCampusAuthority && !isAssigned) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority to comment on this ticket.',
        });
        return;
      }
    }

    // Set first responded timestamp on first staff comment
    if (!ticket.firstRespondedAt && !isEmployee) {
      ticket.firstRespondedAt = new Date();
    }

    ticket.comments.push({
      sender: req.user!._id as any,
      senderName: req.user!.name,
      senderRole: req.user!.role.name,
      message: input.message,
      isInternal: input.isInternal ?? false,
      createdAt: new Date(),
    });

    await ticket.save();

    res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      data: ticket.comments[ticket.comments.length - 1],
    });
  } catch (error) {
    next(error);
  }
};
