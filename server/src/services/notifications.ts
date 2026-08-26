import { prisma } from '../config/prisma.js';
import { emitToUser } from '../sockets/index.js';
export async function notify(userId: string, title: string, body: string, type: string, link?: string) {
  const notification = await prisma.notification.create({ data: { userId, title, body, type, link } });
  emitToUser(userId, 'notification:new', notification);
  return notification;
}
