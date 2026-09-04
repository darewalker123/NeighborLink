import db from '../config/db.js';
import { createNotification } from './notificationHelper.js';
import { createId, httpError } from '../utils/helpers.js';

export async function makeDemoPayment(request, response) {
    const [rows] = await db.query(
        `SELECT b.*, p.user_id AS provider_user_id
         FROM bookings b
         JOIN provider_profiles p ON p.id = b.provider_id
         WHERE b.id = ?`,
        [request.params.id]
    );
    const booking = rows[0];
    if (!booking || booking.customer_id !== request.user.id) {
        throw httpError(404, 'Booking not found.');
    }
    if (booking.status !== 'accepted') {
        throw httpError(409, 'The provider must accept this booking before payment.');
    }
    if (booking.payment_status === 'paid') {
        return response.json({ message: 'This booking is already paid.', alreadyPaid: true });
    }

    const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 10);
    if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) {
        throw httpError(500, 'PLATFORM_FEE_PERCENT must be between 0 and 100.');
    }
    const amount = Number(booking.total_amount);
    const platformFee = Number((amount * feePercent / 100).toFixed(2));
    const providerAmount = Number((amount - platformFee).toFixed(2));

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        // Payment and cancellation share a booking-row lock, keeping the two records consistent.
        const [current] = await connection.query('SELECT status, payment_status FROM bookings WHERE id = ? FOR UPDATE', [booking.id]);
        if (current[0].status !== 'accepted') throw httpError(409, 'This booking is no longer eligible for payment.');
        if (current[0].payment_status === 'paid') {
            await connection.commit();
            return response.json({ message: 'This booking is already paid.', alreadyPaid: true });
        }
        await connection.query(
            `INSERT INTO payments
             (id, booking_id, customer_id, provider_id, amount, platform_fee,
              provider_amount, payment_method, payment_status, paid_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'demo', 'paid', NOW())
             ON DUPLICATE KEY UPDATE payment_status = 'paid', paid_at = NOW()`,
            [createId(), booking.id, booking.customer_id, booking.provider_id, amount, platformFee, providerAmount]
        );
        await connection.query(
            'UPDATE bookings SET payment_status = ? WHERE id = ?',
            ['paid', booking.id]
        );
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    await createNotification(booking.provider_user_id, 'Payment received', `Demo payment of ₹${amount} was recorded.`, 'payment', `/bookings/${booking.id}`);
    await createNotification(booking.customer_id, 'Payment successful', 'Your simulated payment was successful.', 'payment', `/bookings/${booking.id}`);
    return response.json({
        message: 'Simulated payment completed successfully.',
        payment: { amount, platformFee, providerAmount, paymentStatus: 'paid' }
    });
}

export async function prepareDemoPayment(request, response) {
    const [bookings] = await db.query('SELECT customer_id, status FROM bookings WHERE id = ?', [request.params.id]);
    if (!bookings.length || bookings[0].customer_id !== request.user.id) throw httpError(404, 'Booking not found.');
    if (bookings[0].status !== 'accepted') throw httpError(409, 'The provider must accept this booking before payment.');
    return response.json({ demoMode: true, bookingId: request.params.id });
}

export async function getMyPayments(request, response) {
    const condition = request.user.role === 'provider' ? 'pp.user_id = ?' : 'p.customer_id = ?';
    const [rows] = await db.query(
        `SELECT p.*, b.status AS booking_status, s.title AS service_title,
                customer.full_name AS customer_name, provider_user.full_name AS provider_name
         FROM payments p
         JOIN bookings b ON b.id = p.booking_id
         JOIN services s ON s.id = b.service_id
         JOIN users customer ON customer.id = p.customer_id
         JOIN provider_profiles pp ON pp.id = p.provider_id
         JOIN users provider_user ON provider_user.id = pp.user_id
         WHERE ${condition} ORDER BY p.paid_at DESC`,
        [request.user.id]
    );
    return response.json(rows.map((row) => ({
        id: row.id,
        bookingId: row.booking_id,
        serviceTitle: row.service_title,
        customerName: row.customer_name,
        providerName: row.provider_name,
        amount: Number(row.amount),
        platformFee: Number(row.platform_fee),
        providerAmount: Number(row.provider_amount),
        paymentStatus: row.payment_status,
        paidAt: row.paid_at
    })));
}
