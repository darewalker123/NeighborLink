import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNotification } from './notificationHelper.js';
import {
    Booking, Category, Notification, Payment, ProviderProfile, Report, Service,
    User, VerificationRequest
} from '../models/index.js';
import { httpError } from '../utils/helpers.js';

function lastSevenDateKeys() {
    const keys = [];
    for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        keys.push(date.toISOString().slice(0, 10));
    }
    return keys;
}

export async function getOverview(_request, response) {
    const [users, providers, active, completed, payments, reports, bookings, categories, services, notifications] = await Promise.all([
        User.countDocuments(),
        ProviderProfile.countDocuments({ verified: true }),
        Booking.countDocuments({ status: { $in: ['pending', 'accepted', 'in_progress'] } }),
        Booking.countDocuments({ status: 'completed' }),
        Payment.find({ paymentStatus: 'paid' }).lean(),
        Report.countDocuments({ status: 'open' }),
        Booking.find().lean(),
        Category.find().lean(),
        Service.find().lean(),
        Notification.find().sort({ createdAt: -1 }).limit(8).lean()
    ]);

    const dateKeys = lastSevenDateKeys();
    const userRows = await User.find({ createdAt: { $gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) } }).lean();
    const bookingRows = bookings.filter((booking) => booking.createdAt >= new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
    const countBy = (items, field) => items.reduce((map, item) => map.set(item[field], (map.get(item[field]) || 0) + 1), new Map());
    const statuses = [...countBy(bookings, 'status')].map(([name, value]) => ({ name: String(name).replace('_', ' '), value }));
    const servicesByCategory = categories.map((category) => ({ name: category.name, value: services.filter((service) => service.categoryId === category._id).length })).sort((a, b) => b.value - a.value).slice(0, 6);
    const neighborhoods = [...countBy(await User.find().lean(), 'neighborhood')].map(([name, value]) => ({ name: name || 'Not provided', value })).sort((a, b) => b.value - a.value).slice(0, 6);

    return response.json({
        metrics: {
            totalUsers: users,
            verifiedProviders: providers,
            activeBookings: active,
            completedServices: completed,
            totalRevenue: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
            platformRevenue: payments.reduce((sum, payment) => sum + Number(payment.platformFee || 0), 0),
            openDisputes: reports
        },
        charts: {
            userGrowth: dateKeys.map((date) => ({ day: date.slice(5), users: userRows.filter((user) => user.createdAt.toISOString().slice(0, 10) === date).length })),
            bookingGrowth: dateKeys.map((date) => ({
                day: date.slice(5),
                bookings: bookingRows.filter((booking) => booking.createdAt.toISOString().slice(0, 10) === date).length,
                revenue: bookingRows.filter((booking) => booking.createdAt.toISOString().slice(0, 10) === date).reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0)
            })),
            statuses,
            popularServices: servicesByCategory,
            neighborhoods
        },
        recentActivity: notifications.map((row) => ({
            id: row._id,
            action: row.title,
            description: row.message,
            createdAt: row.createdAt,
            admin: { fullName: 'NeighborLink system' }
        }))
    });
}

export async function getUsers(request, response) {
    const search = String(request.query.q || '').trim().toLowerCase();
    const users = await User.find().sort({ createdAt: -1 }).lean();
    const filtered = search ? users.filter((user) => `${user.fullName} ${user.email}`.toLowerCase().includes(search)) : users;
    const providers = await ProviderProfile.find({ userId: { $in: filtered.map((user) => user._id) } }).lean();
    const providerByUser = new Map(providers.map((provider) => [provider.userId, provider]));
    const items = filtered.map((user) => ({
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.isActive ? 'active' : 'suspended',
        neighborhood: user.neighborhood,
        createdAt: user.createdAt,
        providerProfile: providerByUser.has(user._id) ? { verificationStatus: providerByUser.get(user._id).verificationStatus } : null
    }));
    return response.json({ items, pagination: { page: 1, limit: items.length, total: items.length, pages: 1 } });
}

export async function updateUserStatus(request, response) {
    const active = request.body.isActive !== undefined ? Boolean(request.body.isActive) : request.body.status !== 'suspended';
    if (request.params.id === request.user.id && !active) throw httpError(422, 'You cannot suspend your own admin account.');
    const result = await User.updateOne({ _id: request.params.id }, { $set: { isActive: active } });
    if (!result.matchedCount) throw httpError(404, 'User not found.');
    return response.json({ id: request.params.id, status: active ? 'active' : 'suspended' });
}

export async function getVerifications(_request, response) {
    const verifications = await VerificationRequest.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
    const rows = [];
    for (const verification of verifications) {
        const provider = await ProviderProfile.findById(verification.providerId).lean();
        const user = provider ? await User.findById(provider.userId).lean() : null;
        if (!provider || !user) continue;
        rows.push({
            id: verification._id,
            providerId: verification.providerId,
            documentPath: verification.documentPath,
            documentType: verification.documentType,
            status: verification.status,
            createdAt: verification.createdAt,
            user: { id: user._id, fullName: user.fullName, email: user.email },
            bio: provider.bio,
            skills: provider.skills.join(', '),
            experienceYears: provider.experienceYears
        });
    }
    return response.json(rows);
}

export async function decideVerification(request, response) {
    if (request.body.approved === undefined && !['approved', 'rejected'].includes(request.body.status)) throw httpError(422, 'Choose approved or rejected.');
    const approved = request.body.approved === true || request.body.status === 'approved';
    const status = approved ? 'approved' : 'rejected';
    let verification = await VerificationRequest.findById(request.params.id).lean();
    if (!verification) verification = await VerificationRequest.findOne({ providerId: request.params.id, status: 'pending' }).sort({ createdAt: -1 }).lean();
    if (!verification) throw httpError(404, 'Verification request not found.');
    if (verification.status !== 'pending') throw httpError(409, 'This verification has already been reviewed.');
    await VerificationRequest.updateOne({ _id: verification._id }, { $set: { status, adminNote: request.body.note || request.body.adminNote || null, reviewedAt: new Date() } });
    await ProviderProfile.updateOne({ _id: verification.providerId }, { $set: { verified: approved, verificationStatus: approved ? 'verified' : 'rejected' } });
    const provider = await ProviderProfile.findById(verification.providerId).lean();
    await createNotification(provider.userId, 'Verification update', approved ? 'Your provider profile is now verified.' : 'Your verification request was rejected.', 'verification', '/dashboard');
    return response.json({ id: verification._id, status });
}

export async function downloadVerification(request, response) {
    const row = await VerificationRequest.findById(request.params.id).lean();
    if (!row) throw httpError(404, 'Verification document not found.');
    const serverDirectory = fileURLToPath(new URL('../', import.meta.url));
    const storedPath = row.documentPath === 'uploads/verification/demo-ravi-document.pdf' ? 'fixtures/demo-verification.txt' : row.documentPath;
    const documentPath = path.resolve(serverDirectory, storedPath);
    const inUploads = documentPath.startsWith(path.join(serverDirectory, 'uploads') + path.sep);
    const isDemo = documentPath === path.join(serverDirectory, 'fixtures', 'demo-verification.txt');
    if (!inUploads && !isDemo) throw httpError(403, 'Document path is not allowed.');
    if (!fs.existsSync(documentPath)) throw httpError(404, 'This demo document file is not available.');
    return response.download(documentPath);
}

export async function getPayments(_request, response) {
    const payments = await Payment.find().sort({ paidAt: -1 }).lean();
    const rows = [];
    for (const payment of payments) {
        const booking = await Booking.findById(payment.bookingId).lean();
        const service = booking ? await Service.findById(booking.serviceId).lean() : null;
        const customer = await User.findById(payment.customerId).lean();
        const provider = await ProviderProfile.findById(payment.providerId).lean();
        const providerUser = provider ? await User.findById(provider.userId).lean() : null;
        rows.push({
            id: payment._id,
            bookingId: payment.bookingId,
            serviceTitle: service?.title,
            customerName: customer?.fullName,
            providerName: providerUser?.fullName,
            amount: Number(payment.amount),
            platformFee: Number(payment.platformFee),
            providerAmount: Number(payment.providerAmount),
            paymentStatus: payment.paymentStatus,
            paidAt: payment.paidAt
        });
    }
    return response.json(rows);
}

export async function getReports(_request, response) {
    const reports = await Report.find().sort({ createdAt: -1 }).lean();
    const rows = [];
    for (const report of reports) {
        const reporter = await User.findById(report.reporterId).lean();
        const target = report.reportedUserId ? await User.findById(report.reportedUserId).lean() : null;
        rows.push({
            id: report._id,
            bookingId: report.bookingId,
            reason: report.reason,
            description: report.description,
            status: report.status,
            adminNote: report.adminNote,
            createdAt: report.createdAt,
            reporterName: reporter?.fullName,
            reportedUserName: target?.fullName
        });
    }
    return response.json(rows);
}

export async function updateReport(request, response) {
    const allowed = ['open', 'resolved', 'rejected'];
    const status = allowed.includes(request.body.status) ? request.body.status : 'resolved';
    const result = await Report.updateOne({ _id: request.params.id }, { $set: { status, adminNote: request.body.adminNote || request.body.resolution || null } });
    if (!result.matchedCount) throw httpError(404, 'Report not found.');
    return response.json({ id: request.params.id, status });
}
