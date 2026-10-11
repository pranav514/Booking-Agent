import fs from 'fs';
import path from 'path';
import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { chatRoutes } from './routes/chatRoutes.js';
import { inspectRoutes } from './routes/inspectRoutes.js';
import { vapiRoutes } from './routes/vapiRoutes.js';
import { calendarService } from './services/calendarService.js';

const app = fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
  },
});

async function startServer() {
  try {
    // Register Cross-Origin Resource Sharing for dev client
    await app.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    // Health check endpoint
    app.get('/health', async () => ({
      status: 'ok',
      shop: config.shopName,
      googleConfigured: config.google.isConfigured,
      openaiConfigured: Boolean(config.openaiApiKey),
    }));

    // Register API routes
    await app.register(chatRoutes);
    await app.register(inspectRoutes);
    await app.register(vapiRoutes);

    // Serve built frontend assets if dist folder exists
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      await app.register(fastifyStatic, {
        root: distPath,
        prefix: '/',
      });

      app.setNotFoundHandler(async (request, reply) => {
        if (!request.raw.url?.startsWith('/api/')) {
          return reply.sendFile('index.html');
        }
        return reply.status(404).send({ error: 'Endpoint not found' });
      });
    }

    const address = await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Cedar Lane Detailing Agent server running at: ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer();
