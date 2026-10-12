import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/neighborlink';

export async function connectDatabase() {
    if (mongoose.connection.readyState === 1) return mongoose.connection;
    await mongoose.connect(mongoUri);
    return mongoose.connection;
}

export async function closeDatabase() {
    await mongoose.connection.close();
}

export default mongoose;
