import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { createId, httpError } from '../utils/helpers.js';
import { requireText } from '../utils/validation.js';

function publicUser(row) {
    return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        neighborhood: row.neighborhood,
        city: row.city,
        avatarUrl: row.profile_image,
        status: row.is_active ? 'active' : 'suspended',
        providerProfile: row.provider_id ? {
            id: row.provider_id,
            verificationStatus: row.verification_status,
            averageRating: Number(row.rating || 0)
        } : null
    };
}

async function findUserById(id) {
    const [rows] = await db.query(
        `SELECT u.*, p.id AS provider_id, p.verification_status, p.rating
         FROM users u
         LEFT JOIN provider_profiles p ON p.user_id = u.id
         WHERE u.id = ?`,
        [id]
    );
    return rows[0];
}

function createSession(user) {
    const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
    return { token, accessToken: token, user: publicUser(user) };
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
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length) {
        throw httpError(409, 'An account with this email already exists.');
    }

    const userId = createId();
    const passwordHash = await bcrypt.hash(password, 10);

    // Store only the bcrypt hash. The plain-text password is never saved.
    await db.query(
        `INSERT INTO users
         (id, full_name, email, password_hash, phone, neighborhood, city)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, fullName.trim(), normalizedEmail, passwordHash, phone || null, neighborhood.trim(), city || null]
    );

    const user = await findUserById(userId);
    return response.status(201).json(createSession(user));
}

export async function login(request, response) {
    const { email, password } = request.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        throw httpError(422, 'Email and password are required.');
    }

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        throw httpError(401, 'Email or password is incorrect.');
    }
    if (!user.is_active) {
        throw httpError(403, 'This account has been suspended. Contact the administrator.');
    }

    const completeUser = await findUserById(user.id);
    return response.json(createSession(completeUser));
}

export async function getCurrentUser(request, response) {
    const user = await findUserById(request.user.id);
    if (!user || !user.is_active) {
        throw httpError(401, 'User account was not found.');
    }
    return response.json(publicUser(user));
}

export function demoPasswordReset(_request, response) {
    return response.json({
        message: 'Academic demo: password-reset email delivery is not connected.'
    });
}
