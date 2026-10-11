/**
 * Seed initial test events on the calendar (Thursday 3:30 PM conflict)
 * Usage:
 *   npm run seed
 */

import { calendarService } from '../server/services/calendarService.js';

async function seed() {
  console.log('Clearing existing test events and seeding Thursday 3:30 PM conflict...');
  await calendarService.clearAll();
  await calendarService.seedInitialEvents();

  const nextThursday = calendarService.resolveNextDateForWeekday('thursday');
  const startDay = new Date(nextThursday);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(nextThursday);
  endDay.setHours(23, 59, 59, 999);

  const events = await calendarService.listEvents(startDay.toISOString(), endDay.toISOString());
  console.log(`\nSuccessfully seeded ${events.length} appointments for Thursday:`);
  for (const e of events) {
    console.log(` - ${e.startTime} to ${e.endTime}: ${e.summary}`);
  }
}

seed().catch((err) => {
  console.error('Failed to seed calendar:', err);
  process.exit(1);
});

