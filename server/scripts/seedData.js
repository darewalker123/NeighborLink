import bcrypt from 'bcryptjs';
import {
    allModels, Availability, Booking, Category, Favorite, Message, Notification,
    Payment, ProviderProfile, Report, Review, Service, User, VerificationRequest
} from '../models/index.js';
import { createId } from '../utils/helpers.js';

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
    ['Ananya Iyer', 'provider@neighborlink.local', 'Math & Science Tutor', 'Tutoring', 650, 6, ['Mathematics', 'Physics', 'CBSE'], 4.9],
    ['Ravi Kumar', 'ravi@neighborlink.local', 'Reliable Home Plumbing', 'Plumbing', 450, 9, ['Leak repair', 'Pipes', 'Fittings'], 4.8],
    ['Priya Sharma', 'priya@neighborlink.local', 'Professional Home Cleaning', 'Home Cleaning', 550, 5, ['Deep cleaning', 'Sanitisation'], 4.9],
    ['Vikram Das', 'vikram@neighborlink.local', 'Electrical Repair', 'Electrical', 500, 11, ['Wiring', 'Fans', 'Safety'], 4.7],
    ['Meera Nair', 'meera@neighborlink.local', 'Fresh Home-style Meals', 'Cooking', 400, 7, ['South Indian', 'Meal preparation'], 4.9],
    ['Arjun Patel', 'arjun@neighborlink.local', 'Laptop & Desktop Repair', 'Computer Repair', 600, 8, ['Diagnostics', 'Software', 'Hardware'], 4.6]
];

export async function seedDatabase() {
    for (const model of allModels) await model.deleteMany({});
    const passwordHash = await bcrypt.hash(demoPassword, 10);

    const categoryIds = new Map();
    for (const [name, slug, icon, description] of categories) {
        const category = await Category.create({ _id: createId(), name, slug, icon, description });
        categoryIds.set(name, category._id);
    }

    const adminId = createId();
    const customerId = createId();
    await User.create([
        { _id: adminId, fullName: 'Aditi Admin', email: 'admin@neighborlink.local', passwordHash, phone: '9000000001', role: 'admin', neighborhood: 'Central Area', city: 'Bengaluru' },
        { _id: customerId, fullName: 'Kiran Customer', email: 'customer@neighborlink.local', passwordHash, phone: '9876543210', role: 'customer', neighborhood: 'Central Area', city: 'Bengaluru' }
    ]);

    const customerIds = [customerId];
    for (let index = 1; index <= 5; index += 1) {
        const id = createId();
        customerIds.push(id);
        await User.create({ _id: id, fullName: `Community Member ${index}`, email: `member${index}@neighborlink.local`, passwordHash, role: 'customer', neighborhood: `Neighborhood ${index}`, city: 'Bengaluru' });
    }

    const providers = [];
    for (let index = 0; index < providerSeed.length; index += 1) {
        const [name, email, serviceTitle, categoryName, price, experience, skills, rating] = providerSeed[index];
        const user = await User.create({ _id: createId(), fullName: name, email, passwordHash, phone: `90000000${String(index + 10)}`, role: 'provider', neighborhood: `Neighborhood ${index + 1}`, city: 'Bengaluru' });
        const isVerified = index !== 1;
        const provider = await ProviderProfile.create({
            _id: createId(),
            userId: user._id,
            bio: `${name} is a friendly local professional focused on dependable service and clear communication.`,
            experienceYears: experience,
            location: 'Bengaluru',
            skills,
            verified: isVerified,
            verificationStatus: isVerified ? 'verified' : 'pending',
            rating,
            reviewCount: 4 + index,
            completedJobs: 12 + index * 4,
            serviceRadiusKm: 7
        });
        const service = await Service.create({
            _id: createId(),
            providerId: provider._id,
            categoryId: categoryIds.get(categoryName),
            title: serviceTitle,
            description: `Professional ${serviceTitle.toLowerCase()} delivered in your neighborhood.`,
            price,
            durationMin: categoryName === 'Tutoring' ? 60 : 90
        });
        await Service.create({
            _id: createId(),
            providerId: provider._id,
            categoryId: categoryIds.get(categoryName),
            title: `${serviceTitle} - Extended Visit`,
            description: 'A longer appointment for larger or more detailed work.',
            price: price + 200,
            durationMin: 120
        });
        for (let day = 1; day <= 6; day += 1) {
            await Availability.create({ _id: createId(), providerId: provider._id, dayOfWeek: day, startTime: day === 6 ? '10:00' : '09:00', endTime: day === 6 ? '16:00' : '18:00' });
        }
        providers.push({ userId: user._id, providerId: provider._id, serviceId: service._id, price, name });
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
        const isPaid = status === 'completed' || (status === 'accepted' && index === 2);
        const booking = await Booking.create({
            _id: createId(),
            customerId: customerIds[index % customerIds.length],
            providerId: provider.providerId,
            serviceId: provider.serviceId,
            scheduledStart: start,
            scheduledEnd: end,
            address: 'Central Area, Bengaluru',
            notes: 'Please call when you arrive.',
            status,
            paymentStatus: isPaid ? 'paid' : 'pending',
            totalAmount: provider.price,
            completedAt: status === 'completed' ? end : null
        });
        bookings.push({ id: booking._id, status, provider, customerId: customerIds[index % customerIds.length], price: provider.price });

        if (isPaid) {
            const fee = provider.price * 0.1;
            await Payment.create({ _id: createId(), bookingId: booking._id, customerId: booking.customerId, providerId: provider.providerId, amount: provider.price, platformFee: fee, providerAmount: provider.price - fee, paymentMethod: 'demo', paymentStatus: 'paid', paidAt: new Date() });
        }
        if (status === 'completed') {
            await Review.create({ _id: createId(), bookingId: booking._id, customerId: booking.customerId, providerId: provider.providerId, rating: index % 3 === 0 ? 4 : 5, comment: 'Friendly, punctual and skilled. I would happily book this provider again.' });
        }
    }

    await Favorite.create({ _id: createId(), userId: customerId, providerId: providers[0].providerId });
    await Message.create([
        { _id: createId(), senderId: customerId, receiverId: providers[0].userId, bookingId: bookings[0].id, message: 'Hi Ananya, I am looking forward to our session.', createdAt: new Date(Date.now() - 60_000) },
        { _id: createId(), senderId: providers[0].userId, receiverId: customerId, bookingId: bookings[0].id, message: 'Great! I will bring a few practice worksheets.' }
    ]);
    await Notification.create([
        { _id: createId(), userId: customerId, title: 'Booking accepted', message: 'Your local provider accepted the booking.', type: 'booking', link: `/bookings/${bookings[2].id}` },
        { _id: createId(), userId: providers[0].userId, title: 'New message', message: 'Kiran sent you a message.', type: 'message', link: `/messages/${customerId}` }
    ]);
    await Report.create({ _id: createId(), reporterId: customerId, reportedUserId: providers[1].userId, bookingId: bookings[1].id, reason: 'Service quality concern', description: 'Please review the service details and help resolve my concern.' });
    await VerificationRequest.create({ _id: createId(), providerId: providers[1].providerId, documentPath: 'fixtures/demo-verification.txt', documentType: 'identity', status: 'pending' });

    for (const provider of providers) {
        const reviews = await Review.find({ providerId: provider.providerId }).lean();
        const completedJobs = await Booking.countDocuments({ providerId: provider.providerId, status: 'completed' });
        await ProviderProfile.updateOne(
            { _id: provider.providerId },
            { $set: { rating: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0, reviewCount: reviews.length, completedJobs } }
        );
    }

    console.log(`Seeded NeighborLink MongoDB data. Demo password: ${demoPassword}`);
}
