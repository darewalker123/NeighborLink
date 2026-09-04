import db from '../config/db.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNotification } from './notificationHelper.js';
import { httpError } from '../utils/helpers.js';

export async function getOverview(_request, response) {
    const results = await Promise.all([
        db.query('SELECT COUNT(*) AS total FROM users'),
        db.query('SELECT COUNT(*) AS total FROM provider_profiles WHERE verified = TRUE'),
        db.query("SELECT COUNT(*) AS total FROM bookings WHERE status IN ('pending', 'accepted', 'in_progress')"),
        db.query("SELECT COUNT(*) AS total FROM bookings WHERE status = 'completed'"),
        db.query("SELECT COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(platform_fee), 0) AS fee FROM payments WHERE payment_status = 'paid'"),
        db.query("SELECT COUNT(*) AS total FROM reports WHERE status = 'open'"),
        db.query('SELECT status AS name, COUNT(*) AS value FROM bookings GROUP BY status'),
        db.query(`SELECT c.name, COUNT(s.id) AS value FROM categories c
                  LEFT JOIN services s ON s.category_id = c.id
                  GROUP BY c.id, c.name ORDER BY value DESC LIMIT 6`),
        db.query(`SELECT COALESCE(neighborhood, 'Not provided') AS name, COUNT(*) AS value
                  FROM users GROUP BY neighborhood ORDER BY value DESC LIMIT 6`),
        db.query(`SELECT DATE(created_at) AS day, COUNT(*) AS users
                  FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                  GROUP BY DATE(created_at)`),
        db.query(`SELECT DATE(created_at) AS day, COUNT(*) AS bookings,
                         COALESCE(SUM(total_amount), 0) AS revenue
                  FROM bookings WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                  GROUP BY DATE(created_at)`),
        db.query(`SELECT id, title, message, created_at
                  FROM notifications ORDER BY created_at DESC LIMIT 8`)
    ]);

    const dataRows = results.map((result) => result[0]);
    const [users, providers, active, completed, money, reports, statuses,
        popularServices, neighborhoods, userGrowthRows, bookingGrowthRows, activityRows] = dataRows;

    const dateKeys = [];
    for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        dateKeys.push(date.toISOString().slice(0, 10));
    }
    const dayValue = (value) => String(value).slice(0, 10);

    return response.json({
        metrics: {
            totalUsers: users[0].total,
            verifiedProviders: providers[0].total,
            activeBookings: active[0].total,
            completedServices: completed[0].total,
            totalRevenue: Number(money[0].total),
            platformRevenue: Number(money[0].fee),
            openDisputes: reports[0].total
        },
        charts: {
            userGrowth: dateKeys.map((date) => ({
                day: date.slice(5),
                users: userGrowthRows.find((row) => dayValue(row.day) === date)?.users || 0
            })),
            bookingGrowth: dateKeys.map((date) => {
                const row = bookingGrowthRows.find((item) => dayValue(item.day) === date);
                return { day: date.slice(5), bookings: row?.bookings || 0, revenue: Number(row?.revenue || 0) };
            }),
            statuses: statuses.map((row) => ({ name: row.name.replace('_', ' '), value: row.value })),
            popularServices,
            neighborhoods
        },
        recentActivity: activityRows.map((row) => ({
            id: row.id,
            action: row.title,
            description: row.message,
            createdAt: row.created_at,
            admin: { fullName: 'NeighborLink system' }
        }))
    });
}

export async function getUsers(request, response) {
    const search = String(request.query.q || '').trim();
    const values = [];
    let where = '';
    if (search) {
        where = ' WHERE u.full_name LIKE ? OR u.email LIKE ?';
        values.push(`%${search}%`, `%${search}%`);
    }
    const [rows] = await db.query(
        `SELECT u.id, u.full_name, u.email, u.role, u.is_active,
                u.neighborhood, u.created_at, p.verification_status
         FROM users u LEFT JOIN provider_profiles p ON p.user_id = u.id
         ${where} ORDER BY u.created_at DESC`,
        values
    );
    const items = rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        status: row.is_active ? 'active' : 'suspended',
        neighborhood: row.neighborhood,
        createdAt: row.created_at,
        providerProfile: row.verification_status ? { verificationStatus: row.verification_status } : null
    }));
    return response.json({
        items,
        pagination: { page: 1, limit: items.length, total: items.length, pages: 1 }
    });
}

export async function updateUserStatus(request, response) {
    const active = request.body.isActive !== undefined
        ? Boolean(request.body.isActive)
        : request.body.status !== 'suspended';
    if (request.params.id === request.user.id && !active) {
        throw httpError(422, 'You cannot suspend your own admin account.');
    }
    const [result] = await db.query('UPDATE users SET is_active = ? WHERE id = ?', [active, request.params.id]);
    if (!result.affectedRows) {
        throw httpError(404, 'User not found.');
    }
    return response.json({ id: request.params.id, status: active ? 'active' : 'suspended' });
}

export async function getVerifications(_request, response) {
    const [rows] = await db.query(
        `SELECT v.*, p.user_id, u.full_name, u.email, p.bio, p.skills, p.experience_years
         FROM verification_requests v
         JOIN provider_profiles p ON p.id = v.provider_id
         JOIN users u ON u.id = p.user_id
         WHERE v.status = 'pending' ORDER BY v.created_at DESC`
    );
    return response.json(rows.map((row) => ({
        id: row.id,
        providerId: row.provider_id,
        documentPath: row.document_path,
        documentType: row.document_type,
        status: row.status,
        createdAt: row.created_at,
        user: { id: row.user_id, fullName: row.full_name, email: row.email },
        bio: row.bio,
        skills: row.skills,
        experienceYears: row.experience_years
    })));
}

export async function decideVerification(request, response) {
    if (request.body.approved === undefined && !['approved', 'rejected'].includes(request.body.status)) {
        throw httpError(422, 'Choose approved or rejected.');
    }
    const approved = request.body.approved === true || request.body.status === 'approved';
    const status = approved ? 'approved' : 'rejected';
    let [verifications] = await db.query('SELECT * FROM verification_requests WHERE id = ?', [request.params.id]);
    if (!verifications.length) {
        [verifications] = await db.query(
            "SELECT * FROM verification_requests WHERE provider_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
            [request.params.id]
        );
    }
    const verification = verifications[0];
    if (!verification) {
        throw httpError(404, 'Verification request not found.');
    }
    if (verification.status !== 'pending') throw httpError(409, 'This verification has already been reviewed.');

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(
            `UPDATE verification_requests SET status = ?, admin_note = ?, reviewed_at = NOW()
             WHERE id = ?`,
            [status, request.body.note || request.body.adminNote || null, verification.id]
        );
        await connection.query(
            `UPDATE provider_profiles SET verified = ?, verification_status = ? WHERE id = ?`,
            [approved, approved ? 'verified' : 'rejected', verification.provider_id]
        );
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    const [providers] = await db.query('SELECT user_id FROM provider_profiles WHERE id = ?', [verification.provider_id]);
    await createNotification(
        providers[0].user_id,
        'Verification update',
        approved ? 'Your provider profile is now verified.' : 'Your verification request was rejected.',
        'verification',
        '/dashboard'
    );
    return response.json({ id: verification.id, status });
}

export async function downloadVerification(request, response) {
    const [rows] = await db.query('SELECT document_path FROM verification_requests WHERE id = ?', [request.params.id]);
    if (!rows.length) throw httpError(404, 'Verification document not found.');
    const serverDirectory = fileURLToPath(new URL('../', import.meta.url));
    // Older demo seeds referenced a nonexistent PDF; provide the clearly labelled sample.
    const storedPath = rows[0].document_path === 'uploads/verification/demo-ravi-document.pdf'
        ? 'fixtures/demo-verification.txt' : rows[0].document_path;
    const documentPath = path.resolve(serverDirectory, storedPath);
    const inUploads = documentPath.startsWith(path.join(serverDirectory, 'uploads') + path.sep);
    const isDemo = documentPath === path.join(serverDirectory, 'fixtures', 'demo-verification.txt');
    if (!inUploads && !isDemo) throw httpError(403, 'Document path is not allowed.');
    if (!fs.existsSync(documentPath)) throw httpError(404, 'This demo document file is not available.');
    return response.download(documentPath);
}

export async function getPayments(_request, response) {
    const [rows] = await db.query(
        `SELECT p.*, s.title AS service_title, customer.full_name AS customer_name,
                provider_user.full_name AS provider_name
         FROM payments p
         JOIN bookings b ON b.id = p.booking_id
         JOIN services s ON s.id = b.service_id
         JOIN users customer ON customer.id = p.customer_id
         JOIN provider_profiles pp ON pp.id = p.provider_id
         JOIN users provider_user ON provider_user.id = pp.user_id
         ORDER BY p.paid_at DESC`
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

export async function getReports(_request, response) {
    const [rows] = await db.query(
        `SELECT r.*, reporter.full_name AS reporter_name, target.full_name AS target_name
         FROM reports r
         JOIN users reporter ON reporter.id = r.reporter_id
         LEFT JOIN users target ON target.id = r.reported_user_id
         ORDER BY r.created_at DESC`
    );
    return response.json(rows.map((row) => ({
        id: row.id,
        bookingId: row.booking_id,
        reason: row.reason,
        description: row.description,
        status: row.status,
        adminNote: row.admin_note,
        createdAt: row.created_at,
        reporterName: row.reporter_name,
        reportedUserName: row.target_name
    })));
}

export async function updateReport(request, response) {
    const allowed = ['open', 'resolved', 'rejected'];
    const status = allowed.includes(request.body.status) ? request.body.status : 'resolved';
    const [result] = await db.query(
        'UPDATE reports SET status = ?, admin_note = ? WHERE id = ?',
        [status, request.body.adminNote || request.body.resolution || null, request.params.id]
    );
    if (!result.affectedRows) {
        throw httpError(404, 'Report not found.');
    }
    return response.json({ id: request.params.id, status });
}
