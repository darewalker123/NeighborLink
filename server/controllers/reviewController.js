import { Booking, ProviderProfile, Review, User } from '../models/index.js';
import { createNotification } from './notificationHelper.js';
import { createId, httpError } from '../utils/helpers.js';

export async function createReview(request, response) {
    const { bookingId, rating, comment } = request.body;
    const numericRating = Number(rating);
    if (!bookingId || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5 || typeof comment !== 'string' || comment.trim().length < 5 || comment.length > 2000) {
        throw httpError(422, 'Enter a rating from 1 to 5 and a short review.');
    }

    const booking = await Booking.findById(bookingId).lean();
    const provider = booking ? await ProviderProfile.findById(booking.providerId).lean() : null;
    if (!booking || booking.customerId !== request.user.id) throw httpError(404, 'Completed booking not found.');
    if (booking.status !== 'completed') throw httpError(409, 'Reviews can only be submitted for completed bookings.');
    if (await Review.exists({ bookingId })) throw httpError(409, 'A review already exists for this booking.');

    await Review.create({
        _id: createId(),
        bookingId: booking._id,
        customerId: request.user.id,
        providerId: booking.providerId,
        rating: numericRating,
        comment: comment.trim()
    });
    const reviews = await Review.find({ providerId: booking.providerId }).lean();
    const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    await ProviderProfile.updateOne({ _id: booking.providerId }, { $set: { rating: average, reviewCount: reviews.length } });
    await createNotification(provider.userId, 'New review', `You received a ${numericRating}-star review.`, 'review', `/providers/${booking.providerId}`);
    return response.status(201).json({ message: 'Thanks for sharing your experience.' });
}

export async function getProviderReviews(request, response) {
    const reviews = await Review.find({ providerId: request.params.providerId }).sort({ createdAt: -1 }).lean();
    const authors = await User.find({ _id: { $in: reviews.map((review) => review.customerId) } }).lean();
    const authorById = new Map(authors.map((author) => [author._id, author]));
    return response.json(reviews.map((review) => {
        const author = authorById.get(review.customerId);
        return {
            id: review._id,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
            author: { fullName: author?.fullName, avatarUrl: author?.profileImage }
        };
    }));
}
