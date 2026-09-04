// A small, repeatable integration check against the running API and local MySQL.
// Only the uniquely named accounts created by this run are removed afterwards.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import db from '../config/db.js';

const baseUrl = process.env.TEST_API_URL || 'http://localhost:4000/api';
const suffix = randomUUID().slice(0, 8);
const userIds = [];
let providerId;
let checks = 0;

async function api(label, method, route, token, body, expected = 200) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${baseUrl}${route}`, {
        method, headers,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
    });
    const data = response.headers.get('content-type')?.includes('application/json')
        ? await response.json() : await response.arrayBuffer();
    assert.equal(response.status, expected, `${label}: ${JSON.stringify(data)}`);
    checks += 1;
    console.log(`PASS ${label}`);
    return data;
}

async function register(name) {
    const session = await api(`Register ${name}`, 'POST', '/auth/register', null, {
        fullName: `Workflow ${name}`, email: `workflow-${name}-${suffix}@neighborlink.local`,
        password: 'WorkflowTest@123', neighborhood: 'Test neighborhood', city: 'Bengaluru'
    }, 201);
    userIds.push(session.user.id);
    return session;
}

async function cleanup() {
    if (!userIds.length) return;
    if (providerId) {
        const [files] = await db.query('SELECT document_path FROM verification_requests WHERE provider_id = ?', [providerId]);
        const uploadRoot = path.resolve('uploads/verification') + path.sep;
        for (const file of files) {
            const filename = path.resolve(file.document_path);
            if (filename.startsWith(uploadRoot)) await fs.unlink(filename).catch(() => {});
        }
    }
    await db.query('DELETE FROM reports WHERE reporter_id IN (?)', [userIds]);
    await db.query('DELETE FROM bookings WHERE customer_id IN (?)', [userIds]);
    if (providerId) {
        await db.query('DELETE FROM services WHERE provider_id = ?', [providerId]);
        await db.query('DELETE FROM provider_profiles WHERE id = ?', [providerId]);
    }
    await db.query('DELETE FROM users WHERE id IN (?)', [userIds]);
    console.log('Removed only this run’s temporary accounts, bookings and upload.');
}

try {
    await api('API and MySQL health', 'GET', '/health');
    const demos = {};
    for (const role of ['customer', 'provider', 'admin']) {
        demos[role] = await api(`${role} demo login`, 'POST', '/auth/login', null, {
            email: `${role}@neighborlink.local`, password: 'NeighborLink@123'
        });
        assert.equal(demos[role].user.role, role);
    }
    const admin = demos.admin.token;
    await api('Reject incorrect password', 'POST', '/auth/login', null, { email: 'customer@neighborlink.local', password: 'incorrect' }, 401);
    await api('Protected route requires login', 'GET', '/bookings', null, null, 401);
    await api('Customer cannot access admin', 'GET', '/admin/users', demos.customer.token, null, 403);
    const categories = await api('Categories', 'GET', '/categories');
    const providers = await api('Browse providers', 'GET', '/providers');
    assert.ok(providers.items.length);
    await api('Search/filter providers', 'GET', `/providers?q=Ananya&category=tutoring&verified=true`);
    const customer = await register('customer');
    const outsider = await register('outsider');
    const candidate = await register('provider');
    const provider = await api('Become provider', 'POST', '/users/me/become-provider', candidate.token, {
        bio: 'Reliable tutoring and home lessons for neighborhood students.', skills: ['Mathematics'],
        experienceYears: 3, serviceRadiusKm: 5, location: 'Bengaluru'
    }, 201);
    providerId = provider.user.providerProfile.id;
    assert.equal(provider.user.role, 'provider');
    await api('Fresh role is applied to existing token', 'GET', '/providers/me/profile', candidate.token);
    await api('Edit provider profile', 'PATCH', '/providers/me', provider.token, { bio: 'Updated profile for dependable neighborhood tutoring services.' });
    const serviceForm = { title: `Workflow tutoring ${suffix}`, description: 'One hour mathematics lesson', categoryId: categories[0].id, price: 500, durationMin: 60 };
    await api('Reject missing price', 'POST', '/providers/me/services', provider.token, { ...serviceForm, price: undefined }, 422);
    const service = await api('Create service', 'POST', '/providers/me/services', provider.token, serviceForm, 201);
    await api('Edit service', 'PUT', `/providers/me/services/${service.id}`, provider.token, { price: 600 });
    await api('Reject negative service duration', 'PUT', `/providers/me/services/${service.id}`, provider.token, { durationMin: -10 }, 422);
    await api('Deactivate service', 'DELETE', `/providers/me/services/${service.id}`, provider.token);
    await api('Reactivate service', 'PUT', `/providers/me/services/${service.id}`, provider.token, { isActive: true });
    await api('Reject backwards availability', 'PUT', '/providers/me/availability', provider.token, { slots: [{ dayOfWeek: 1, startTime: '18:00', endTime: '09:00' }] }, 422);
    await api('Set availability', 'PUT', '/providers/me/availability', provider.token, { slots: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: '09:00', endTime: '18:00' })) });
    await api('Open provider detail', 'GET', `/providers/${providerId}`);
    await api('Favorite provider', 'POST', `/favorites/${providerId}`, customer.token, null, 201);
    assert.ok((await api('Favorites list', 'GET', '/favorites', customer.token)).some((item) => item.id === providerId));
    await api('Remove favorite', 'DELETE', `/favorites/${providerId}`, customer.token);
    const start = new Date(); start.setDate(start.getDate() + 14); start.setHours(10, 0, 0, 0);
    const bookingBody = { serviceId: service.id, scheduledStart: start.toISOString(), locationNote: 'Test service address', notes: 'Integration check' };
    const booking = await api('Create booking', 'POST', '/bookings', customer.token, bookingBody, 201);
    const overlapping = await api('Create competing pending request', 'POST', '/bookings', customer.token, bookingBody, 201);
    await api('View booking', 'GET', `/bookings/${booking.id}`, customer.token);
    await api('Deny unrelated booking access', 'GET', `/bookings/${booking.id}`, outsider.token, null, 404);
    await api('Reject payment before acceptance', 'POST', `/payments/${booking.id}`, customer.token, null, 409);
    await api('Provider booking requests', 'GET', '/bookings', provider.token);
    const acceptedBooking = await api('Accept booking', 'POST', `/bookings/${booking.id}/accept`, provider.token);
    assert.ok(acceptedBooking.acceptedAt);
    await api('Reject overlapping acceptance', 'POST', `/bookings/${overlapping.id}/accept`, provider.token, null, 409);
    await api('Reject competing request', 'POST', `/bookings/${overlapping.id}/reject`, provider.token);
    await api('Reject unpaid service start', 'POST', `/bookings/${booking.id}/start`, provider.token, null, 409);
    const payment = await api('Simulated payment', 'POST', `/payments/${booking.id}`, customer.token);
    assert.equal(payment.payment.amount, 600);
    assert.equal(payment.payment.platformFee + payment.payment.providerAmount, 600);
    await api('Duplicate payment is idempotent', 'POST', `/payments/${booking.id}`, customer.token);
    assert.ok((await api('Customer payment history', 'GET', '/payments/my', customer.token)).length === 1);
    assert.ok((await api('Provider earnings', 'GET', '/payments/my', provider.token)).length === 1);
    await api('Customer sends message', 'POST', `/conversations/${provider.user.id}/messages`, customer.token, { body: 'Hello, please bring the practice material.' }, 201);
    await api('Provider replies', 'POST', `/conversations/${customer.user.id}/messages`, provider.token, { body: 'Yes, I will bring it.' }, 201);
    const chat = await api('Conversation messages', 'GET', `/conversations/${provider.user.id}/messages`, customer.token);
    assert.equal(chat.items.length, 2);
    assert.equal(chat.items[0].sender.id, customer.user.id);
    assert.equal(chat.items[1].sender.id, provider.user.id);
    await api('Conversation list', 'GET', '/conversations', customer.token);
    await api('Reject unrelated message', 'POST', `/conversations/${provider.user.id}/messages`, outsider.token, { body: 'Unauthorised' }, 403);
    await api('Reject premature review', 'POST', '/reviews', customer.token, { bookingId: booking.id, rating: 5, comment: 'Great service!' }, 409);
    await api('Start service', 'POST', `/bookings/${booking.id}/start`, provider.token);
    await api('Reject cancellation after start', 'POST', `/bookings/${booking.id}/cancel`, customer.token, null, 409);
    const completionStatuses = await Promise.all([1, 2].map(async () => (await fetch(`${baseUrl}/bookings/${booking.id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${provider.token}` } })).status));
    assert.deepEqual(completionStatuses.sort(), [200, 409]);
    console.log('PASS Simultaneous completion is counted once'); checks += 1;
    assert.equal((await api('Acceptance timestamp survives completion', 'GET', `/bookings/${booking.id}`, customer.token)).acceptedAt, acceptedBooking.acceptedAt);
    await api('Reject backwards transition', 'POST', `/bookings/${booking.id}/accept`, provider.token, null, 409);
    await api('Reject invalid review rating', 'POST', '/reviews', customer.token, { bookingId: booking.id, rating: 'bad', comment: 'Great service!' }, 422);
    await api('Review completed booking', 'POST', '/reviews', customer.token, { bookingId: booking.id, rating: 5, comment: 'Great service!' }, 201);
    await api('Reject duplicate review', 'POST', '/reviews', customer.token, { bookingId: booking.id, rating: 5, comment: 'Great service!' }, 409);
    assert.equal((await api('Updated provider rating', 'GET', `/providers/${providerId}`)).averageRating, 5);
    for (const accepted of [false, true]) {
        start.setDate(start.getDate() + 1);
        const cancellable = await api('Create cancellable booking', 'POST', '/bookings', customer.token, { ...bookingBody, scheduledStart: start.toISOString() }, 201);
        if (accepted) {
            await api('Accept cancellable booking', 'POST', `/bookings/${cancellable.id}/accept`, provider.token);
            await api('Pay cancellable booking', 'POST', `/payments/${cancellable.id}`, customer.token);
        }
        await api(`Cancel ${accepted ? 'accepted' : 'pending'} booking`, 'POST', `/bookings/${cancellable.id}/cancel`, customer.token);
        if (accepted) {
            assert.equal((await api('Paid cancellation is refunded', 'GET', `/bookings/${cancellable.id}`, customer.token)).payment.status, 'refunded');
            await api('Cannot pay cancelled booking', 'POST', `/payments/${cancellable.id}`, customer.token, null, 409);
        }
    }
    start.setDate(start.getDate() + 1);
    const competing = [];
    for (let index = 0; index < 2; index += 1) competing.push(await api('Create concurrent acceptance fixture', 'POST', '/bookings', customer.token, { ...bookingBody, scheduledStart: start.toISOString() }, 201));
    const acceptanceStatuses = await Promise.all(competing.map(async (item) => (await fetch(`${baseUrl}/bookings/${item.id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${provider.token}` } })).status));
    assert.deepEqual(acceptanceStatuses.sort(), [200, 409]);
    console.log('PASS Simultaneous acceptance cannot double-book'); checks += 1;
    await api('Reject unrelated booking report', 'POST', '/disputes', outsider.token, { bookingId: booking.id, reason: 'Unrelated report' }, 404);
    const report = await api('Submit report', 'POST', '/disputes', customer.token, { bookingId: booking.id, reportedUserId: provider.user.id, reason: 'Test issue', description: 'Temporary workflow check' }, 201);
    const notifications = await api('Notifications', 'GET', '/notifications', customer.token);
    assert.ok(notifications.unread > 0);
    await api('Mark notification read', 'PATCH', `/notifications/${notifications.items[0].id}/read`, customer.token);
    await api('Mark all notifications read', 'POST', '/notifications/read-all', customer.token);
    assert.equal((await api('Unread count updated', 'GET', '/notifications', customer.token)).unread, 0);
    const form = new FormData();
    form.append('document', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVx8AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'workflow-test.png');
    const verification = await api('Upload verification', 'POST', '/users/me/verification', provider.token, form, 201);
    await api('Admin inspects document', 'GET', `/admin/verifications/${verification.id}/document`, admin);
    await api('Deny customer document access', 'GET', `/admin/verifications/${verification.id}/document`, customer.token, null, 403);
    await api('Admin approves verification', 'PUT', `/admin/verifications/${verification.id}`, admin, { status: 'approved' });
    assert.equal((await api('Verified provider badge', 'GET', `/providers/${providerId}`)).verificationStatus, 'verified');
    await api('Cannot re-review completed verification', 'PUT', `/admin/verifications/${verification.id}`, admin, { status: 'rejected' }, 409);
    const secondVerification = await api('Submit replacement verification', 'POST', '/users/me/verification', provider.token, form, 201);
    await api('Admin rejects verification', 'PUT', `/admin/verifications/${secondVerification.id}`, admin, { status: 'rejected' });
    assert.equal((await api('Rejection clears verified badge', 'GET', `/providers/${providerId}`)).verificationStatus, 'rejected');
    for (const route of ['overview', 'users', 'verifications', 'bookings', 'payments', 'reports']) await api(`Admin ${route}`, 'GET', `/admin/${route}`, admin);
    await api('Admin resolves report', 'PUT', `/admin/reports/${report.id}`, admin, { status: 'resolved', adminNote: 'Workflow checked' });
    await api('Suspend test account', 'PUT', `/admin/users/${outsider.user.id}/status`, admin, { isActive: false });
    await api('Suspension invalidates existing access', 'GET', '/bookings', outsider.token, null, 401);
    await api('Reactivate test account', 'PUT', `/admin/users/${outsider.user.id}/status`, admin, { isActive: true });
    await api('Reactivated account can access', 'GET', '/bookings', outsider.token);
    await api('Logout', 'POST', '/auth/logout', customer.token);
    console.log(`\n${checks} live API checks passed.`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    try { await cleanup(); } finally { await db.end(); }
}
