import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarService } from '../src/server/services/calendarService.js';
import { SHOP_CONFIG } from '../src/server/domain/shopConfig.js';

describe('CalendarService — Availability & Conflict Calculation', () => {
  let calendar: CalendarService;

  beforeEach(async () => {
    calendar = new CalendarService();
    await calendar.clearAll();
    await calendar.seedInitialEvents();
  });

  it('correctly detects conflict at Thursday 3:30 PM and recommends 4:30 PM', async () => {
    const nextThursday = calendar.resolveNextDateForWeekday('thursday');
    const slot330 = new Date(nextThursday);
    slot330.setHours(15, 30, 0, 0); // 3:30 PM

    const availability = await calendar.checkSlotAvailability(slot330.toISOString(), 90);

    expect(availability.available).toBe(false);
    expect(availability.conflictCount).toBe(2);
    expect(availability.suggestedSlot).toBeDefined();
    // Recommends 4:30 PM
    expect(availability.suggestedSlot?.formattedTime).toBe('4:30 PM');
  });

  it('rejects appointments outside business hours', async () => {
    const nextThursday = calendar.resolveNextDateForWeekday('thursday');
    const eveningSlot = new Date(nextThursday);
    eveningSlot.setHours(19, 0, 0, 0); // 7:00 PM (Shop closes at 6:00 PM)

    const availability = await calendar.checkSlotAvailability(eveningSlot.toISOString(), 60);

    expect(availability.available).toBe(false);
    expect(availability.reason).toContain('Outside business hours');
  });

  it('rejects appointments on Sundays', async () => {
    const nextSunday = calendar.resolveNextDateForWeekday('sunday');
    const sunSlot = new Date(nextSunday);
    sunSlot.setHours(11, 0, 0, 0);

    const availability = await calendar.checkSlotAvailability(sunSlot.toISOString(), 60);

    expect(availability.available).toBe(false);
    expect(availability.reason).toContain('closed on Sundays');
  });

  it('books an appointment and prevents double-booking when capacity reached', async () => {
    const nextFriday = calendar.resolveNextDateForWeekday('friday');
    const friSlot = new Date(nextFriday);
    friSlot.setHours(10, 0, 0, 0); // 10:00 AM Friday

    const booking = await calendar.createBooking({
      customerName: 'Marcus Vance',
      customerPhone: '4155551234',
      serviceId: 'interior-wash',
      startTime: friSlot.toISOString(),
    });

    expect(booking.customerName).toBe('Marcus Vance');
    expect(booking.customerPhone).toBe('(415) 555-1234');
    expect(booking.status).toBe('confirmed');

    // Bay 2 should still be open
    const check1 = await calendar.checkSlotAvailability(friSlot.toISOString(), 90);
    expect(check1.available).toBe(true);

    // Book Bay 2
    await calendar.createBooking({
      customerName: 'Elena Rostova',
      customerPhone: '4155559876',
      serviceId: 'interior-wash',
      startTime: friSlot.toISOString(),
    });

    // Now both bays are full -> should be unavailable
    const check2 = await calendar.checkSlotAvailability(friSlot.toISOString(), 90);
    expect(check2.available).toBe(false);
  });
});

