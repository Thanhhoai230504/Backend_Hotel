import Room from '../models/Room.js';
import Booking from '../models/Booking.js'; 
export const createRoom = async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json({
      success: true,
      data: room
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: `Phòng số "${req.body.number}" đã tồn tại. Vui lòng dùng số phòng khác.`
      });
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getRooms = async (req, res) => {
  try {
    // Get page and limit from query params, set defaults if not provided
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;
    
    // Get total count of rooms
    const totalRooms = await Room.countDocuments();
    
    // Get paginated rooms
    const rooms = await Room.find()
      .skip(skip)
      .limit(limit);
    
    res.json({
      success: true,
      data: rooms,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRooms / limit),
        totalItems: totalRooms,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false, 
      message: error.message
    });
  }
};
export const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    res.json({
      success: true,
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    res.json({
      success: true,
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const searchAvailableRooms = async (req, res) => {
  try {
    const { checkIn, checkOut, capacity, minPrice, maxPrice } = req.query;

    // Validate dates
    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both checkIn and checkOut dates'
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate date format
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD format'
      });
    }

    // Validate check-in is before check-out
    if (checkInDate >= checkOutDate) {
      return res.status(400).json({
        success: false,
        message: 'Check-in date must be before check-out date'
      });
    }

    // Find all booked rooms for the specified period
    const bookedRooms = await Booking.find({
      status: { $ne: 'cancelled' }, // Exclude cancelled bookings
      $or: [
        {
          checkIn: { $lt: checkOutDate },
          checkOut: { $gt: checkInDate }
        }
      ]
    }).distinct('room');

    // Build query for available rooms
    let query = {
      _id: { $nin: bookedRooms }, // Exclude booked rooms
    };

    // Add capacity filter if provided
    if (capacity) {
      const capacityNum = parseInt(capacity);
      if (!isNaN(capacityNum) && capacityNum > 0) {
        query.capacity = { $gte: capacityNum };
      }
    }

    // Add price range filter if provided
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Find available rooms
    const availableRooms = await Room.find(query);

    return res.json({
      success: true,
      count: availableRooms.length,
      data: availableRooms
    });

  } catch (error) {
    console.error('Search available rooms error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error searching for available rooms',
      error: error.message
    });
  }
};

// Lấy danh sách ngày đã đặt của 1 phòng
export const getBookedDates = async (req, res) => {
  try {
    const { id } = req.params;

    const bookings = await Booking.find({
      room: id,
      status: { $nin: ['cancelled', 'no_show', 'checked_out'] },
    }).select('checkIn checkOut');

    // Trả về mảng các khoảng ngày đã đặt
    const bookedRanges = bookings.map(b => ({
      checkIn: b.checkIn,
      checkOut: b.checkOut,
    }));

    res.json({
      success: true,
      data: bookedRanges,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy trạng thái sử dụng phòng hiện tại (dựa trên booking)
export const getRoomOccupancy = async (req, res) => {
  try {
    const now = new Date();

    // Tìm tất cả booking đang active (confirmed hoặc checked_in) có ngày hiện tại nằm trong khoảng checkIn-checkOut
    const activeBookings = await Booking.find({
      status: { $in: ['confirmed', 'checked_in', 'pending'] },
      checkIn: { $lte: now },
      checkOut: { $gte: now },
    }).select('room status');

    // Tạo map roomId -> status
    const occupancyMap = {};
    activeBookings.forEach(booking => {
      // Ưu tiên: checked_in > confirmed > pending
      const currentStatus = occupancyMap[booking.room.toString()];
      if (!currentStatus ||
          (booking.status === 'checked_in') ||
          (booking.status === 'confirmed' && currentStatus !== 'checked_in')) {
        occupancyMap[booking.room.toString()] = booking.status;
      }
    });

    res.json({
      success: true,
      data: occupancyMap,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};