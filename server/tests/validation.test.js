import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAvailabilitySlot, validateServiceDetails } from '../utils/validation.js';

test('service validation rejects invalid numeric values before SQL', () => {
    for (const price of [undefined, '', null, true, 'not a price', -1, 0]) {
        assert.throws(() => validateServiceDetails({ title: 'Tutoring', description: 'Math lessons', categoryId: 'demo', price }));
    }
    assert.doesNotThrow(() => validateServiceDetails({ title: 'Tutoring', description: 'Math lessons', categoryId: 'demo', price: 500, durationMin: 60 }));
    assert.throws(() => validateServiceDetails({ durationMin: -60 }, true));
});

test('availability requires a real weekday and a forward same-day range', () => {
    assert.doesNotThrow(() => validateAvailabilitySlot({ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }));
    for (const slot of [
        { dayOfWeek: 8, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 1, startTime: '18:00', endTime: '09:00' },
        { dayOfWeek: 1, startTime: '09:00', endTime: '25:00' }
    ]) assert.throws(() => validateAvailabilitySlot(slot));
});
