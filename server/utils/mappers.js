import {
    Availability, Booking, Category, Payment, ProviderProfile, Review, Service, User
} from '../models/index.js';

export function docId(doc) {
    return doc?._id || doc?.id;
}

export function publicUser(user, provider = null) {
    return {
        id: docId(user),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        neighborhood: user.neighborhood,
        city: user.city,
        avatarUrl: user.profileImage,
        status: user.isActive ? 'active' : 'suspended',
        providerProfile: provider ? {
            id: docId(provider),
            verificationStatus: provider.verificationStatus,
            averageRating: Number(provider.rating || 0)
        } : null
    };
}

export function mapCategory(category) {
    return {
        id: docId(category),
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        description: category.description
    };
}

export function mapService(service, category) {
    return {
        id: docId(service),
        title: service.title,
        description: service.description,
        price: Number(service.price),
        durationMin: service.durationMin,
        isActive: Boolean(service.isActive),
        category: category ? mapCategory(category) : { id: service.categoryId }
    };
}

export async function buildProvider(provider, { includeInactiveServices = true, includeReviews = false } = {}) {
    const [user, services, availability, reviews] = await Promise.all([
        User.findById(provider.userId).lean(),
        Service.find({ providerId: docId(provider), ...(includeInactiveServices ? {} : { isActive: true }) }).sort({ createdAt: -1 }).lean(),
        Availability.find({ providerId: docId(provider) }).sort({ dayOfWeek: 1 }).lean(),
        includeReviews ? Review.find({ providerId: docId(provider) }).sort({ createdAt: -1 }).limit(20).lean() : []
    ]);
    const categories = await Category.find({ _id: { $in: services.map((service) => service.categoryId) } }).lean();
    const categoryById = new Map(categories.map((category) => [docId(category), category]));
    const mappedServices = services.map((service) => mapService(service, categoryById.get(service.categoryId)));
    const activePrices = mappedServices.filter((service) => service.isActive).map((service) => service.price);
    const result = {
        id: docId(provider),
        bio: provider.bio,
        skills: Array.isArray(provider.skills) ? provider.skills : [],
        experienceYears: provider.experienceYears,
        serviceRadiusKm: provider.serviceRadiusKm,
        averageRating: Number(provider.rating || 0),
        reviewCount: provider.reviewCount || 0,
        completedJobs: provider.completedJobs || 0,
        verificationStatus: provider.verificationStatus,
        isAcceptingWork: Boolean(provider.isAcceptingWork),
        user: {
            id: user?._id,
            fullName: user?.fullName,
            avatarUrl: user?.profileImage,
            neighborhood: user?.neighborhood,
            city: user?.city
        },
        services: mappedServices,
        availability: availability.map((slot) => ({
            id: docId(slot),
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            unavailable: !slot.isAvailable
        })),
        startingPrice: activePrices.length ? Math.min(...activePrices) : null,
        distance: null,
        recommendationScore: Number(provider.rating || 0) * 20 + Number(provider.completedJobs || 0)
    };

    if (includeReviews) {
        const authors = await User.find({ _id: { $in: reviews.map((review) => review.customerId) } }).lean();
        const authorById = new Map(authors.map((author) => [docId(author), author]));
        result.reviewsReceived = reviews.map((review) => {
            const author = authorById.get(review.customerId);
            return {
                id: docId(review),
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt,
                author: { fullName: author?.fullName, avatarUrl: author?.profileImage }
            };
        });
    }

    return result;
}

export async function buildBooking(booking) {
    const [service, customer, provider, payment, review] = await Promise.all([
        Service.findById(booking.serviceId).lean(),
        User.findById(booking.customerId).lean(),
        ProviderProfile.findById(booking.providerId).lean(),
        Payment.findOne({ bookingId: docId(booking) }).lean(),
        Review.findOne({ bookingId: docId(booking) }).lean()
    ]);
    const [category, providerUser] = await Promise.all([
        service ? Category.findById(service.categoryId).lean() : null,
        provider ? User.findById(provider.userId).lean() : null
    ]);

    return {
        id: docId(booking),
        scheduledStart: booking.scheduledStart,
        scheduledEnd: booking.scheduledEnd,
        quotedPrice: Number(booking.totalAmount),
        status: booking.status,
        notes: booking.notes,
        locationNote: booking.address,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        acceptedAt: booking.acceptedAt,
        completedAt: booking.completedAt,
        service: {
            id: service?._id,
            title: service?.title,
            description: service?.description,
            price: Number(service?.price || 0),
            durationMin: service?.durationMin,
            category: { id: category?._id, name: category?.name, slug: category?.slug }
        },
        customer: {
            id: customer?._id,
            fullName: customer?.fullName,
            avatarUrl: customer?.profileImage,
            phone: customer?.phone,
            neighborhood: customer?.neighborhood
        },
        provider: {
            id: provider?._id,
            user: {
                id: providerUser?._id,
                fullName: providerUser?.fullName,
                avatarUrl: providerUser?.profileImage,
                phone: providerUser?.phone,
                neighborhood: providerUser?.neighborhood
            }
        },
        payment: payment ? {
            status: payment.paymentStatus,
            amount: Number(payment.amount),
            paidAt: payment.paidAt
        } : null,
        review: review ? {
            id: review._id,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt
        } : null,
        conversation: ['accepted', 'in_progress', 'completed'].includes(booking.status)
            ? { id: providerUser?._id }
            : null
    };
}
