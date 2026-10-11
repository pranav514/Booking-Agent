import { calendarService } from '../services/calendarService.js';
import { sheetsService } from '../services/sheetsService.js';
import { matchServiceByName, SHOP_SERVICES } from '../domain/shopConfig.js';
import { parsePhoneNumber } from '../domain/phoneParser.js';

export const AGENT_TOOLS_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'check_availability',
      description: 'Check if a requested date and time slot is available for detailing, and retrieve suggested alternatives if full.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date of appointment, e.g. "Thursday", "tomorrow", or "YYYY-MM-DD"',
          },
          time: {
            type: 'string',
            description: 'Preferred time of day, e.g. "3:30 PM" or "15:30"',
          },
          serviceName: {
            type: 'string',
            description: 'Service package requested, e.g. "Interior Detail and Wash", "Express Wash"',
          },
        },
        required: ['date', 'time'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'book_appointment',
      description: 'Book and confirm an appointment on the shop calendar and record the customer in Google Sheets.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string', description: 'Caller or customer full name' },
          customerPhone: { type: 'string', description: 'Phone number to contact customer' },
          date: { type: 'string', description: 'Confirmed date, e.g. "Thursday" or "YYYY-MM-DD"' },
          time: { type: 'string', description: 'Confirmed time, e.g. "4:30 PM" or "16:30"' },
          serviceName: { type: 'string', description: 'Service package name' },
          vehicleType: { type: 'string', description: 'Vehicle make/model or type (Sedan, SUV, etc.)' },
          notes: { type: 'string', description: 'Any extra notes or requests' },
        },
        required: ['customerName', 'customerPhone', 'date', 'time'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'reschedule_appointment',
      description: 'Change an existing appointment date and time for a customer.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string', description: 'Customer name' },
          customerPhone: { type: 'string', description: 'Customer phone number' },
          newDate: { type: 'string', description: 'New desired date' },
          newTime: { type: 'string', description: 'New desired time' },
        },
        required: ['customerPhone', 'newDate', 'newTime'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'report_running_late',
      description: 'Record that a customer with an appointment is running late.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string', description: 'Customer name' },
          customerPhone: { type: 'string', description: 'Customer phone' },
          minutesLate: { type: 'number', description: 'Estimated minutes late (e.g. 10, 20)' },
        },
        required: ['customerName', 'minutesLate'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'escalate_to_human',
      description: 'Escalate an issue (billing dispute, charge complaint, unsupported vehicle) to the shop manager for urgent callback.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string', description: 'Caller name' },
          customerPhone: { type: 'string', description: 'Caller phone number' },
          reason: {
            type: 'string',
            enum: ['billing_dispute', 'unsupported_vehicle', 'complaint', 'custom_quote'],
            description: 'Reason for escalation',
          },
          details: { type: 'string', description: 'Specific details about the complaint or request' },
        },
        required: ['customerName', 'customerPhone', 'reason', 'details'],
      },
    },
  },
];

/**
 * Helper to parse human date/time string into a JS Date object
 */
export function parseDateTimeString(dateStr: string, timeStr: string): Date {
  const now = new Date();
  let targetDate = new Date();

  const dLower = dateStr.toLowerCase();
  if (['today'].includes(dLower)) {
    targetDate = new Date();
  } else if (['tomorrow'].includes(dLower)) {
    targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(dLower)) {
    targetDate = calendarService.resolveNextDateForWeekday(dLower);
  } else if (!isNaN(Date.parse(dateStr))) {
    targetDate = new Date(dateStr);
  }

  // Parse time e.g. "3:30 PM", "4:30", "15:30"
  let hours = 9;
  let minutes = 0;

  const tMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (tMatch) {
    hours = parseInt(tMatch[1], 10);
    minutes = tMatch[2] ? parseInt(tMatch[2], 10) : 0;
    const modifier = tMatch[3]?.toLowerCase();

    if (modifier === 'pm' && hours < 12) {
      hours += 12;
    } else if (modifier === 'am' && hours === 12) {
      hours = 0;
    } else if (!modifier && hours < 7) {
      // If someone says "3:30" without am/pm, shop is open in afternoon, assume PM
      hours += 12;
    }
  }

  targetDate.setHours(hours, minutes, 0, 0);
  return targetDate;
}

export async function executeTool(name: string, args: Record<string, any>, channel: 'Text Chat' | 'Voice (Vapi)' = 'Text Chat'): Promise<any> {
  switch (name) {
    case 'check_availability': {
      const { date, time, serviceName } = args;
      const matched = matchServiceByName(serviceName || '') || SHOP_SERVICES['interior-wash'];
      const targetDate = parseDateTimeString(date, time);

      const availability = await calendarService.checkSlotAvailability(
        targetDate.toISOString(),
        matched.durationMinutes
      );

      return {
        requestedDate: date,
        requestedTime: time,
        service: matched.name,
        available: availability.available,
        reason: availability.reason,
        suggestedSlot: availability.suggestedSlot,
      };
    }

    case 'book_appointment': {
      const { customerName, customerPhone, date, time, serviceName, vehicleType, notes } = args;
      const matched = matchServiceByName(serviceName || '') || SHOP_SERVICES['interior-wash'];
      const targetDate = parseDateTimeString(date, time);
      const cleanPhone = parsePhoneNumber(customerPhone);

      const booking = await calendarService.createBooking({
        customerName,
        customerPhone: cleanPhone,
        serviceId: matched.id,
        vehicleType,
        startTime: targetDate.toISOString(),
        notes,
      });

      // Log in Google Sheets Contacts tab
      await sheetsService.logCall({
        timestamp: new Date().toISOString(),
        customerName,
        customerPhone: cleanPhone,
        channel,
        intent: 'Booking',
        serviceOrTopic: matched.name,
        scheduledTime: targetDate.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
        status: 'Booked',
        escalationRequired: false,
        notes: `Booked ${matched.name}. Vehicle: ${vehicleType || 'Sedan'}. Notes: ${notes || 'None'}`,
      });

      return {
        success: true,
        bookingId: booking.id,
        customerName,
        service: matched.name,
        startTime: targetDate.toLocaleString('en-US', {
          weekday: 'long',
          hour: 'numeric',
          minute: '2-digit',
        }),
      };
    }

    case 'reschedule_appointment': {
      const { customerName, customerPhone, newDate, newTime } = args;
      const cleanPhone = parsePhoneNumber(customerPhone);
      const existing = await calendarService.findBookingByCustomer(cleanPhone, customerName);

      if (!existing) {
        return {
          success: false,
          error: `Could not find an existing booking under phone number ${customerPhone} or name ${customerName}.`,
        };
      }

      const targetDate = parseDateTimeString(newDate, newTime);
      const updated = await calendarService.rescheduleBooking(existing.id, targetDate.toISOString());

      await sheetsService.logCall({
        timestamp: new Date().toISOString(),
        customerName: customerName || existing.customerName,
        customerPhone: cleanPhone || existing.customerPhone,
        channel,
        intent: 'Reschedule',
        serviceOrTopic: existing.serviceName || 'Detailing',
        scheduledTime: targetDate.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
        status: 'Rescheduled',
        escalationRequired: false,
        notes: `Rescheduled booking from ${existing.startTime} to ${targetDate.toISOString()}`,
      });

      return {
        success: true,
        customerName: existing.customerName,
        newTime: targetDate.toLocaleString('en-US', {
          weekday: 'long',
          hour: 'numeric',
          minute: '2-digit',
        }),
      };
    }

    case 'report_running_late': {
      const { customerName, customerPhone, minutesLate } = args;
      const cleanPhone = parsePhoneNumber(customerPhone || '');

      await sheetsService.logCall({
        timestamp: new Date().toISOString(),
        customerName: customerName || 'Caller',
        customerPhone: cleanPhone || 'Not provided',
        channel,
        intent: 'Running Late',
        serviceOrTopic: 'Late Arrival Notification',
        status: 'Late Noted',
        escalationRequired: minutesLate > 15,
        notes: `Caller reported running ${minutesLate} minutes late. Grace period is 15 minutes.`,
      });

      return {
        acknowledged: true,
        minutesLate,
        withinGracePeriod: minutesLate <= 15,
        message:
          minutesLate <= 15
            ? 'Noted! That is within our 15-minute grace period, we will see you shortly.'
            : 'Noted. Since you are more than 15 minutes late, we may need to adjust the package or reschedule if our schedule is tight.',
      };
    }

    case 'escalate_to_human': {
      const { customerName, customerPhone, reason, details } = args;
      const cleanPhone = parsePhoneNumber(customerPhone);

      await sheetsService.logCall({
        timestamp: new Date().toISOString(),
        customerName,
        customerPhone: cleanPhone,
        channel,
        intent: reason === 'billing_dispute' ? 'Billing Dispute' : 'General Inquiry',
        serviceOrTopic: `Escalation: ${reason}`,
        status: 'Escalated to Human',
        escalationRequired: true,
        notes: `[HUMAN ESCALATION] Reason: ${reason}. Details: ${details}. Follow-up priority: High (callback within 2 hours).`,
      });

      return {
        escalated: true,
        reason,
        message: 'The issue has been flagged for immediate owner/manager review. Callback promised within 2 hours.',
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

