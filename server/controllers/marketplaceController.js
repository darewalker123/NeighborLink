import {
    Availability, Category, Favorite, ProviderProfile, Service, User
} from '../models/index.js';
import { createId, httpError } from '../utils/helpers.js';
import { buildProvider, mapCategory } from '../utils/mappers.js';
import { requireNumber, requireText, validateAvailabilitySlot, validateServiceDetails } from '../utils/validation.js';

export async function getCategories(_request, response) {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
    return response.json(categories.map(mapCategory));
}

export async function getProviders(request, response) {
    const search = String(request.query.q || '').trim().toLowerCase();
    const providers = await ProviderProfile.find({ isAcceptingWork: true }).lean();
    const mapped = [];

    for (const provider of providers) {
        const user = await User.findById(provider.userId).lean();
        if (!user?.isActive) continue;
        if (request.query.verified === 'true' && !provider.verified) continue;
        if (Number(request.query.rating) && Number(provider.rating || 0) < Number(request.query.rating)) continue;

        let item = await buildProvider(provider, { includeInactiveServices: false });
        if (request.query.category && !item.services.some((service) => service.category.slug === request.query.category)) continue;
        if (search) {
            const haystack = [
                user.fullName, user.neighborhood, provider.location, provider.bio,
                ...item.services.flatMap((service) => [service.title, service.description, service.category.name])
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(search)) continue;
        }
        const maxPrice = Number(request.query.maxPrice || 0);
        if (maxPrice && !item.services.some((service) => service.isActive && service.price <= maxPrice)) continue;
        mapped.push(item);
    }

    mapped.sort((a, b) =>
        Number(b.verificationStatus === 'verified') - Number(a.verificationStatus === 'verified')
        || b.averageRating - a.averageRating
        || b.completedJobs - a.completedJobs
    );

    const page = Math.max(1, Number(request.query.page || 1));
    const limit = Math.min(40, Math.max(1, Number(request.query.limit || 12)));
    return response.json({
        items: mapped.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: mapped.length, pages: Math.ceil(mapped.length / limit) }
    });
}

export async function getProvider(request, response) {
    const provider = await ProviderProfile.findById(request.params.id).lean();
    const user = provider ? await User.findById(provider.userId).lean() : null;
    if (!provider || !user?.isActive) throw httpError(404, 'Provider not found.');
    const mapped = await buildProvider(provider, { includeInactiveServices: false, includeReviews: true });
    return response.json(mapped);
}

export async function getOwnProviderProfile(request, response) {
    const provider = await ProviderProfile.findOne({ userId: request.user.id }).lean();
    if (!provider) throw httpError(404, 'Provider profile not found.');
    return response.json(await buildProvider(provider));
}

export async function updateProviderProfile(request, response) {
    const { bio, skills, experienceYears, serviceRadiusKm, isAcceptingWork, location } = request.body;
    if (bio !== undefined) requireText(bio, 'Bio', 20, 5000);
    if (experienceYears !== undefined) requireNumber(experienceYears, 'Experience', 0, 80, true);
    if (serviceRadiusKm !== undefined) requireNumber(serviceRadiusKm, 'Service radius', 1, 100);
    if (location !== undefined) requireText(location, 'Location', 2, 120);
    if (isAcceptingWork !== undefined && typeof isAcceptingWork !== 'boolean') throw httpError(422, 'Work status must be true or false.');
    const skillList = Array.isArray(skills) ? skills.map((skill) => String(skill).trim()).filter(Boolean) : String(skills || '').split(',').map((skill) => skill.trim()).filter(Boolean);
    if (skills !== undefined && !skillList.length) throw httpError(422, 'Skills must contain 1 to 500 characters.');

    const update = {};
    if (bio !== undefined) update.bio = bio.trim();
    if (skills !== undefined) update.skills = skillList;
    if (experienceYears !== undefined) update.experienceYears = Number(experienceYears);
    if (serviceRadiusKm !== undefined) update.serviceRadiusKm = Number(serviceRadiusKm);
    if (isAcceptingWork !== undefined) update.isAcceptingWork = isAcceptingWork;
    if (location !== undefined) update.location = location.trim();
    await ProviderProfile.updateOne({ userId: request.user.id }, { $set: update });
    return response.json({ message: 'Provider profile updated.' });
}

async function getProviderId(userId) {
    const provider = await ProviderProfile.findOne({ userId }).select('_id').lean();
    if (!provider) throw httpError(404, 'Provider profile not found.');
    return provider._id;
}

export async function createService(request, response) {
    const { title, description, categoryId, price, durationMin } = request.body;
    validateServiceDetails(request.body);
    const category = await Category.findOne({ _id: categoryId, isActive: true }).lean();
    if (!category) throw httpError(422, 'Choose an available category.');
    const providerId = await getProviderId(request.user.id);
    const service = await Service.create({
        _id: createId(),
        providerId,
        categoryId,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        durationMin: Number(durationMin) || 60
    });
    return response.status(201).json({ id: service._id, message: 'Service published.' });
}

export async function updateService(request, response) {
    const providerId = await getProviderId(request.user.id);
    const { title, description, categoryId, price, durationMin, isActive } = request.body;
    validateServiceDetails(request.body, true);
    if (categoryId !== undefined && !(await Category.exists({ _id: categoryId, isActive: true }))) {
        throw httpError(422, 'Choose an available category.');
    }
    const update = {};
    if (title !== undefined) update.title = title.trim();
    if (description !== undefined) update.description = description.trim();
    if (categoryId !== undefined) update.categoryId = categoryId;
    if (price !== undefined) update.price = Number(price);
    if (durationMin !== undefined) update.durationMin = Number(durationMin);
    if (isActive !== undefined) update.isActive = isActive;
    const result = await Service.updateOne({ _id: request.params.id, providerId }, { $set: update });
    if (!result.matchedCount) throw httpError(404, 'Service not found.');
    return response.json({ message: 'Service updated.' });
}

export async function deleteService(request, response) {
    const providerId = await getProviderId(request.user.id);
    const result = await Service.updateOne({ _id: request.params.id, providerId }, { $set: { isActive: false } });
    if (!result.matchedCount) throw httpError(404, 'Service not found.');
    return response.json({ message: 'Service deactivated.' });
}

export async function saveAvailability(request, response) {
    const providerId = await getProviderId(request.user.id);
    const slots = Array.isArray(request.body.slots) ? request.body.slots : [];
    if (!slots.length) throw httpError(422, 'Add at least one availability slot.');
    if (slots.length > 7) throw httpError(422, 'Use at most one slot for each weekday.');
    slots.forEach(validateAvailabilitySlot);

    for (const slot of slots) {
        await Availability.updateOne(
            { providerId, dayOfWeek: slot.dayOfWeek },
            {
                $set: {
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    isAvailable: slot.isAvailable !== false
                },
                $setOnInsert: { _id: createId(), providerId, dayOfWeek: slot.dayOfWeek }
            },
            { upsert: true }
        );
    }
    return response.json({ message: 'Availability updated.' });
}

export async function getFavorites(request, response) {
    const favorites = await Favorite.find({ userId: request.user.id }).sort({ createdAt: -1 }).lean();
    const providers = await ProviderProfile.find({ _id: { $in: favorites.map((favorite) => favorite.providerId) } }).lean();
    return response.json(await Promise.all(providers.map((provider) => buildProvider(provider))));
}

export async function addFavorite(request, response) {
    if (!(await ProviderProfile.exists({ _id: request.params.providerId }))) throw httpError(404, 'Provider not found.');
    await Favorite.updateOne(
        { userId: request.user.id, providerId: request.params.providerId },
        { $setOnInsert: { _id: createId(), userId: request.user.id, providerId: request.params.providerId } },
        { upsert: true }
    );
    return response.status(201).json({ message: 'Provider saved to favorites.' });
}

export async function removeFavorite(request, response) {
    await Favorite.deleteOne({ userId: request.user.id, providerId: request.params.providerId });
    return response.json({ message: 'Provider removed from favorites.' });
}
