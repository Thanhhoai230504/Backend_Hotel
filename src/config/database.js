import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Clean up stale indexes from old schema versions
    try {
      const bookingsCollection = conn.connection.collection('bookings');
      const indexes = await bookingsCollection.indexes();
      const hasBookingNumber = indexes.some(idx => idx.name === 'bookingNumber_1');
      if (hasBookingNumber) {
        await bookingsCollection.dropIndex('bookingNumber_1');
        console.log('Dropped stale index: bookingNumber_1');
      }
    } catch (indexError) {
      // Index might not exist, ignore
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;