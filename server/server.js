import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import communicationRoutes from './routes/communicationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

const app = express();
const port = Number(process.env.PORT || 4000);

if (!process.env.JWT_SECRET) {
    throw new Error('Set JWT_SECRET in server/.env before starting the API.');
}

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_request, response) => {
    await db.query('SELECT 1');
    response.json({ status: 'healthy', service: 'NeighborLink API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api', marketplaceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', reviewRoutes);
app.use('/api', communicationRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(port, () => {
    console.log(`NeighborLink API listening on http://localhost:${port}`);
});

function closeServer() {
    server.close(async () => {
        await db.end();
        process.exit(0);
    });
}

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);

export default app;
