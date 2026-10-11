import { FastifyPluginAsync } from 'fastify';
import { conversationEngine, ChatMessage } from '../agent/conversationEngine.js';

interface ChatRequestBody {
  message: string;
  history?: ChatMessage[];
  channel?: 'Text Chat' | 'Voice (Vapi)';
}

export const chatRoutes: FastPlugin = async (fastify) => {
  fastify.post<{ Body: ChatRequestBody }>('/api/chat', async (request, reply) => {
    const { message, history = [], channel = 'Text Chat' } = request.body;

    if (!message || typeof message !== 'string') {
      return reply.status(400).send({ error: 'Valid "message" string is required' });
    }

    try {
      const result = await conversationEngine.processChat(history, message, channel);
      return reply.send(result);
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message || 'Internal server error' });
    }
  });
};

type FastPlugin = FastifyPluginAsync;

