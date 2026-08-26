import { createServer } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { initializeSockets } from './sockets/index.js';
import { prisma } from './config/prisma.js';
const server = createServer(app); initializeSockets(server, env.CLIENT_URL);
server.listen(env.PORT, () => console.log(`NeighborLink API listening on http://localhost:${env.PORT}`));
const close = async () => { await prisma.$disconnect(); server.close(() => process.exit(0)); }; process.on('SIGINT', close); process.on('SIGTERM', close);
