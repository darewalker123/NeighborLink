import { describe, expect, it } from 'vitest';
import { intervalsOverlap, isWithinAvailability } from './bookingRules.js';
describe('booking availability rules', () => {
  it('allows a booking fully inside a configured working window', () => expect(isWithinAvailability('09:00', '18:00', new Date('2026-08-26T10:00:00'), new Date('2026-08-26T11:30:00'))).toBe(true));
  it('rejects a booking beyond the configured end time', () => expect(isWithinAvailability('09:00', '18:00', new Date('2026-08-26T17:30:00'), new Date('2026-08-26T19:00:00'))).toBe(false));
  it('detects overlapping provider appointments', () => expect(intervalsOverlap(new Date('2026-08-26T10:00:00'), new Date('2026-08-26T11:00:00'), new Date('2026-08-26T10:30:00'), new Date('2026-08-26T11:30:00'))).toBe(true));
});
