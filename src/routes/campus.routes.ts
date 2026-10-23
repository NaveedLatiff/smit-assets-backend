import { Router } from 'express';
import { listCampuses, createCampus, updateCampus, deleteCampus } from '../controllers/campus.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @route   GET /api/campuses
 * @desc    List all campuses (Super Admin only)
 * @access  Private
 */
router.get('/', authenticate, listCampuses);

/**
 * @route   POST /api/campuses
 * @desc    Create a new campus branch (Super Admin only)
 * @access  Private
 */
router.post('/', authenticate, createCampus);

/**
 * @route   PUT /api/campuses/:id
 * @desc    Update a campus branch details (Super Admin only)
 * @access  Private
 */
router.put('/:id', authenticate, updateCampus);

/**
 * @route   DELETE /api/campuses/:id
 * @desc    Delete a campus branch (Super Admin only)
 * @access  Private
 */
router.delete('/:id', authenticate, deleteCampus);

export default router;
