import db from '../config/db.js';
import jwt from 'jsonwebtoken';
import fs from 'node:fs/promises';
import { createId, httpError } from '../utils/helpers.js';
import { requireNumber, requireText } from '../utils/validation.js';

export async function updateProfile(request, response) {
    const { fullName, phone, neighborhood, city } = request.body;
    if (fullName !== undefined && String(fullName).trim().length < 2) {
        throw httpError(422, 'Please enter a valid full name.');
    }

    await db.query(
        `UPDATE users SET
         full_name = COALESCE(?, full_name),
         phone = COALESCE(?, phone),
         neighborhood = COALESCE(?, neighborhood),
         city = COALESCE(?, city)
         WHERE id = ?`,
        [fullName ? String(fullName).trim() : null, phone ?? null, neighborhood ?? null, city ?? null, request.user.id]
    );
    return response.json({ message: 'Profile updated.' });
}

export async function becomeProvider(request, response) {
    const { bio, skills, experienceYears, serviceRadiusKm, location } = request.body;
    requireText(bio, 'Bio', 20, 5000);
    if (experienceYears !== undefined) requireNumber(experienceYears, 'Experience', 0, 80, true);
    if (serviceRadiusKm !== undefined) requireNumber(serviceRadiusKm, 'Service radius', 1, 100, true);
    if (location !== undefined) requireText(location, 'Location', 2, 120);
    const skillText = Array.isArray(skills) ? skills.join(', ') : skills;
    requireText(skillText, 'Skills', 1, 500);
    const [existing] = await db.query('SELECT id FROM provider_profiles WHERE user_id = ?', [request.user.id]);
    if (existing.length) {
        throw httpError(409, 'You already have a provider profile.');
    }
    if (!bio || String(bio).trim().length < 20) {
        throw httpError(422, 'Please provide a short description of your work.');
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const providerId = createId();
        await connection.query(
            `INSERT INTO provider_profiles
             (id, user_id, bio, skills, experience_years, service_radius_km, location)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [providerId, request.user.id, String(bio).trim(), skillText, Number(experienceYears) || 0, Number(serviceRadiusKm) || 5, location || null]
        );
        await connection.query('UPDATE users SET role = ? WHERE id = ?', ['provider', request.user.id]);
        await connection.commit();
        const token = jwt.sign(
            { id: request.user.id, role: 'provider' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [request.user.id]);
        const user = users[0];
        return response.status(201).json({
            token,
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                neighborhood: user.neighborhood,
                city: user.city,
                avatarUrl: user.profile_image,
                providerProfile: { id: providerId, verificationStatus: 'not_verified', averageRating: 0 }
            },
            message: 'Your provider profile is ready.'
        });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function submitVerification(request, response) {
    if (!request.file) {
        throw httpError(422, 'Upload a PDF, PNG, JPG or WEBP document under 5 MB.');
    }

    const [profiles] = await db.query('SELECT id FROM provider_profiles WHERE user_id = ?', [request.user.id]);
    if (!profiles.length) {
        throw httpError(404, 'Provider profile not found.');
    }
    const [pending] = await db.query("SELECT id FROM verification_requests WHERE provider_id = ? AND status = 'pending'", [profiles[0].id]);
    if (pending.length) {
        await fs.unlink(request.file.path);
        throw httpError(409, 'You already have a verification request awaiting review.');
    }

    const verificationId = createId();
    await db.query(
        `INSERT INTO verification_requests
         (id, provider_id, document_path, document_type)
         VALUES (?, ?, ?, ?)`,
        [verificationId, profiles[0].id, request.file.path, request.body.documentType || 'identity']
    );
    await db.query(
        'UPDATE provider_profiles SET verified = FALSE, verification_status = ? WHERE id = ?',
        ['pending', profiles[0].id]
    );
    return response.status(201).json({ id: verificationId, status: 'pending' });
}
