import jwt from 'jsonwebtoken';
import fs from 'node:fs/promises';
import { ProviderProfile, User, VerificationRequest } from '../models/index.js';
import { createId, httpError } from '../utils/helpers.js';
import { requireNumber, requireText } from '../utils/validation.js';

export async function updateProfile(request, response) {
    const { fullName, phone, neighborhood, city } = request.body;
    if (fullName !== undefined && String(fullName).trim().length < 2) {
        throw httpError(422, 'Please enter a valid full name.');
    }
    const update = {};
    if (fullName !== undefined) update.fullName = String(fullName).trim();
    if (phone !== undefined) update.phone = phone;
    if (neighborhood !== undefined) update.neighborhood = neighborhood;
    if (city !== undefined) update.city = city;
    await User.updateOne({ _id: request.user.id }, { $set: update });
    return response.json({ message: 'Profile updated.' });
}

export async function becomeProvider(request, response) {
    const { bio, skills, experienceYears, serviceRadiusKm, location } = request.body;
    requireText(bio, 'Bio', 20, 5000);
    if (experienceYears !== undefined) requireNumber(experienceYears, 'Experience', 0, 80, true);
    if (serviceRadiusKm !== undefined) requireNumber(serviceRadiusKm, 'Service radius', 1, 100, true);
    if (location !== undefined) requireText(location, 'Location', 2, 120);
    const skillList = Array.isArray(skills) ? skills.map((skill) => String(skill).trim()).filter(Boolean) : String(skills || '').split(',').map((skill) => skill.trim()).filter(Boolean);
    requireText(skillList.join(', '), 'Skills', 1, 500);

    if (await ProviderProfile.exists({ userId: request.user.id })) {
        throw httpError(409, 'You already have a provider profile.');
    }

    const providerId = createId();
    await ProviderProfile.create({
        _id: providerId,
        userId: request.user.id,
        bio: String(bio).trim(),
        skills: skillList,
        experienceYears: Number(experienceYears) || 0,
        serviceRadiusKm: Number(serviceRadiusKm) || 5,
        location: location || null
    });
    const user = await User.findByIdAndUpdate(request.user.id, { $set: { role: 'provider' } }, { new: true }).lean();
    const token = jwt.sign({ id: request.user.id, role: 'provider' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return response.status(201).json({
        token,
        user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            neighborhood: user.neighborhood,
            city: user.city,
            avatarUrl: user.profileImage,
            providerProfile: { id: providerId, verificationStatus: 'not_verified', averageRating: 0 }
        },
        message: 'Your provider profile is ready.'
    });
}

export async function submitVerification(request, response) {
    if (!request.file) {
        throw httpError(422, 'Upload a PDF, PNG, JPG or WEBP document under 5 MB.');
    }
    const provider = await ProviderProfile.findOne({ userId: request.user.id }).lean();
    if (!provider) throw httpError(404, 'Provider profile not found.');
    if (await VerificationRequest.exists({ providerId: provider._id, status: 'pending' })) {
        await fs.unlink(request.file.path);
        throw httpError(409, 'You already have a verification request awaiting review.');
    }

    const verification = await VerificationRequest.create({
        _id: createId(),
        providerId: provider._id,
        documentPath: request.file.path,
        documentType: request.body.documentType || 'identity'
    });
    await ProviderProfile.updateOne(
        { _id: provider._id },
        { $set: { verified: false, verificationStatus: 'pending' } }
    );
    return response.status(201).json({ id: verification._id, status: 'pending' });
}
