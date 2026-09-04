import db from '../config/db.js';
import { seedDatabase } from './seedData.js';

try {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM users');
    if (total > 0 && !process.argv.includes('--reset')) {
        console.log('Existing users found. Seed was skipped to protect your data.');
        console.log('Use npm run db:reset only when you intend to erase app data and restore the demo.');
    } else {
        await seedDatabase();
    }
} finally {
    await db.end();
}
