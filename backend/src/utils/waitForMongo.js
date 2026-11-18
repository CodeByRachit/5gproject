import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://mongodb:27017/smart_campus_traffic';
const maxAttempts = 30;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkConnection = async () => {
  console.log(`[MongoCheck] Checking connection to: ${uri}`);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log(`[MongoCheck] Successfully reached MongoDB on attempt ${attempt}.`);
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.log(`[MongoCheck] MongoDB not ready (attempt ${attempt}/${maxAttempts}): ${err.message}. Retrying in 2s...`);
      await wait(2000);
    }
  }
  console.error('[MongoCheck] ERROR: Could not connect to MongoDB within 60 seconds.');
  process.exit(1);
};

checkConnection();
