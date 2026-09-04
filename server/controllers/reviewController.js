import db from '../config/db.js';
import { createNotification } from './notificationHelper.js';
import { createId, httpError } from '../utils/helpers.js';

export async function createReview(request, response) {
    const { bookingId, rating, comment } = request.body;
    const numericRating = Number(rating);
    if (!bookingId || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5 || typeof comment !== 'string' || comment.trim().length < 5 || comment.length > 2000) {
        throw httpError(422, 'Enter a rating from 1 to 5 and a short review.');
    }

    const [bookings] = await db.query(
        `SELECT b.*, p.user_id AS provider_user_id
         FROM bookings b
         JOIN provider_profiles p ON p.id = b.provider_id
         WHERE b.id = ?`,
        [bookingId]
    );
    const booking = bookings[0];
    if (!booking || booking.customer_id !== request.user.id) {
        throw httpError(404, 'Completed booking not found.');
    }
    if (booking.status !== 'completed') {
        throw httpError(409, 'Reviews can only be submitted for completed bookings.');
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(
            `INSERT INTO reviews
             (id, booking_id, customer_id, provider_id, rating, comment)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [createId(), booking.id, request.user.id, booking.provider_id, numericRating, comment.trim()]
        );

        // Recalculate the displayed provider rating from all submitted reviews.
        const [ratingRows] = await connection.query(
            'SELECT AVG(rating) AS average_rating, COUNT(*) AS review_count FROM reviews WHERE provider_id = ?',
            [booking.provider_id]
        );
        await connection.query(
            'UPDATE provider_profiles SET rating = ?, review_count = ? WHERE id = ?',
            [Number(ratingRows[0].average_rating || 0), ratingRows[0].review_count, booking.provider_id]
        );
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            throw httpError(409, 'A review already exists for this booking.');
        }
        throw error;
    } finally {
        connection.release();
    }

    await createNotification(booking.provider_user_id, 'New review', `You received a ${numericRating}-star review.`, 'review', `/providers/${booking.provider_id}`);
    return response.status(201).json({ message: 'Thanks for sharing your experience.' });
}

export async function getProviderReviews(request, response) {
    const [rows] = await db.query(
        `SELECT r.id, r.rating, r.comment, r.created_at,
                u.full_name, u.profile_image
         FROM reviews r JOIN users u ON u.id = r.customer_id
         WHERE r.provider_id = ? ORDER BY r.created_at DESC`,
        [request.params.providerId]
    );
    return response.json(rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
        author: { fullName: row.full_name, avatarUrl: row.profile_image }
    })));
}
