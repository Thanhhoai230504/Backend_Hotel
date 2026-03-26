import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  createBooking,
  getUserBookings,
  getAllBookings,
  deleteBooking,
  updateBooking,
  getBookingStatistics,
  cancelBooking,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  noShowBooking,
} from "../controllers/booking.controller.js";

const router = express.Router();

router.use(protect);

// User routes
router.post("/", createBooking);
router.get("/my-bookings", getUserBookings);
router.patch("/:id/cancel", cancelBooking);

// Admin only routes
router.get("/statistics", authorize("admin"), getBookingStatistics);
router.get("/", authorize("admin"), getAllBookings);
router.put("/:id", authorize("admin"), updateBooking);
router.delete("/:id", authorize("admin"), deleteBooking);
router.patch("/:id/confirm", authorize("admin"), confirmBooking);
router.patch("/:id/check-in", authorize("admin"), checkInBooking);
router.patch("/:id/check-out", authorize("admin"), checkOutBooking);
router.patch("/:id/no-show", authorize("admin"), noShowBooking);

export default router;
