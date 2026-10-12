import { Notification } from '../models/index.js';
import { createId } from '../utils/helpers.js';

export async function createNotification(userId, title, message, type, link = null) {
    await Notification.create({
        _id: createId(),
        userId,
        title,
        message,
        type,
        link
    });
}
