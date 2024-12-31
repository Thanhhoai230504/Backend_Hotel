import mongoose from 'mongoose';

const hotelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  amenities: [{
    type: String
  }],
  isConfigured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Ensure only one hotel document exists
hotelSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('Hotel').countDocuments();
    if (count > 0) {
      throw new Error('Only one hotel can exist in the system');
    }
  }
  next();
});

const Hotel = mongoose.model('Hotel', hotelSchema);
export default Hotel;