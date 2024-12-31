import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  searchAvailableRooms
} from '../controllers/room.controller.js';

const router = express.Router();

router.get('/available', searchAvailableRooms); 
router.get('/', getRooms);
router.get('/:id', getRoomById);

// Admin only routes
router.use(protect, authorize('admin'));
router.post('/', createRoom);
router.put('/:id', updateRoom);
router.delete('/:id', deleteRoom);

export default router;