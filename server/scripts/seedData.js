import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { createId, toSqlDateTime } from '../utils/helpers.js';

const demoPassword = 'NeighborLink@123';

const categories = [
    ['Tutoring', 'tutoring', 'GraduationCap', 'Friendly local academic support.'],
    ['Plumbing', 'plumbing', 'Wrench', 'Repairs, fittings and leak support.'],
    ['Electrical', 'electrical', 'Zap', 'Safe household electrical work.'],
    ['Home Cleaning', 'cleaning', 'Sparkles', 'Reliable home cleaning services.'],
    ['Cooking', 'cooking', 'ChefHat', 'Fresh home-style meal services.'],
    ['Computer Repair', 'computer-repair', 'Laptop', 'Laptop and desktop troubleshooting.'],
    ['Tailoring', 'tailoring', 'Scissors', 'Alterations and custom clothing.'],
    ['Gardening', 'gardening', 'Leaf', 'Garden care and landscaping.']
];

const providerSeed = [
    ['Ananya Iyer', 'provider@neighborlink.local', 'Math & Science Tutor', 'Tutoring', 650, 6, 'Mathematics, Physics, CBSE', 4.9],
    ['Ravi Kumar', 'ravi@neighborlink.local', 'Reliable Home Plumbing', 'Plumbing', 450, 9, 'Leak repair, Pipes, Fittings', 4.8],
    ['Priya Sharma', 'priya@neighborlink.local', 'Professional Home Cleaning', 'Home Cleaning', 550, 5, 'Deep cleaning, Sanitisation', 4.9],
    ['Vikram Das', 'vikram@neighborlink.local', 'Electrical Repair', 'Electrical', 500, 11, 'Wiring, Fans, Safety', 4.7],
    ['Meera Nair', 'meera@neighborlink.local', 'Fresh Home-style Meals', 'Cooking', 400, 7, 'South Indian, Meal preparation', 4.9],
    ['Arjun Patel', 'arjun@neighborlink.local', 'Laptop & Desktop Repair', 'Computer Repair', 600, 8, 'Diagnostics, Software, Hardware', 4.6]
];

async function clearExistingData() {
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [
        'reports', 'verification_requests', 'notifications', 'messages', 'favorites',
        'reviews', 'payments', 'bookings', 'availability', 'services',
        'provider_profiles', 'categories', 'users'
    ]) {
        await db.query(`DELETE FROM ${table}`);
    }
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
}

export async function seedDatabase() {
    await clearExistingData();
    const passwordHash = await bcrypt.hash(demoPassword, 10);

    const categoryIds = new Map();
    for (const [name, slug, icon, description] of categories) {
        const id = createId();
        categoryIds.set(name, id);
        await db.query(
            'INSERT INTO categories (id, name, slug, icon, description) VALUES (?, ?, ?, ?, ?)',
            [id, name, slug, icon, description]
        );
    }

    const adminId = createId();
    const customerId = createId();
    await db.query(
        `INSERT INTO users
         (id, full_name, email, password_hash, phone, role, neighborhood, city)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [adminId, 'Aditi Admin', 'admin@neighborlink.local', passwordHash, '9000000001', 'admin', 'Central Area', 'Bengaluru']
    );
    await db.query(
        `INSERT INTO users
         (id, full_name, email, password_hash, phone, role, neighborhood, city)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [customerId, 'Kiran Customer', 'customer@neighborlink.local', passwordHash, '9876543210', 'customer', 'Central Area', 'Bengaluru']
    );

    const customerIds = [customerId];
    for (let index = 1; index <= 5; index += 1) {
        const id = createId();
        customerIds.push(id);
        await db.query(
            `INSERT INTO users
             (id, full_name, email, password_hash, role, neighborhood, city)
             VALUES (?, ?, ?, ?, 'customer', ?, 'Bengaluru')`,
            [id, `Community Member ${index}`, `member${index}@neighborlink.local`, passwordHash, `Neighborhood ${index}`]
        );
    }

    const providers = [];
    for (let index = 0; index < providerSeed.length; index += 1) {
        const [name, email, serviceTitle, categoryName, price, experience, skills, rating] = providerSeed[index];
        const userId = createId();
        const providerId = createId();
        const serviceId = createId();
        await db.query(
            `INSERT INTO users
             (id, full_name, email, password_hash, phone, role, neighborhood, city)
             VALUES (?, ?, ?, ?, ?, 'provider', ?, 'Bengaluru')`,
            [userId, name, email, passwordHash, `90000000${String(index + 10)}`, `Neighborhood ${index + 1}`]
        );
        const isVerified = index !== 1;
        await db.query(
            `INSERT INTO provider_profiles
             (id, user_id, bio, experience_years, location, skills, verified,
              verification_status, rating, review_count, completed_jobs, service_radius_km)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 7)`,
            [providerId, userId, `${name} is a friendly local professional focused on dependable service and clear communication.`, experience, 'Bengaluru', skills, isVerified, isVerified ? 'verified' : 'pending', rating, 4 + index, 12 + index * 4]
        );
        await db.query(
            `INSERT INTO services
             (id, provider_id, category_id, title, description, price, duration_minutes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [serviceId, providerId, categoryIds.get(categoryName), serviceTitle, `Professional ${serviceTitle.toLowerCase()} delivered in your neighborhood.`, price, categoryName === 'Tutoring' ? 60 : 90]
        );
        await db.query(
            `INSERT INTO services
             (id, provider_id, category_id, title, description, price, duration_minutes)
             VALUES (?, ?, ?, ?, ?, ?, 120)`,
            [createId(), providerId, categoryIds.get(categoryName), `${serviceTitle} - Extended Visit`, 'A longer appointment for larger or more detailed work.', price + 200]
        );
        for (let day = 1; day <= 6; day += 1) {
            await db.query(
                `INSERT INTO availability
                 (id, provider_id, day_of_week, start_time, end_time)
                 VALUES (?, ?, ?, ?, ?)`,
                [createId(), providerId, day, day === 6 ? '10:00' : '09:00', day === 6 ? '16:00' : '18:00']
            );
        }
        providers.push({ userId, providerId, serviceId, price, name });
    }

    const bookingStatuses = ['completed', 'completed', 'accepted', 'pending', 'pending', 'cancelled', 'completed', 'accepted', 'rejected', 'completed', 'pending', 'cancelled'];
    const bookings = [];
    for (let index = 0; index < bookingStatuses.length; index += 1) {
        const provider = providers[index % providers.length];
        const start = new Date();
        start.setDate(start.getDate() + (index - 4));
        start.setHours(10 + (index % 3) * 2, 0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60_000);
        const status = bookingStatuses[index];
        const id = createId();
        const isPaid = status === 'completed' || (status === 'accepted' && index === 2);
        await db.query(
            `INSERT INTO bookings
             (id, customer_id, provider_id, service_id, scheduled_start, scheduled_end,
              address, notes, status, payment_status, total_amount, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, customerIds[index % customerIds.length], provider.providerId, provider.serviceId,
                toSqlDateTime(start), toSqlDateTime(end), 'Central Area, Bengaluru',
                'Please call when you arrive.', status, isPaid ? 'paid' : 'pending',
                provider.price, status === 'completed' ? toSqlDateTime(end) : null]
        );
        bookings.push({ id, status, provider, customerId: customerIds[index % customerIds.length], price: provider.price });

        if (isPaid) {
            const fee = provider.price * 0.1;
            await db.query(
                `INSERT INTO payments
                 (id, booking_id, customer_id, provider_id, amount, platform_fee,
                  provider_amount, payment_method, payment_status, paid_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'demo', 'paid', NOW())`,
                [createId(), id, customerIds[index % customerIds.length], provider.providerId,
                    provider.price, fee, provider.price - fee]
            );
        }
        if (status === 'completed') {
            await db.query(
                `INSERT INTO reviews
                 (id, booking_id, customer_id, provider_id, rating, comment)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [createId(), id, customerIds[index % customerIds.length], provider.providerId,
                    index % 3 === 0 ? 4 : 5, 'Friendly, punctual and skilled. I would happily book this provider again.']
            );
        }
    }

    await db.query(
        'INSERT INTO favorites (id, user_id, provider_id) VALUES (?, ?, ?)',
        [createId(), customerId, providers[0].providerId]
    );
    await db.query(
        `INSERT INTO messages (id, sender_id, receiver_id, booking_id, message, created_at)
         VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(6), INTERVAL 1 MINUTE)), (?, ?, ?, ?, ?, NOW(6))`,
        [createId(), customerId, providers[0].userId, bookings[0].id, 'Hi Ananya, I am looking forward to our session.',
            createId(), providers[0].userId, customerId, bookings[0].id, 'Great! I will bring a few practice worksheets.']
    );
    await db.query(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
        [createId(), customerId, 'Booking accepted', 'Your local provider accepted the booking.', 'booking', `/bookings/${bookings[2].id}`,
            createId(), providers[0].userId, 'New message', 'Kiran sent you a message.', 'message', `/messages/${customerId}`]
    );
    await db.query(
        `INSERT INTO reports
         (id, reporter_id, reported_user_id, booking_id, reason, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [createId(), customerId, providers[1].userId, bookings[1].id, 'Service quality concern', 'Please review the service details and help resolve my concern.']
    );
    await db.query(
        `INSERT INTO verification_requests
         (id, provider_id, document_path, document_type, status)
         VALUES (?, ?, ?, 'identity', 'pending')`,
        [createId(), providers[1].providerId, 'fixtures/demo-verification.txt']
    );

    // Keep summary values consistent with the actual demonstration records.
    await db.query(`UPDATE provider_profiles p SET
        rating = (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.provider_id = p.id),
        review_count = (SELECT COUNT(*) FROM reviews r WHERE r.provider_id = p.id),
        completed_jobs = (SELECT COUNT(*) FROM bookings b WHERE b.provider_id = p.id AND b.status = 'completed')`);

    console.log(`Seeded NeighborLink. Demo password: ${demoPassword}`);
}
