import { httpError } from './helpers.js';

export function requireText(value, label, min, max) {
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
        throw httpError(422, `${label} must contain ${min} to ${max} characters.`);
    }
}

export function requireNumber(value, label, min, max, integer = false) {
    const number = Number(value);
    if (value === '' || value === null || typeof value === 'boolean' || !Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
        throw httpError(422, `${label} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`);
    }
}

export function validateServiceDetails(body, partial = false) {
    if (!partial || body.title !== undefined) requireText(body.title, 'Title', 2, 120);
    if (!partial || body.description !== undefined) requireText(body.description, 'Description', 5, 5000);
    if (!partial || body.categoryId !== undefined) requireText(body.categoryId, 'Category', 1, 36);
    if (!partial || body.price !== undefined) requireNumber(body.price, 'Price', 1, 999999.99);
    if (body.durationMin !== undefined) requireNumber(body.durationMin, 'Duration in minutes', 15, 480, true);
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') throw httpError(422, 'Service status must be true or false.');
}

export function validateAvailabilitySlot(slot) {
    requireNumber(slot.dayOfWeek, 'Day', 0, 6, true);
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(slot.startTime) || !time.test(slot.endTime) || slot.startTime >= slot.endTime) {
        throw httpError(422, 'Availability needs a valid start time before the end time on the same day.');
    }
    if (slot.isAvailable !== undefined && typeof slot.isAvailable !== 'boolean') throw httpError(422, 'Availability status must be true or false.');
}
