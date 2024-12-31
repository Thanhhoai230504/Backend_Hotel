import Hotel from '../models/Hotel.js';

export const getHotelInfo = async (req, res) => {
  try {
    const hotel = await Hotel.findOne();
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel information not found'
      });
    }
    res.json({
      success: true,
      data: hotel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const setupHotel = async (req, res) => {
  try {
    const hotelExists = await Hotel.findOne();
    if (hotelExists) {
      return res.status(400).json({
        success: false,
        message: 'Hotel is already configured'
      });
    }

    const hotel = await Hotel.create({
      ...req.body,
      isConfigured: true
    });

    res.status(201).json({
      success: true,
      data: hotel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateHotelInfo = async (req, res) => {
  try {
    const hotel = await Hotel.findOne();
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel information not found'
      });
    }

    Object.assign(hotel, req.body);
    await hotel.save();

    res.json({
      success: true,
      data: hotel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};