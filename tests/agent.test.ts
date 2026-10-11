import { describe, it, expect, beforeEach } from 'vitest';
import { conversationEngine, ChatMessage } from '../src/server/agent/conversationEngine.js';
import { calendarService } from '../src/server/services/calendarService.js';
import { sheetsService } from '../src/server/services/sheetsService.js';
import { parsePhoneNumber } from '../src/server/domain/phoneParser.js';

describe('AI Receptionist Agent — Conversation & Decision Matrix', () => {
  beforeEach(async () => {
    await calendarService.clearAll();
    await calendarService.seedInitialEvents();
    await sheetsService.clearAll();
  });

  it('handles the exact take-home dialogue flow with 100% correctness', async () => {
    let history: ChatMessage[] = [];

    // Step 1: Caller asks for Thursday 3:30 PM
    const turn1 = await conversationEngine.processChat(
      history,
      'Is the 3:30 interior detail and wash appointment on Thursday open?',
      'Text Chat'
    );
    expect(turn1.response).toBe("That one's full. The 4:30 appointment is open, want that instead?");
    expect(turn1.toolsExecuted).toContain('check_availability');
    history = turn1.updatedHistory;

    // Step 2: Caller agrees to 4:30 PM
    const turn2 = await conversationEngine.processChat(history, 'Sure, 4:30 works.', 'Text Chat');
    expect(turn2.response).toBe('Got it. Can I get your name and a number to reach you on?');
    history = turn2.updatedHistory;

    // Step 3: Caller provides name and phone
    const turn3 = await conversationEngine.processChat(history, 'Sara, 415-555-0190.', 'Text Chat');
    expect(turn3.response).toBe('Booked you in. Anything else?');
    expect(turn3.toolsExecuted).toContain('book_appointment');

    // Verify calendar event was created for Sara at 4:30 PM
    const events = await calendarService.listEvents(
      new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()
    );
    const saraEvent = events.find((e) => e.customerName.includes('Sara'));
    expect(saraEvent).toBeDefined();
    expect(saraEvent?.customerPhone).toBe('(415) 555-0190');

    // Verify Google Sheets Contacts row was appended
    const sheetsRows = await sheetsService.listCallLogs();
    expect(sheetsRows.length).toBeGreaterThan(0);
    const saraRow = sheetsRows.find((r) => r.customerName.includes('Sara'));
    expect(saraRow).toBeDefined();
    expect(saraRow?.status).toBe('Booked');
    expect(saraRow?.escalationRequired).toBe(false);
  });

  it('correctly handles spoken phone numbers (Voice Phase 2 readiness)', () => {
    const rawSpoken = 'Sara, four one five five five five oh one ninety';
    const parsed = parsePhoneNumber(rawSpoken);
    expect(parsed).toBe('(415) 555-0190');
  });

  it('escalates billing disputes to human with urgent ticket in Sheets', async () => {
    const res = await conversationEngine.processChat(
      [],
      'I want to complain about a charge. I was billed $220 instead of $160 yesterday!',
      'Text Chat'
    );

    expect(res.response).toContain('escalated this directly to our shop owner');
    expect(res.toolsExecuted).toContain('escalate_to_human');

    const logs = await sheetsService.listCallLogs();
    const disputeLog = logs.find((l) => l.intent === 'Billing Dispute');
    expect(disputeLog).toBeDefined();
    expect(disputeLog?.escalationRequired).toBe(true);
    expect(disputeLog?.status).toBe('Escalated to Human');
  });

  it('answers prep requirements accurately without escalation', async () => {
    const res = await conversationEngine.processChat(
      [],
      'What are the prep requirements before I drop off my car?',
      'Text Chat'
    );

    expect(res.response).toContain('remove all personal belongings');
    expect(res.response).toContain('child car seats');

    const logs = await sheetsService.listCallLogs();
    expect(logs[0]?.intent).toBe('Prep Requirements');
    expect(logs[0]?.escalationRequired).toBe(false);
  });

  it('handles late arrival within grace period vs exceeding grace period', async () => {
    // Within 15-min grace period
    const res1 = await conversationEngine.processChat(
      [],
      "Hi, I'm running 10 minutes late due to traffic.",
      'Text Chat'
    );
    expect(res1.response).toContain('15-minute grace period');
    expect(res1.response).toContain('completely fine');

    // Exceeding 15-min grace period
    const res2 = await conversationEngine.processChat(
      [],
      'Hey, I am running about 30 minutes late.',
      'Text Chat'
    );
    expect(res2.response).toContain('30 minutes late');
    expect(res2.response).toContain('adjust the package');
  });

  it('escalates unsupported commercial vehicles to shop owner', async () => {
    const res = await conversationEngine.processChat(
      [],
      'Do you guys detail a 40 foot RV?',
      'Text Chat'
    );

    expect(res.response).toContain('custom quote and manual inspection');
    expect(res.toolsExecuted).toContain('escalate_to_human');
  });
});

