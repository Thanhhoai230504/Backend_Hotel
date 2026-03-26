import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  deleteUserById,
  getAllUsers,
  getProfile,
  updateProfile,
  updateUserById
} from '../controllers/user.controller.js';

const router = express.Router();

router.use(protect);

// User routes
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Admin only routes
router.get('/', authorize('admin'), getAllUsers);
router.put('/:userId', authorize('admin'), updateUserById);
router.delete('/:userId', authorize('admin'), deleteUserById);

export default router;