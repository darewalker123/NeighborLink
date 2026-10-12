import 'dotenv/config';
import { closeDatabase, connectDatabase } from '../config/db.js';
import { allModels, User } from '../models/index.js';
import { seedDatabase } from './seedData.js';

try {
    await connectDatabase();
    for (const model of allModels) await model.syncIndexes();
    const total = await User.countDocuments();
    if (total > 0 && !process.argv.includes('--reset')) {
        console.log('MongoDB is already set up. Existing data was kept.');
        console.log('To intentionally erase all app data and reload demo accounts, run npm run db:reset.');
    } else {
        await seedDatabase();
    }
} catch (error) {
    if (error.name === 'MongooseServerSelectionError') {
        console.error('Cannot connect to MongoDB. Start the MongoDB service and check MONGODB_URI in server/.env.');
    } else {
        console.error(error.message);
    }
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
