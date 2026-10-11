export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  startTime: string; // ISO-8601
  endTime: string;   // ISO-8601
  customerName: string;
  customerPhone: string;
  serviceId?: string;
  serviceName?: string;
  vehicleType?: string;
  status: 'confirmed' | 'cancelled' | 'rescheduled';
}

export interface SlotAvailability {
  available: boolean;
  requestedSlot: {
    start: string;
    end: string;
  };
  conflictCount: number;
  reason?: string;
  suggestedSlot?: {
    start: string;
    end: string;
    formattedTime: string;
  };
}

export interface BookingRequest {
  customerName: string;
  customerPhone: string;
  serviceId: string;
  vehicleType?: string;
  startTime: string; // ISO-8601
  notes?: string;
}

export interface CallLogRecord {
  id?: string;
  timestamp: string;
  customerName: string;
  customerPhone: string;
  channel: 'Text Chat' | 'Voice (Vapi)';
  intent: 'Booking' | 'Reschedule' | 'Pricing/Hours' | 'Prep Requirements' | 'Vehicle Eligibility' | 'Running Late' | 'Billing Dispute' | 'General Inquiry';
  serviceOrTopic: string;
  scheduledTime?: string;
  status: 'Booked' | 'Rescheduled' | 'Answered' | 'Late Noted' | 'Escalated to Human' | 'Declined';
  escalationRequired: boolean;
  notes: string;
}

export interface ICalendarService {
  listEvents(startRangeIso: string, endRangeIso: string): Promise<CalendarEvent[]>;
  checkSlotAvailability(startTimeIso: string, durationMinutes: number): Promise<SlotAvailability>;
  createBooking(booking: BookingRequest): Promise<CalendarEvent>;
  findBookingByCustomer(customerPhone: string, customerName?: string): Promise<CalendarEvent | undefined>;
  rescheduleBooking(bookingId: string, newStartTimeIso: string, durationMinutes?: number): Promise<CalendarEvent>;
  seedInitialEvents(): Promise<void>;
}

export interface ISheetsService {
  logCall(record: CallLogRecord): Promise<void>;
  listCallLogs(limit?: number): Promise<CallLogRecord[]>;
  findCustomerHistory(customerPhone: string): Promise<CallLogRecord[]>;
}

