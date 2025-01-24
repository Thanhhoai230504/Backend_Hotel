import Booking from "../models/Booking.js";
import Room from "../models/Room.js";

export const createBooking = async (req, res) => {
  try {
    const { roomId, checkIn, checkOut, fullName, phoneNumber, email, notes } =
      req.body;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate dates
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Please use YYYY-MM-DD format",
      });
    }

    // Validate check-in is before check-out
    if (checkInDate >= checkOutDate) {
      return res.status(400).json({
        success: false,
        message: "Check-in date must be before check-out date",
      });
    }

    // Check if room exists and is available
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    if (!room.isAvailable) {
      return res.status(400).json({
        success: false,
        message: "This room is not available for booking",
      });
    }

    // Check for existing bookings in the requested date range
    const existingBooking = await Booking.findOne({
      room: roomId,
      status: { $ne: "cancelled" }, // Exclude cancelled bookings
      $or: [
        {
          checkIn: { $lt: checkOutDate },
          checkOut: { $gt: checkInDate },
        },
      ],
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "Room is already booked for the selected dates",
      });
    }

    // Calculate total price
    const days = Math.ceil(
      (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
    );
    const totalPrice = days * room.price;

    // Create booking with new fields
    const booking = await Booking.create({
      user: req.user._id,
      room: roomId,
      fullName,
      phoneNumber,
      email,
      notes,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      totalPrice,
      status: "confirmed",
    });

    await Room.findByIdAndUpdate(roomId, { isAvailable: false });

    // Check and update room availability for rooms with ended bookings
    const endedBookings = await Booking.find({
      status: "confirmed",
      checkOut: { $lt: new Date() },
    });

    for (const endedBooking of endedBookings) {
      const activeBookings = await Booking.findOne({
        room: endedBooking.room,
        status: "confirmed",
        checkOut: { $gt: new Date() },
      });

      if (!activeBookings) {
        await Room.findByIdAndUpdate(endedBooking.room, { isAvailable: true });
      }
    }

    // Populate booking with user and room details
    const populatedBooking = await Booking.findById(booking._id)
      .populate({
        path: "user",
        select: "name email",
      })
      .populate({
        path: "room",
        select: "type price images capacity amenities description number",
      });

    res.status(201).json({
      success: true,
      data: populatedBooking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllBookings = async (req, res) => {
  try {
    // Lấy thông tin phân trang từ query params, đặt giá trị mặc định nếu không có
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Tính toán giá trị skip
    const skip = (page - 1) * limit;

    // Đếm tổng số booking
    const totalBookings = await Booking.countDocuments();

    // Lấy danh sách booking với phân trang
    const bookings = await Booking.find()
      .populate("room")
      .populate("user", "firstName lastName email")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalBookings / limit),
        totalItems: totalBookings,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("room")
      .sort("-createdAt");

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Add the new fields to allowed updates
    const allowedUpdates = [
      "checkIn",
      "checkOut",
      "status",
      "paymentStatus",
      "fullName",
      "phoneNumber",
      "email",
      "notes",
    ];
    const updateFields = {};

    // Filter out invalid update fields
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updateFields[key] = updates[key];
      }
    });

    // Validate status if it's being updated
    if (updates.status) {
      const validStatuses = ["pending", "confirmed", "cancelled"];
      if (!validStatuses.includes(updates.status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Status must be one of: pending, confirmed, cancelled",
        });
      }
    }

    // Validate paymentStatus if it's being updated
    if (updates.paymentStatus) {
      const validPaymentStatuses = ["pending", "paid", "failed"];
      if (!validPaymentStatuses.includes(updates.paymentStatus)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status. Payment status must be one of: pending, completed, failed",
        });
      }
    }

    // Validate email format if it's being updated
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }
    }

    // Validate phone number if it's being updated
    if (updates.phoneNumber) {
      const phoneRegex = /^[0-9]{10,}$/;
      if (!phoneRegex.test(updates.phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format. Must be at least 10 digits",
        });
      }
    }

    // Check if booking exists
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `No booking found with ID: ${id}`,
      });
    }

    // If dates are being updated, check room availability
    if (updates.checkIn || updates.checkOut) {
      const checkIn = updates.checkIn || booking.checkIn;
      const checkOut = updates.checkOut || booking.checkOut;

      const existingBooking = await Booking.findOne({
        _id: { $ne: id }, // exclude current booking
        room: booking.room,
        status: "confirmed",
        $or: [
          {
            checkIn: { $lte: checkOut },
            checkOut: { $gte: checkIn },
          },
        ],
      });

      if (existingBooking) {
        return res.status(400).json({
          success: false,
          message: "Room is not available for the selected dates",
        });
      }

      // Recalculate total price if dates changed
      const room = await Room.findById(booking.room);
      const days = Math.ceil(
        (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)
      );
      updateFields.totalPrice = days * room.price;
    }

    // Update booking
    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate("room")
      .populate("user", "name email");

    res.json({
      success: true,
      message: "Booking updated successfully",
      data: updatedBooking,
    });
  } catch (error) {
    // Handle invalid ObjectId format
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// export const updateBookingStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;

//     // Validate status
//     const validStatuses = ['pending', 'confirmed', 'cancelled'];
//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid status. Status must be one of: pending, confirmed, cancelled'
//       });
//     }

//     // Check if booking exists
//     const booking = await Booking.findById(id);
//     if (!booking) {
//       return res.status(404).json({
//         success: false,
//         message: `No booking found with ID: ${id}`
//       });
//     }

//     // Update status
//     booking.status = status;
//     await booking.save();

//     // Return updated booking with populated fields
//     const updatedBooking = await Booking.findById(id)
//       .populate('room')
//       .populate('user', 'name email');

//     res.json({
//       success: true,
//       message: `Booking status updated to ${status}`,
//       data: updatedBooking
//     });
//   } catch (error) {
//     // Handle invalid ObjectId format
//     if (error.name === 'CastError') {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid booking ID format'
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

export const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Lưu roomId từ booking trước khi xóa
    const roomId = booking.room;

    // Xóa booking
    await Booking.findByIdAndDelete(req.params.id);

    // Kiểm tra xem còn booking nào khác cho phòng này không
    const otherBookings = await Booking.findOne({
      room: roomId,
      status: { $ne: "cancelled" },
      $or: [
        {
          checkIn: { $lte: new Date() },
          checkOut: { $gte: new Date() },
        },
      ],
    });

    // Nếu không còn booking nào khác, cập nhật isAvailable thành true
    if (!otherBookings) {
      await Room.findByIdAndUpdate(roomId, { isAvailable: true });
    }

    res.json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBookingStatistics = async (req, res) => {
  try {
    // Get current date and set to start of day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get start of week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Get start of month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get statistics for today with payment status
    const todayStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: "$paymentStatus",
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
        },
      },
    ]);

    // Get statistics for this week with payment status
    const weekStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfWeek },
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: "$paymentStatus",
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
        },
      },
    ]);

    // Get statistics for this month with payment status
    const monthStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: "$paymentStatus",
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
        },
      },
    ]);

    // Get daily statistics for the current month (for chart data)
    const dailyStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            paymentStatus: "$paymentStatus",
          },
          bookings: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ]);

    // Process statistics by payment status
    const processStats = (stats) => {
      const paid = stats.find((stat) => stat._id === "paid") || {
        totalBookings: 0,
        totalRevenue: 0,
      };
      const pending = stats.find((stat) => stat._id === "pending") || {
        totalBookings: 0,
        totalRevenue: 0,
      };
      const failed = stats.find((stat) => stat._id === "failed") || {
        totalBookings: 0,
        totalRevenue: 0,
      };

      return {
        totalBookings:
          paid.totalBookings + pending.totalBookings + failed.totalBookings,
        totalRevenue:
          paid.totalRevenue + pending.totalRevenue + failed.totalRevenue,
        paid: {
          bookings: paid.totalBookings,
          revenue: paid.totalRevenue,
        },
        pending: {
          bookings: pending.totalBookings,
          revenue: pending.totalRevenue,
        },
        failed: {
          bookings: failed.totalBookings,
          revenue: failed.totalRevenue,
        },
      };
    };

    // Process daily stats
    const processedDailyStats = dailyStats.reduce((acc, stat) => {
      const date = stat._id.date;
      if (!acc[date]) {
        acc[date] = {
          date,
          bookings: 0,
          revenue: 0,
          paidBookings: 0,
          paidRevenue: 0,
          pendingBookings: 0,
          pendingRevenue: 0,
          failedBookings: 0,
          failedRevenue: 0,
        };
      }

      switch (stat._id.paymentStatus) {
        case "paid":
          acc[date].paidBookings = stat.bookings;
          acc[date].paidRevenue = stat.revenue;
          break;
        case "pending":
          acc[date].pendingBookings = stat.bookings;
          acc[date].pendingRevenue = stat.revenue;
          break;
        case "failed":
          acc[date].failedBookings = stat.bookings;
          acc[date].failedRevenue = stat.revenue;
          break;
      }

      acc[date].bookings += stat.bookings;
      acc[date].revenue += stat.revenue;

      return acc;
    }, {});

    // Format response
    const response = {
      today: processStats(todayStats),
      thisWeek: processStats(weekStats),
      thisMonth: processStats(monthStats),
      dailyStats: Object.values(processedDailyStats),
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error getting booking statistics:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

  
    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if the booking belongs to the user
    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this booking",
      });
    }

    // Check if booking is already cancelled
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "This booking is already cancelled",
      });
    }

    // Check if check-in date has passed
    if (new Date(booking.checkIn) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a booking after check-in date",
      });
    }

    // Update booking status to cancelled
    booking.status = "cancelled";
    await booking.save();

    // Update room availability
    const roomId = booking.room;
    const activeBookings = await Booking.findOne({
      room: roomId,
      status: "confirmed",
      $or: [
        {
          checkIn: { $lte: new Date() },
          checkOut: { $gte: new Date() },
        },
      ],
    });

    if (!activeBookings) {
      await Room.findByIdAndUpdate(roomId, { isAvailable: true });
    }

    // Return cancelled booking with populated fields
    const cancelledBooking = await Booking.findById(id)
      .populate("room")
      .populate("user", "firstName lastName email");

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      data: cancelledBooking,
    });
  } catch (error) {
    // Handle invalid ObjectId format
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format",
      });
    }

    console.error("Error cancelling booking:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
