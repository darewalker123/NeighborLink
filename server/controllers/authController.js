import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ProviderProfile, User } from '../models/index.js';
import { createId, httpError } from '../utils/helpers.js';
import { publicUser } from '../utils/mappers.js';
import { requireText } from '../utils/validation.js';

async function findUserById(id) {
    const user = await User.findById(id).lean();
    if (!user) return null;
    const provider = await ProviderProfile.findOne({ userId: user._id }).lean();
    return { user, provider };
}

function createSession(user, provider) {
    const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
    return { token, accessToken: token, user: publicUser(user, provider) };
}

export async function register(request, response) {
    const { fullName, email, phone, password, neighborhood, city } = request.body;

    requireText(fullName, 'Full name', 2, 80);
    if (typeof email !== 'string' || email.length > 120 || !/^\S+@\S+\.\S+$/.test(email.trim())) {
        throw httpError(422, 'Please enter a valid email address.');
    }
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
        throw httpError(422, 'Password must contain at least 8 characters and at most 72 bytes.');
    }
    requireText(neighborhood, 'Neighborhood', 2, 100);
    if (phone) requireText(phone, 'Phone', 7, 20);
    if (city) requireText(city, 'City', 2, 80);

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
        throw httpError(409, 'An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
        _id: createId(),
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        phone: phone || null,
        neighborhood: neighborhood.trim(),
        city: city || null
    });

    return response.status(201).json(createSession(user.toObject(), null));
}

export async function login(request, response) {
    const { email, password } = request.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        throw httpError(422, 'Email and password are required.');
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).lean();
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw httpError(401, 'Email or password is incorrect.');
    }
    if (!user.isActive) {
        throw httpError(403, 'This account has been suspended. Contact the administrator.');
    }

    const provider = await ProviderProfile.findOne({ userId: user._id }).lean();
    return response.json(createSession(user, provider));
}

export async function getCurrentUser(request, response) {
    const result = await findUserById(request.user.id);
    if (!result?.user || !result.user.isActive) {
        throw httpError(401, 'User account was not found.');
    }
    return response.json(publicUser(result.user, result.provider));
}

export function demoPasswordReset(_request, response) {
    return response.json({
        message: 'Academic demo: password-reset email delivery is not connected.'
    });
}
