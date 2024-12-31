import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getHotelInfo,
  setupHotel,
  updateHotelInfo
} from '../controllers/hotel.controller.js';

const router = express.Router();

router.get('/', getHotelInfo);
router.post('/setup', protect, authorize('admin'), setupHotel);
router.put('/', protect, authorize('admin'), updateHotelInfo);

export default router;