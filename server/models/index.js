import mongoose from '../config/db.js';

const { Schema, model, models } = mongoose;

function schema(definition, options = {}) {
    return new Schema(definition, {
        timestamps: true,
        versionKey: false,
        ...options
    });
}

const baseString = { type: String, trim: true };

const UserSchema = schema({
    _id: { type: String, required: true },
    fullName: { ...baseString, required: true },
    email: { ...baseString, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    phone: baseString,
    role: { type: String, enum: ['customer', 'provider', 'admin'], default: 'customer' },
    neighborhood: baseString,
    city: baseString,
    profileImage: baseString,
    isActive: { type: Boolean, default: true }
});

const CategorySchema = schema({
    _id: { type: String, required: true },
    name: { ...baseString, required: true },
    slug: { ...baseString, required: true, unique: true },
    icon: baseString,
    description: baseString,
    isActive: { type: Boolean, default: true }
});

const ProviderProfileSchema = schema({
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    bio: { type: String, required: true },
    skills: [{ type: String, trim: true }],
    experienceYears: { type: Number, default: 0 },
    serviceRadiusKm: { type: Number, default: 5 },
    location: baseString,
    verified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['not_verified', 'pending', 'verified', 'rejected'], default: 'not_verified' },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    isAcceptingWork: { type: Boolean, default: true }
});

const ServiceSchema = schema({
    _id: { type: String, required: true },
    providerId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true, index: true },
    title: { ...baseString, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    durationMin: { type: Number, default: 60 },
    isActive: { type: Boolean, default: true }
});

const AvailabilitySchema = schema({
    _id: { type: String, required: true },
    providerId: { type: String, required: true, index: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isAvailable: { type: Boolean, default: true }
});
AvailabilitySchema.index({ providerId: 1, dayOfWeek: 1 }, { unique: true });

const BookingSchema = schema({
    _id: { type: String, required: true },
    customerId: { type: String, required: true, index: true },
    providerId: { type: String, required: true, index: true },
    serviceId: { type: String, required: true, index: true },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    address: baseString,
    notes: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled', 'in_progress', 'completed'], default: 'pending' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
    totalAmount: { type: Number, required: true },
    cancelledBy: String,
    acceptedAt: Date,
    completedAt: Date
});

const PaymentSchema = schema({
    _id: { type: String, required: true },
    bookingId: { type: String, required: true, unique: true },
    customerId: { type: String, required: true, index: true },
    providerId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    providerAmount: { type: Number, required: true },
    paymentMethod: { type: String, default: 'demo' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
    paidAt: Date
});

const ReviewSchema = schema({
    _id: { type: String, required: true },
    bookingId: { type: String, required: true, unique: true },
    customerId: { type: String, required: true, index: true },
    providerId: { type: String, required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, required: true }
});

const MessageSchema = schema({
    _id: { type: String, required: true },
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    bookingId: String,
    message: { type: String, required: true }
});

const NotificationSchema = schema({
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, required: true },
    link: String,
    isRead: { type: Boolean, default: false }
});

const FavoriteSchema = schema({
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    providerId: { type: String, required: true, index: true }
});
FavoriteSchema.index({ userId: 1, providerId: 1 }, { unique: true });

const VerificationRequestSchema = schema({
    _id: { type: String, required: true },
    providerId: { type: String, required: true, index: true },
    documentPath: { type: String, required: true },
    documentType: { type: String, default: 'identity' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNote: String,
    reviewedAt: Date
});

const ReportSchema = schema({
    _id: { type: String, required: true },
    reporterId: { type: String, required: true, index: true },
    reportedUserId: String,
    bookingId: String,
    reason: { type: String, required: true },
    description: String,
    status: { type: String, enum: ['open', 'resolved', 'rejected'], default: 'open' },
    adminNote: String
});

export const User = models.User || model('User', UserSchema);
export const Category = models.Category || model('Category', CategorySchema);
export const ProviderProfile = models.ProviderProfile || model('ProviderProfile', ProviderProfileSchema);
export const Service = models.Service || model('Service', ServiceSchema);
export const Availability = models.Availability || model('Availability', AvailabilitySchema);
export const Booking = models.Booking || model('Booking', BookingSchema);
export const Payment = models.Payment || model('Payment', PaymentSchema);
export const Review = models.Review || model('Review', ReviewSchema);
export const Message = models.Message || model('Message', MessageSchema);
export const Notification = models.Notification || model('Notification', NotificationSchema);
export const Favorite = models.Favorite || model('Favorite', FavoriteSchema);
export const VerificationRequest = models.VerificationRequest || model('VerificationRequest', VerificationRequestSchema);
export const Report = models.Report || model('Report', ReportSchema);

export const allModels = [
    Report, VerificationRequest, Notification, Message, Favorite, Review, Payment,
    Booking, Availability, Service, ProviderProfile, Category, User
];
