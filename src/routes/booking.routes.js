import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createBooking,
  getUserBookings,
  // updateBookingStatus,
  getAllBookings,
  deleteBooking,
  updateBooking,
  getBookingStatistics,
  cancelBooking,
} from "../controllers/booking.controller.js";

const router = express.Router();

router.use(protect);

router.post("/", createBooking);
router.get("/", getAllBookings);
router.get("/my-bookings", getUserBookings);
router.put("/:id", updateBooking);
// router.patch('/:id/status', updateBookingStatus);
router.delete("/:id", deleteBooking);
router.get("/statistics", getBookingStatistics);
router.patch("/:id/cancel", cancelBooking);

export default router;
