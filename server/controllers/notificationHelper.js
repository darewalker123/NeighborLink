import db from '../config/db.js';
import { createId } from '../utils/helpers.js';

export async function createNotification(userId, title, message, type, link = null) {
    await db.query(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [createId(), userId, title, message, type, link]
    );
}
