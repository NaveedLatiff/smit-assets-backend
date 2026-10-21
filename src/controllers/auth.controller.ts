import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { IRole } from '../models/Role';
import { Campus } from '../models/Campus';
import { getRoleByName } from '../services/role.service';
import { signToken } from '../utils/jwt';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import { SystemRole } from '../constants/enums';

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user, assign role and campus scoping, return JWT
 * @access  Public
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.format(),
      });
      return;
    }

    const {
      name,
      email,
      password,
      phone,
      department,
      designation,
      role: roleName,
      campusScope,
      isGlobalScope,
    } = parseResult.data;

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already registered
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: `A user with email '${normalizedEmail}' already exists.`,
      });
      return;
    }

    // Resolve Role by name (or default to EMPLOYEE)
    const roleDoc = await getRoleByName(roleName || SystemRole.EMPLOYEE);
    if (!roleDoc) {
      res.status(400).json({
        success: false,
        message: `Invalid role specified: '${roleName}'.`,
      });
      return;
    }

    // Validate campusScope IDs if provided
    const validCampusIds: mongoose.Types.ObjectId[] = [];
    if (campusScope && campusScope.length > 0) {
      for (const idStr of campusScope) {
        if (!mongoose.Types.ObjectId.isValid(idStr)) {
          res.status(400).json({
            success: false,
            message: `Invalid Campus ID in campusScope: '${idStr}'`,
          });
          return;
        }
        validCampusIds.push(new mongoose.Types.ObjectId(idStr));
      }
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // SUPER_ADMIN automatically has global scope
    const isGlobal = roleDoc.name === SystemRole.SUPER_ADMIN ? true : isGlobalScope;

    const newUser = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      phone,
      department,
      designation,
      role: roleDoc._id,
      campusScope: validCampusIds,
      isGlobalScope: isGlobal,
      isActive: true,
    });

    const populatedUser = await User.findById(newUser._id)
      .populate<{ role: IRole }>('role')
      .populate('campusScope', 'name code city');

    const token = signToken({
      userId: newUser._id.toString(),
      email: newUser.email,
      role: roleDoc.name,
      isGlobalScope: newUser.isGlobalScope,
      campusScope: newUser.campusScope.map((c) => c.toString()),
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: populatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user credentials and issue JWT
 * @access  Public
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.format(),
      });
      return;
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Query user and explicitly select passwordHash
    const user = await User.findOne({ email: normalizedEmail })
      .select('+passwordHash')
      .populate<{ role: IRole }>('role')
      .populate('campusScope', 'name code city');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact your administrator.',
      });
      return;
    }

    // Verify password hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    const roleDoc = user.role as unknown as IRole;
    const roleName = roleDoc?.name || 'EMPLOYEE';

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: roleName,
      isGlobalScope: user.isGlobalScope,
      campusScope: user.campusScope.map((c: any) => (c._id || c).toString()),
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user profile with roles, permissions, and campus scoping
 * @access  Private (Requires Bearer Token)
 */
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const user = await User.findById(req.user._id)
      .populate<{ role: IRole }>('role')
      .populate('campusScope', 'name code city address');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};
