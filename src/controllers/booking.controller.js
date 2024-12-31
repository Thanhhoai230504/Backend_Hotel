import Booking from "../models/Booking.js";
import Room from "../models/Room.js";

export const createBooking = async (req, res) => {
  try {
    const { roomId, checkIn, checkOut } = req.body;

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

    // Create booking
    const booking = await Booking.create({
      user: req.user._id,
      room: roomId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      totalPrice,
      status: "confirmed", // Set initial status as confirmed
    });

    await Room.findByIdAndUpdate(roomId, { isAvailable: false });
    // Check and update room availability for rooms with ended bookings
    const endedBookings = await Booking.find({
      status: "confirmed",
      checkOut: { $lt: new Date() },
    });

    for (const endedBooking of endedBookings) {
      // Check if there are any active bookings for this room
      const activeBookings = await Booking.findOne({
        room: endedBooking.room,
        status: "confirmed",
        checkOut: { $gt: new Date() },
      });

      // If no active bookings exist, set room to available
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

    // Fields that are allowed to be updated
    const allowedUpdates = ["checkIn", "checkOut", "status", "paymentStatus"];
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
      const validPaymentStatuses = ["pending", "completed", "failed"];
      if (!validPaymentStatuses.includes(updates.paymentStatus)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status. Payment status must be one of: pending, completed, failed",
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


