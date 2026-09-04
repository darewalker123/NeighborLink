import db from '../config/db.js';
import { createNotification } from './notificationHelper.js';
import { createId, httpError, toSqlDateTime } from '../utils/helpers.js';

function mapBooking(row) {
    return {
        id: row.id,
        scheduledStart: row.scheduled_start,
        scheduledEnd: row.scheduled_end,
        quotedPrice: Number(row.total_amount),
        status: row.status,
        notes: row.notes,
        locationNote: row.address,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        acceptedAt: row.accepted_at,
        completedAt: row.completed_at,
        service: {
            id: row.service_id,
            title: row.service_title,
            description: row.service_description,
            price: Number(row.service_price),
            durationMin: row.duration_minutes,
            category: {
                id: row.category_id,
                name: row.category_name,
                slug: row.category_slug
            }
        },
        customer: {
            id: row.customer_id,
            fullName: row.customer_name,
            avatarUrl: row.customer_image,
            phone: row.customer_phone,
            neighborhood: row.customer_neighborhood
        },
        provider: {
            id: row.provider_id,
            user: {
                id: row.provider_user_id,
                fullName: row.provider_name,
                avatarUrl: row.provider_image,
                phone: row.provider_phone,
                neighborhood: row.provider_neighborhood
            }
        },
        payment: row.payment_id ? {
            status: row.payment_status,
            amount: Number(row.payment_amount),
            paidAt: row.paid_at
        } : null,
        review: row.review_id ? {
            id: row.review_id,
            rating: row.review_rating,
            comment: row.review_comment,
            createdAt: row.review_created_at
        } : null,
        conversation: ['accepted', 'in_progress', 'completed'].includes(row.status)
            ? { id: row.provider_user_id }
            : null
    };
}

const bookingSelect = `
    SELECT b.*, s.title AS service_title, s.description AS service_description,
           s.price AS service_price, s.duration_minutes,
           c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
           customer.full_name AS customer_name, customer.profile_image AS customer_image,
           customer.phone AS customer_phone, customer.neighborhood AS customer_neighborhood,
           provider_user.id AS provider_user_id, provider_user.full_name AS provider_name,
           provider_user.profile_image AS provider_image, provider_user.phone AS provider_phone,
           provider_user.neighborhood AS provider_neighborhood,
           pay.id AS payment_id, pay.payment_status, pay.amount AS payment_amount, pay.paid_at,
           r.id AS review_id, r.rating AS review_rating, r.comment AS review_comment,
           r.created_at AS review_created_at
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    JOIN categories c ON c.id = s.category_id
    JOIN users customer ON customer.id = b.customer_id
    JOIN provider_profiles pp ON pp.id = b.provider_id
    JOIN users provider_user ON provider_user.id = pp.user_id
    LEFT JOIN payments pay ON pay.booking_id = b.id
    LEFT JOIN reviews r ON r.booking_id = b.id`;

async function findBooking(id, connection = db) {
    const [rows] = await connection.query(`${bookingSelect} WHERE b.id = ?`, [id]);
    return rows.length ? mapBooking(rows[0]) : null;
}

function canAccessBooking(booking, user) {
    return user.role === 'admin' || booking.customer.id === user.id || booking.provider.user.id === user.id;
}

async function checkAvailability(providerId, scheduledStart, scheduledEnd, ignoredBookingId = null, connection = db) {
    const startDate = new Date(scheduledStart);
    const dayOfWeek = startDate.getDay();
    const requestedTime = startDate.toTimeString().slice(0, 5);

    const [slots] = await connection.query(
        `SELECT start_time, end_time, is_available FROM availability
         WHERE provider_id = ? AND day_of_week = ?`,
        [providerId, dayOfWeek]
    );
    if (!slots.length || !slots[0].is_available) {
        throw httpError(409, 'The provider is not available on that day.');
    }

    const slotStart = String(slots[0].start_time).slice(0, 5);
    const slotEnd = String(slots[0].end_time).slice(0, 5);
    const endTime = new Date(scheduledEnd).toTimeString().slice(0, 5);
    if (startDate.toDateString() !== new Date(scheduledEnd).toDateString() || requestedTime < slotStart || endTime > slotEnd) {
        throw httpError(409, `Please choose a time between ${slotStart} and ${slotEnd}.`);
    }

    const overlapValues = [providerId, toSqlDateTime(scheduledEnd), toSqlDateTime(scheduledStart)];
    let overlapSql = `SELECT id FROM bookings
        WHERE provider_id = ? AND status IN ('accepted', 'in_progress')
        AND scheduled_start < ? AND scheduled_end > ?`;
    if (ignoredBookingId) {
        overlapSql += ' AND id <> ?';
        overlapValues.push(ignoredBookingId);
    }
    const [overlaps] = await connection.query(overlapSql, overlapValues);
    if (overlaps.length) {
        throw httpError(409, 'This time slot is already booked. Please choose another time.');
    }
}

export async function createBooking(request, response) {
    const { serviceId, scheduledStart, notes, locationNote } = request.body;
    if (!serviceId || !scheduledStart) {
        throw httpError(422, 'Please choose a service, date and time.');
    }

    const [services] = await db.query(
        `SELECT s.*, p.user_id, p.is_accepting_work
         FROM services s JOIN provider_profiles p ON p.id = s.provider_id
         JOIN users u ON u.id = p.user_id
         WHERE s.id = ? AND s.is_active = TRUE AND u.is_active = TRUE`,
        [serviceId]
    );
    const service = services[0];
    if (!service || !service.is_accepting_work) {
        throw httpError(404, 'This service is not currently available.');
    }
    if (service.user_id === request.user.id) {
        throw httpError(422, 'You cannot book your own service.');
    }

    const start = new Date(scheduledStart);
    if (Number.isNaN(start.getTime()) || start <= new Date()) {
        throw httpError(422, 'Please choose a future booking time.');
    }
    const end = new Date(start.getTime() + service.duration_minutes * 60_000);
    await checkAvailability(service.provider_id, start, end);

    const bookingId = createId();
    await db.query(
        `INSERT INTO bookings
         (id, customer_id, provider_id, service_id, scheduled_start, scheduled_end,
          address, notes, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bookingId, request.user.id, service.provider_id, service.id,
            toSqlDateTime(start), toSqlDateTime(end), locationNote || null, notes || null, service.price]
    );
    await createNotification(
        service.user_id,
        'New booking request',
        `A customer requested ${service.title}.`,
        'booking',
        `/bookings/${bookingId}`
    );
    return response.status(201).json(await findBooking(bookingId));
}

export async function getBookings(request, response) {
    const conditions = [];
    const values = [];
    if (request.user.role === 'provider') {
        conditions.push('provider_user.id = ?');
        values.push(request.user.id);
    } else if (request.user.role === 'customer') {
        conditions.push('b.customer_id = ?');
        values.push(request.user.id);
    }
    if (request.query.status) {
        conditions.push('b.status = ?');
        values.push(request.query.status);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db.query(`${bookingSelect}${where} ORDER BY b.scheduled_start DESC`, values);
    const page = Math.max(1, Number(request.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(request.query.limit || 20)));
    const items = rows.map(mapBooking);
    return response.json({
        items: items.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: items.length, pages: Math.ceil(items.length / limit) }
    });
}

export async function getBooking(request, response) {
    const booking = await findBooking(request.params.id);
    if (!booking || !canAccessBooking(booking, request.user)) {
        throw httpError(404, 'Booking not found.');
    }
    if (booking.conversation && booking.provider.user.id === request.user.id) {
        booking.conversation.id = booking.customer.id;
    }
    return response.json(booking);
}

async function providerBooking(id, userId, connection = db) {
    const booking = await findBooking(id, connection);
    if (!booking || booking.provider.user.id !== userId) {
        throw httpError(404, 'Booking not found.');
    }
    return booking;
}

export async function acceptBooking(request, response) {
    const connection = await db.getConnection();
    let booking;
    try {
        await connection.beginTransaction();
        // Serialize accept actions for this provider so simultaneous requests cannot overlap.
        await connection.query('SELECT id FROM provider_profiles WHERE user_id = ? FOR UPDATE', [request.user.id]);
        booking = await providerBooking(request.params.id, request.user.id, connection);
        if (booking.status !== 'pending') throw httpError(409, 'Only pending bookings can be accepted.');
        await checkAvailability(booking.provider.id, booking.scheduledStart, booking.scheduledEnd, booking.id, connection);
        const [result] = await connection.query("UPDATE bookings SET status = 'accepted', accepted_at = NOW() WHERE id = ? AND status = 'pending'", [booking.id]);
        if (!result.affectedRows) throw httpError(409, 'The booking was already updated. Refresh and try again.');
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
    await createNotification(
        booking.customer.id,
        'Booking accepted',
        `${booking.provider.user.fullName} accepted your booking. You can now make the demo payment.`,
        'booking',
        `/bookings/${booking.id}`
    );
    return response.json(await findBooking(booking.id));
}

export async function rejectBooking(request, response) {
    const booking = await providerBooking(request.params.id, request.user.id);
    if (booking.status !== 'pending') {
        throw httpError(409, 'Only pending bookings can be rejected.');
    }
    const [result] = await db.query("UPDATE bookings SET status = 'rejected' WHERE id = ? AND status = 'pending'", [booking.id]);
    if (!result.affectedRows) throw httpError(409, 'The booking was already updated.');
    await createNotification(booking.customer.id, 'Booking declined', 'The provider declined this request.', 'booking', `/bookings/${booking.id}`);
    return response.json(await findBooking(booking.id));
}

export async function cancelBooking(request, response) {
    const booking = await findBooking(request.params.id);
    if (!booking || !canAccessBooking(booking, request.user) || request.user.role === 'admin') {
        throw httpError(404, 'Booking not found.');
    }
    if (!['pending', 'accepted'].includes(booking.status)) {
        throw httpError(409, 'This booking can no longer be cancelled.');
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [result] = await connection.query(
            "UPDATE bookings SET status = 'cancelled', cancelled_by = ?, payment_status = IF(payment_status = 'paid', 'refunded', payment_status) WHERE id = ? AND status IN ('pending', 'accepted')",
            [request.user.id, booking.id]
        );
        if (!result.affectedRows) throw httpError(409, 'This booking can no longer be cancelled.');
        await connection.query("UPDATE payments SET payment_status = 'refunded' WHERE booking_id = ? AND payment_status = 'paid'", [booking.id]);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
    const otherUserId = booking.customer.id === request.user.id
        ? booking.provider.user.id
        : booking.customer.id;
    await createNotification(otherUserId, 'Booking cancelled', 'A booking has been cancelled.', 'booking', `/bookings/${booking.id}`);
    return response.json(await findBooking(booking.id));
}

export async function startBooking(request, response) {
    const booking = await providerBooking(request.params.id, request.user.id);
    if (booking.status !== 'accepted' || booking.payment?.status !== 'paid') {
        throw httpError(409, 'The booking must be accepted and paid before service begins.');
    }
    const [result] = await db.query("UPDATE bookings SET status = 'in_progress' WHERE id = ? AND status = 'accepted' AND payment_status = 'paid'", [booking.id]);
    if (!result.affectedRows) throw httpError(409, 'The booking was already updated.');
    await createNotification(booking.customer.id, 'Service started', 'Your provider started the service.', 'booking', `/bookings/${booking.id}`);
    return response.json(await findBooking(booking.id));
}

export async function completeBooking(request, response) {
    const booking = await providerBooking(request.params.id, request.user.id);
    if (booking.status !== 'in_progress') {
        throw httpError(409, 'Only an in-progress booking can be completed.');
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [result] = await connection.query(
            "UPDATE bookings SET status = ?, completed_at = NOW() WHERE id = ? AND status = 'in_progress'",
            ['completed', booking.id]
        );
        if (!result.affectedRows) throw httpError(409, 'The booking was already completed.');
        await connection.query(
            'UPDATE provider_profiles SET completed_jobs = completed_jobs + 1 WHERE id = ?',
            [booking.provider.id]
        );
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
    await createNotification(booking.customer.id, 'Service completed', 'Please share a review of your experience.', 'booking', `/bookings/${booking.id}`);
    return response.json(await findBooking(booking.id));
}

export { findBooking };
