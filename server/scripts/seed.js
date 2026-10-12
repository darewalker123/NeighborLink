import 'dotenv/config';
import { closeDatabase, connectDatabase } from '../config/db.js';
import { User } from '../models/index.js';
import { seedDatabase } from './seedData.js';

try {
    await connectDatabase();
    const total = await User.countDocuments();
    if (total > 0 && !process.argv.includes('--reset')) {
        console.log('Existing users found. Seed was skipped to protect your data.');
        console.log('Run npm run db:reset only when you intend to erase app data and restore the demo.');
    } else {
        await seedDatabase();
    }
} finally {
    await closeDatabase();
}
