import db from '../config/db.js';
import { createId, httpError, normalizeTime } from '../utils/helpers.js';
import { requireNumber, requireText, validateAvailabilitySlot, validateServiceDetails } from '../utils/validation.js';

function mapService(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        price: Number(row.price),
        durationMin: row.duration_minutes,
        isActive: Boolean(row.is_active),
        category: {
            id: row.category_id,
            name: row.category_name,
            slug: row.category_slug,
            icon: row.category_icon
        }
    };
}

function mapProvider(row) {
    return {
        id: row.id,
        bio: row.bio,
        skills: row.skills ? row.skills.split(',').map((skill) => skill.trim()).filter(Boolean) : [],
        experienceYears: row.experience_years,
        serviceRadiusKm: row.service_radius_km,
        averageRating: Number(row.rating || 0),
        reviewCount: row.review_count,
        completedJobs: row.completed_jobs,
        verificationStatus: row.verification_status,
        isAcceptingWork: Boolean(row.is_accepting_work),
        user: {
            id: row.user_id,
            fullName: row.full_name,
            avatarUrl: row.profile_image,
            neighborhood: row.neighborhood,
            city: row.city
        },
        services: [],
        availability: [],
        startingPrice: null,
        distance: null,
        recommendationScore: Number(row.rating || 0) * 20 + row.completed_jobs
    };
}

async function attachProviderDetails(providerRows, includeReviews = false) {
    if (!providerRows.length) {
        return [];
    }

    const providerIds = providerRows.map((provider) => provider.id);
    const [services] = await db.query(
        `SELECT s.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon
         FROM services s
         JOIN categories c ON c.id = s.category_id
         WHERE s.provider_id IN (?)
         ORDER BY s.created_at DESC`,
        [providerIds]
    );
    const [availability] = await db.query(
        `SELECT id, provider_id, day_of_week, start_time, end_time, is_available
         FROM availability WHERE provider_id IN (?) ORDER BY day_of_week`,
        [providerIds]
    );

    const providers = providerRows.map(mapProvider);
    for (const provider of providers) {
        provider.services = services
            .filter((service) => service.provider_id === provider.id)
            .map(mapService);
        provider.availability = availability
            .filter((slot) => slot.provider_id === provider.id)
            .map((slot) => ({
                id: slot.id,
                dayOfWeek: slot.day_of_week,
                startTime: normalizeTime(slot.start_time),
                endTime: normalizeTime(slot.end_time),
                unavailable: !slot.is_available
            }));
        const activePrices = provider.services
            .filter((service) => service.isActive)
            .map((service) => service.price);
        provider.startingPrice = activePrices.length ? Math.min(...activePrices) : null;
    }

    if (includeReviews) {
        const [reviews] = await db.query(
            `SELECT r.*, u.full_name, u.profile_image
             FROM reviews r
             JOIN users u ON u.id = r.customer_id
             WHERE r.provider_id = ?
             ORDER BY r.created_at DESC LIMIT 20`,
            [providerIds[0]]
        );
        providers[0].reviewsReceived = reviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.created_at,
            author: { fullName: review.full_name, avatarUrl: review.profile_image }
        }));
    }
    return providers;
}

export async function getCategories(_request, response) {
    const [rows] = await db.query(
        'SELECT id, name, slug, icon, description FROM categories WHERE is_active = TRUE ORDER BY name'
    );
    return response.json(rows);
}

export async function getProviders(request, response) {
    const conditions = ['p.is_accepting_work = TRUE', 'u.is_active = TRUE'];
    const values = [];
    const search = String(request.query.q || '').trim();

    if (request.query.verified === 'true') {
        conditions.push('p.verified = TRUE');
    }
    if (Number(request.query.rating)) {
        conditions.push('p.rating >= ?');
        values.push(Number(request.query.rating));
    }
    if (request.query.category) {
        conditions.push(`EXISTS (
            SELECT 1 FROM services sc
            JOIN categories cc ON cc.id = sc.category_id
            WHERE sc.provider_id = p.id AND sc.is_active = TRUE AND cc.slug = ?
        )`);
        values.push(request.query.category);
    }
    if (search) {
        conditions.push(`(
            u.full_name LIKE ? OR u.neighborhood LIKE ? OR p.location LIKE ? OR
            EXISTS (
                SELECT 1 FROM services ss
                JOIN categories cs ON cs.id = ss.category_id
                WHERE ss.provider_id = p.id AND ss.is_active = TRUE
                AND (ss.title LIKE ? OR ss.description LIKE ? OR cs.name LIKE ?)
            )
        )`);
        const likeSearch = `%${search}%`;
        values.push(likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch);
    }

    const [rows] = await db.query(
        `SELECT p.*, u.full_name, u.profile_image, u.neighborhood, u.city
         FROM provider_profiles p
         JOIN users u ON u.id = p.user_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY p.verified DESC, p.rating DESC, p.completed_jobs DESC`,
        values
    );

    let providers = await attachProviderDetails(rows);
    const maxPrice = Number(request.query.maxPrice || 0);
    if (maxPrice) {
        providers = providers.filter((provider) =>
            provider.services.some((service) => service.isActive && service.price <= maxPrice)
        );
    }
    for (const provider of providers) {
        provider.services = provider.services.filter((service) => service.isActive);
    }

    const page = Math.max(1, Number(request.query.page || 1));
    const limit = Math.min(40, Math.max(1, Number(request.query.limit || 12)));
    const total = providers.length;
    return response.json({
        items: providers.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
}

export async function getProvider(request, response) {
    const [rows] = await db.query(
        `SELECT p.*, u.full_name, u.profile_image, u.neighborhood, u.city
         FROM provider_profiles p
         JOIN users u ON u.id = p.user_id
         WHERE p.id = ? AND u.is_active = TRUE`,
        [request.params.id]
    );
    if (!rows.length) {
        throw httpError(404, 'Provider not found.');
    }
    const [provider] = await attachProviderDetails(rows, true);
    provider.services = provider.services.filter((service) => service.isActive);
    return response.json(provider);
}

export async function getOwnProviderProfile(request, response) {
    const [rows] = await db.query(
        `SELECT p.*, u.full_name, u.profile_image, u.neighborhood, u.city
         FROM provider_profiles p JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ?`,
        [request.user.id]
    );
    if (!rows.length) {
        throw httpError(404, 'Provider profile not found.');
    }
    const [provider] = await attachProviderDetails(rows);
    return response.json(provider);
}

export async function updateProviderProfile(request, response) {
    const { bio, skills, experienceYears, serviceRadiusKm, isAcceptingWork, location } = request.body;
    if (bio !== undefined) requireText(bio, 'Bio', 20, 5000);
    if (experienceYears !== undefined) requireNumber(experienceYears, 'Experience', 0, 80, true);
    if (serviceRadiusKm !== undefined) requireNumber(serviceRadiusKm, 'Service radius', 1, 100);
    if (location !== undefined) requireText(location, 'Location', 2, 120);
    if (isAcceptingWork !== undefined && typeof isAcceptingWork !== 'boolean') throw httpError(422, 'Work status must be true or false.');
    const skillText = Array.isArray(skills) ? skills.join(', ') : skills;
    if (skillText !== undefined) requireText(skillText, 'Skills', 1, 500);
    await db.query(
        `UPDATE provider_profiles SET
         bio = COALESCE(?, bio), skills = COALESCE(?, skills),
         experience_years = COALESCE(?, experience_years),
         service_radius_km = COALESCE(?, service_radius_km),
         is_accepting_work = COALESCE(?, is_accepting_work),
         location = COALESCE(?, location)
         WHERE user_id = ?`,
        [bio ?? null, skillText ?? null, experienceYears ?? null, serviceRadiusKm ?? null, isAcceptingWork ?? null, location ?? null, request.user.id]
    );
    return response.json({ message: 'Provider profile updated.' });
}

async function getProviderId(userId) {
    const [rows] = await db.query('SELECT id FROM provider_profiles WHERE user_id = ?', [userId]);
    if (!rows.length) {
        throw httpError(404, 'Provider profile not found.');
    }
    return rows[0].id;
}

export async function createService(request, response) {
    const { title, description, categoryId, price, durationMin } = request.body;
    validateServiceDetails(request.body);
    const [categories] = await db.query('SELECT id FROM categories WHERE id = ? AND is_active = TRUE', [categoryId]);
    if (!categories.length) throw httpError(422, 'Choose an available category.');
    const providerId = await getProviderId(request.user.id);
    const serviceId = createId();
    await db.query(
        `INSERT INTO services
         (id, provider_id, category_id, title, description, price, duration_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [serviceId, providerId, categoryId, title.trim(), description.trim(), Number(price), Number(durationMin) || 60]
    );
    return response.status(201).json({ id: serviceId, message: 'Service published.' });
}

export async function updateService(request, response) {
    const providerId = await getProviderId(request.user.id);
    const { title, description, categoryId, price, durationMin, isActive } = request.body;
    validateServiceDetails(request.body, true);
    if (categoryId !== undefined) {
        const [categories] = await db.query('SELECT id FROM categories WHERE id = ? AND is_active = TRUE', [categoryId]);
        if (!categories.length) throw httpError(422, 'Choose an available category.');
    }
    const [result] = await db.query(
        `UPDATE services SET title = COALESCE(?, title), description = COALESCE(?, description),
         category_id = COALESCE(?, category_id), price = COALESCE(?, price),
         duration_minutes = COALESCE(?, duration_minutes), is_active = COALESCE(?, is_active)
         WHERE id = ? AND provider_id = ?`,
        [title ?? null, description ?? null, categoryId ?? null, price ?? null, durationMin ?? null, isActive ?? null, request.params.id, providerId]
    );
    if (!result.affectedRows) {
        throw httpError(404, 'Service not found.');
    }
    return response.json({ message: 'Service updated.' });
}

export async function deleteService(request, response) {
    const providerId = await getProviderId(request.user.id);
    const [result] = await db.query(
        'UPDATE services SET is_active = FALSE WHERE id = ? AND provider_id = ?',
        [request.params.id, providerId]
    );
    if (!result.affectedRows) {
        throw httpError(404, 'Service not found.');
    }
    return response.json({ message: 'Service deactivated.' });
}

export async function saveAvailability(request, response) {
    const providerId = await getProviderId(request.user.id);
    const slots = Array.isArray(request.body.slots) ? request.body.slots : [];
    if (!slots.length) {
        throw httpError(422, 'Add at least one availability slot.');
    }
    if (slots.length > 7) throw httpError(422, 'Use at most one slot for each weekday.');
    // Validate the whole form before saving any rows.
    slots.forEach(validateAvailabilitySlot);

    for (const slot of slots) {
        await db.query(
            `INSERT INTO availability
             (id, provider_id, day_of_week, start_time, end_time, is_available)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE start_time = VALUES(start_time),
             end_time = VALUES(end_time), is_available = VALUES(is_available)`,
            [createId(), providerId, slot.dayOfWeek, slot.startTime, slot.endTime, slot.isAvailable !== false]
        );
    }
    return response.json({ message: 'Availability updated.' });
}

export async function getFavorites(request, response) {
    const [rows] = await db.query(
        `SELECT p.*, u.full_name, u.profile_image, u.neighborhood, u.city
         FROM favorites f
         JOIN provider_profiles p ON p.id = f.provider_id
         JOIN users u ON u.id = p.user_id
         WHERE f.user_id = ? ORDER BY f.created_at DESC`,
        [request.user.id]
    );
    return response.json(await attachProviderDetails(rows));
}

export async function addFavorite(request, response) {
    const [providers] = await db.query('SELECT id FROM provider_profiles WHERE id = ?', [request.params.providerId]);
    if (!providers.length) throw httpError(404, 'Provider not found.');
    await db.query(
        'INSERT IGNORE INTO favorites (id, user_id, provider_id) VALUES (?, ?, ?)',
        [createId(), request.user.id, request.params.providerId]
    );
    return response.status(201).json({ message: 'Provider saved to favorites.' });
}

export async function removeFavorite(request, response) {
    await db.query(
        'DELETE FROM favorites WHERE user_id = ? AND provider_id = ?',
        [request.user.id, request.params.providerId]
    );
    return response.json({ message: 'Provider removed from favorites.' });
}
