import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  deleteUserById,
  getAllUsers,
  getProfile,
  updateProfile,
  updateUserById
} from '../controllers/user.controller.js';

const router = express.Router();

router.use(protect);



router.get('/', getAllUsers);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/:userId', updateUserById);
router.delete('/:userId', deleteUserById);

export default router;