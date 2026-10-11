import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { getGoogleAuthClient } from './googleAuth.js';
import {
  CalendarEvent,
  SlotAvailability,
  BookingRequest,
  ICalendarService,
} from './types.js';
import { SHOP_CONFIG, SHOP_SERVICES } from '../domain/shopConfig.js';
import { parsePhoneNumber } from '../domain/phoneParser.js';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const CALENDAR_STORE_FILE = path.join(DATA_DIR, 'calendar.json');

export class CalendarService implements ICalendarService {
  private events: CalendarEvent[] = [];

  constructor() {
    this.ensureStorage();
    this.loadFromStorage();
  }

  private ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CALENDAR_STORE_FILE)) {
      fs.writeFileSync(CALENDAR_STORE_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private loadFromStorage() {
    try {
      const data = fs.readFileSync(CALENDAR_STORE_FILE, 'utf-8');
      this.events = JSON.parse(data);
    } catch {
      this.events = [];
    }
  }

  private saveToStorage() {
    fs.writeFileSync(CALENDAR_STORE_FILE, JSON.stringify(this.events, null, 2), 'utf-8');
  }

  /**
   * Helper to resolve the next occurrence of a weekday (e.g. "Thursday")
   */
  public resolveNextDateForWeekday(weekdayName: string): Date {
    const days: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const targetDay = days[weekdayName.toLowerCase()];
    const now = new Date();
    if (targetDay === undefined) return now;

    const result = new Date(now);
    const currentDay = now.getDay();
    let distance = targetDay - currentDay;
    if (distance <= 0) {
      distance += 7;
    }
    result.setDate(now.getDate() + distance);
    return result;
  }

  public async listEvents(startRangeIso: string, endRangeIso: string): Promise<CalendarEvent[]> {
    if (config.google.isCalendarConfigured) {
      try {
        const auth = await getGoogleAuthClient();
        if (auth) {
          const { google } = await import('googleapis');
          const calendar = google.calendar({ version: 'v3', auth });
          const res = await calendar.events.list({
            calendarId: config.google.calendarId,
            timeMin: startRangeIso,
            timeMax: endRangeIso,
            singleEvents: true,
            orderBy: 'startTime',
          });

          return (res.data.items || []).map((item) => ({
            id: item.id || '',
            summary: item.summary || '',
            description: item.description || '',
            startTime: item.start?.dateTime || item.start?.date || '',
            endTime: item.end?.dateTime || item.end?.date || '',
            customerName: item.extendedProperties?.private?.customerName || item.summary?.split(' - ')[1] || 'Guest',
            customerPhone: item.extendedProperties?.private?.customerPhone || '',
            serviceName: item.extendedProperties?.private?.serviceName || '',
            status: 'confirmed',
          }));
        }
      } catch (err) {
        console.warn('Google Calendar API error, falling back to local store:', err);
      }
    }

    // Local fallback/sync
    const start = new Date(startRangeIso).getTime();
    const end = new Date(endRangeIso).getTime();
    return this.events
      .filter((e) => {
        const eStart = new Date(e.startTime).getTime();
        const eEnd = new Date(e.endTime).getTime();
        return eStart < end && eEnd > start && e.status !== 'cancelled';
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  public async checkSlotAvailability(
    startTimeIso: string,
    durationMinutes: number
  ): Promise<SlotAvailability> {
    const reqStart = new Date(startTimeIso);
    const reqEnd = new Date(reqStart.getTime() + durationMinutes * 60 * 1000);

    // Check business hours: 8am - 6pm (18:00)
    const hours = reqStart.getHours();
    const minutes = reqStart.getMinutes();
    const endHour = reqEnd.getHours();
    const endMinutes = reqEnd.getMinutes();

    const isBeforeOpen = hours < SHOP_CONFIG.businessHours.openHour;
    const isAfterClose =
      endHour > SHOP_CONFIG.businessHours.closeHour ||
      (endHour === SHOP_CONFIG.businessHours.closeHour && endMinutes > 0);

    if (isBeforeOpen || isAfterClose) {
      return {
        available: false,
        requestedSlot: { start: reqStart.toISOString(), end: reqEnd.toISOString() },
        conflictCount: 0,
        reason: `Outside business hours (Shop is open ${SHOP_CONFIG.businessHours.openHour}:00 AM - ${SHOP_CONFIG.businessHours.closeHour}:00 PM).`,
      };
    }

    // Check Sunday closure (0 = Sunday)
    if (reqStart.getDay() === 0) {
      return {
        available: false,
        requestedSlot: { start: reqStart.toISOString(), end: reqEnd.toISOString() },
        conflictCount: 0,
        reason: 'Cedar Lane Auto Detailing is closed on Sundays.',
      };
    }

    // Check overlap with existing events on that day
    const dayStart = new Date(reqStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(reqStart);
    dayEnd.setHours(23, 59, 59, 999);

    const existingEvents = await this.listEvents(dayStart.toISOString(), dayEnd.toISOString());

    // Count overlapping appointments
    const overlapping = existingEvents.filter((e) => {
      if (e.status === 'cancelled') return false;
      const eStart = new Date(e.startTime).getTime();
      const eEnd = new Date(e.endTime).getTime();
      return eStart < reqEnd.getTime() && eEnd > reqStart.getTime();
    });

    const maxBays = SHOP_CONFIG.businessHours.bays;
    const isAvailable = overlapping.length < maxBays;

    if (isAvailable) {
      return {
        available: true,
        requestedSlot: { start: reqStart.toISOString(), end: reqEnd.toISOString() },
        conflictCount: overlapping.length,
      };
    }

    // Find next available slot on the same day in 30-min intervals
    let suggestedSlot: { start: string; end: string; formattedTime: string } | undefined;
    const candidate = new Date(reqStart);

    for (let offsetMinutes = 30; offsetMinutes <= 240; offsetMinutes += 30) {
      candidate.setTime(reqStart.getTime() + offsetMinutes * 60 * 1000);
      const candEnd = new Date(candidate.getTime() + durationMinutes * 60 * 1000);

      const candEndHour = candEnd.getHours();
      const candEndMinutes = candEnd.getMinutes();
      if (
        candEndHour > SHOP_CONFIG.businessHours.closeHour ||
        (candEndHour === SHOP_CONFIG.businessHours.closeHour && candEndMinutes > 0)
      ) {
        break; // Exceeds closing time
      }

      const candOverlap = existingEvents.filter((e) => {
        if (e.status === 'cancelled') return false;
        const eStart = new Date(e.startTime).getTime();
        const eEnd = new Date(e.endTime).getTime();
        return eStart < candEnd.getTime() && eEnd > candidate.getTime();
      });

      if (candOverlap.length < maxBays) {
        // Found an open slot! Format e.g. "4:30 PM"
        const hours12 = candidate.getHours() % 12 || 12;
        const mins = candidate.getMinutes().toString().padStart(2, '0');
        const ampm = candidate.getHours() >= 12 ? 'PM' : 'AM';
        suggestedSlot = {
          start: candidate.toISOString(),
          end: candEnd.toISOString(),
          formattedTime: `${hours12}:${mins} ${ampm}`,
        };
        break;
      }
    }

    return {
      available: false,
      requestedSlot: { start: reqStart.toISOString(), end: reqEnd.toISOString() },
      conflictCount: overlapping.length,
      reason: 'Requested time slot is fully booked.',
      suggestedSlot,
    };
  }

  public async createBooking(booking: BookingRequest): Promise<CalendarEvent> {
    const service = SHOP_SERVICES[booking.serviceId] || SHOP_SERVICES['interior-wash'];
    const startTime = new Date(booking.startTime);
    const endTime = new Date(startTime.getTime() + service.durationMinutes * 60 * 1000);

    const eventId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const normalizedPhone = parsePhoneNumber(booking.customerPhone);

    const event: CalendarEvent = {
      id: eventId,
      summary: `[Cedar Lane] ${service.name} - ${booking.customerName}`,
      description: `Customer: ${booking.customerName}\nPhone: ${normalizedPhone}\nService: ${service.name} ($${service.price})\nVehicle: ${booking.vehicleType || 'Standard Sedan'}\nNotes: ${booking.notes || 'None'}`,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      customerName: booking.customerName,
      customerPhone: normalizedPhone,
      serviceId: service.id,
      serviceName: service.name,
      vehicleType: booking.vehicleType || 'Standard Sedan',
      status: 'confirmed',
    };

    if (config.google.isCalendarConfigured) {
      try {
        const auth = await getGoogleAuthClient();
        if (auth) {
          const { google } = await import('googleapis');
          const calendar = google.calendar({ version: 'v3', auth });
          const googleRes = await calendar.events.insert({
            calendarId: config.google.calendarId,
            requestBody: {
              summary: event.summary,
              description: event.description,
              start: { dateTime: event.startTime, timeZone: config.shopTimezone },
              end: { dateTime: event.endTime, timeZone: config.shopTimezone },
              extendedProperties: {
                private: {
                  customerName: booking.customerName,
                  customerPhone: normalizedPhone,
                  serviceId: service.id,
                  serviceName: service.name,
                },
              },
            },
          });
          if (googleRes.data.id) {
            event.id = googleRes.data.id;
          }
        }
      } catch (err) {
        console.warn('Google Calendar insert error, saved locally:', err);
      }
    }

    this.events.push(event);
    this.saveToStorage();
    return event;
  }

  public async findBookingByCustomer(
    customerPhone: string,
    customerName?: string
  ): Promise<CalendarEvent | undefined> {
    const cleanPhone = parsePhoneNumber(customerPhone).replace(/\D/g, '');
    const cleanName = customerName?.toLowerCase().trim();

    return this.events.find((e) => {
      if (e.status === 'cancelled') return false;
      const eventPhoneDigits = e.customerPhone.replace(/\D/g, '');
      const phoneMatch = cleanPhone.length >= 7 && eventPhoneDigits.includes(cleanPhone);
      const nameMatch = cleanName && e.customerName.toLowerCase().includes(cleanName);
      return phoneMatch || nameMatch;
    });
  }

  public async rescheduleBooking(
    bookingId: string,
    newStartTimeIso: string,
    durationMinutes: number = 90
  ): Promise<CalendarEvent> {
    const event = this.events.find((e) => e.id === bookingId);
    if (!event) {
      throw new Error(`Appointment with ID ${bookingId} not found.`);
    }

    const newStart = new Date(newStartTimeIso);
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);

    event.startTime = newStart.toISOString();
    event.endTime = newEnd.toISOString();
    event.status = 'rescheduled';

    if (config.google.isCalendarConfigured) {
      try {
        const auth = await getGoogleAuthClient();
        if (auth) {
          const { google } = await import('googleapis');
          const calendar = google.calendar({ version: 'v3', auth });
          await calendar.events.patch({
            calendarId: config.google.calendarId,
            eventId: event.id,
            requestBody: {
              start: { dateTime: event.startTime, timeZone: config.shopTimezone },
              end: { dateTime: event.endTime, timeZone: config.shopTimezone },
            },
          });
        }
      } catch (err) {
        console.warn('Google Calendar reschedule patch error:', err);
      }
    }

    this.saveToStorage();
    return event;
  }

  public async clearAll(): Promise<void> {
    this.events = [];
    this.saveToStorage();
  }

  /**
   * Seeds the calendar with sample appointments, specifically blocking
   * Thursday 3:30 PM to recreate the conflict conversation required by the test.
   */
  public async seedInitialEvents(): Promise<void> {
    const nextThursday = this.resolveNextDateForWeekday('thursday');

    // Create 3:30 PM on that Thursday
    const slot330 = new Date(nextThursday);
    slot330.setHours(15, 30, 0, 0); // 3:30 PM

    const slot330End = new Date(slot330.getTime() + 60 * 60 * 1000); // 4:30 PM

    // Create existing appointments taking both bays at 3:30 PM
    const seededEvents: CalendarEvent[] = [
      {
        id: `seed-bay1-${slot330.getTime()}`,
        summary: '[Cedar Lane] Full Signature Detail - Alex Rivera',
        description: 'Customer: Alex Rivera\nPhone: (415) 555-8821\nService: Full Signature Detail\nVehicle: Tesla Model Y\nNotes: Bay 1 Occupied',
        startTime: slot330.toISOString(),
        endTime: slot330End.toISOString(),
        customerName: 'Alex Rivera',
        customerPhone: '(415) 555-8821',
        serviceId: 'signature-detail',
        serviceName: 'Full Signature Detail',
        vehicleType: 'Tesla Model Y',
        status: 'confirmed',
      },
      {
        id: `seed-bay2-${slot330.getTime()}`,
        summary: '[Cedar Lane] Exterior Polish & Seal - David Miller',
        description: 'Customer: David Miller\nPhone: (415) 555-4390\nService: Exterior Polish & Seal\nVehicle: BMW M3\nNotes: Bay 2 Occupied',
        startTime: slot330.toISOString(),
        endTime: slot330End.toISOString(),
        customerName: 'David Miller',
        customerPhone: '(415) 555-4390',
        serviceId: 'exterior-polish',
        serviceName: 'Exterior Polish & Seal',
        vehicleType: 'BMW M3',
        status: 'confirmed',
      },
    ];

    // Reset and seed
    this.events = [...seededEvents];
    this.saveToStorage();
  }
}

export const calendarService = new CalendarService();

