import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/auth.js';
let io: Server | undefined;
export const initializeSockets = (server: HttpServer, clientUrl: string) => {
  io = new Server(server, { cors: { origin: clientUrl, credentials: true } });
  io.use((socket, next) => { try { socket.data.auth = verifyAccessToken(socket.handshake.auth?.token); next(); } catch { next(new Error('Unauthorized')); } });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.auth.id}`);
    socket.on('conversation:join', (id: string) => socket.join(`conversation:${id}`));
    socket.on('conversation:leave', (id: string) => socket.leave(`conversation:${id}`));
    socket.on('typing:start', (id: string) => socket.to(`conversation:${id}`).emit('typing:start', { conversationId: id, userId: socket.data.auth.id }));
    socket.on('typing:stop', (id: string) => socket.to(`conversation:${id}`).emit('typing:stop', { conversationId: id, userId: socket.data.auth.id }));
  });
  return io;
};
export const emitToUser = (userId: string, event: string, payload: unknown) => io?.to(`user:${userId}`).emit(event, payload);
export const emitToConversation = (conversationId: string, event: string, payload: unknown) => io?.to(`conversation:${conversationId}`).emit(event, payload);
