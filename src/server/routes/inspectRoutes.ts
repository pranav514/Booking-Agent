import { FastifyPluginAsync } from 'fastify';
import { calendarService } from '../services/calendarService.js';
import { sheetsService } from '../services/sheetsService.js';
import { config } from '../config.js';

export const inspectRoutes: FastifyPluginAsync = async (fastify) => {
  // Calendar Events Inspector
  fastify.get('/api/calendar/events', async (request, reply) => {
    try {
      const now = new Date();
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const events = await calendarService.listEvents(past.toISOString(), future.toISOString());
      return reply.send({ events });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Google Sheets Rows Inspector
  fastify.get('/api/sheets/rows', async (request, reply) => {
    try {
      const rows = await sheetsService.listCallLogs(100);
      return reply.send({ rows });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Seed / Reset Calendar Data
  fastify.post('/api/seed', async (request, reply) => {
    try {
      await calendarService.seedInitialEvents();
      const events = await calendarService.listEvents(
        new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()
      );
      return reply.send({
        success: true,
        message: 'Successfully seeded calendar with Thursday 3:30 PM conflict appointments.',
        events,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Vapi Public Config for In-Browser Web Voice Calling
  fastify.get('/api/vapi/config', async () => ({
    publicKey: config.vapi.publicKey || '',
    assistantId: config.vapi.assistantId || '',
    serverUrl: config.vapi.serverUrl || '',
    isConfigured: Boolean(config.vapi.publicKey && config.vapi.assistantId),
  }));
};

