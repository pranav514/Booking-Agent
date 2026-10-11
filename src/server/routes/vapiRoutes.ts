import { FastifyPluginAsync } from 'fastify';
import { executeTool } from '../agent/tools.js';
import { sheetsService } from '../services/sheetsService.js';
import { getSystemPrompt } from '../agent/prompts.js';
import { AGENT_TOOLS_DEFINITIONS } from '../agent/tools.js';
import { parsePhoneNumber } from '../domain/phoneParser.js';

export const vapiRoutes: FastifyPluginAsync = async (fastify) => {
  // Health / info for Vapi webhook configuration
  fastify.get('/api/vapi/webhook', async () => ({
    status: 'ready',
    service: 'Cedar Lane Detailing Vapi Voice Webhook',
    targetLatencySLA: '< 1.2s',
  }));

  // Primary Vapi Server URL Webhook handler
  fastify.post('/api/vapi/webhook', async (request, reply) => {
    const body: any = request.body || {};
    const message = body.message || body;
    const messageType = message.type || body.type;

    fastify.log.info({ messageType }, 'Received Vapi Webhook event');

    // 1. TOOL CALLS / FUNCTION CALLS (Ultra-low latency execution)
    const toolCalls =
      message.toolCallList ||
      message.toolCalls ||
      body.toolCallList ||
      body.toolCalls ||
      [];

    if ((messageType === 'tool-calls' || toolCalls.length > 0) && Array.isArray(toolCalls) && toolCalls.length > 0) {
      fastify.log.info({ toolCallsCount: toolCalls.length }, 'Processing Vapi tool-calls');
      const results = [];

      for (const call of toolCalls) {
        const toolName = call.function?.name || call.name;
        let args = call.function?.arguments || call.arguments || call.parameters || {};
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args);
          } catch {
            args = {};
          }
        }

        fastify.log.info({ toolName, args }, 'Executing tool');

        try {
          const toolResult = await executeTool(toolName, args, 'Voice (Vapi)');
          results.push({
            toolCallId: call.id || call.toolCallId,
            result: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          });
        } catch (err: any) {
          fastify.log.error({ err, toolName }, 'Error executing tool');
          results.push({
            toolCallId: call.id || call.toolCallId,
            result: JSON.stringify({ error: err.message }),
          });
        }
      }

      fastify.log.info({ results }, 'Sending tool results to Vapi');
      return reply.send({ results });
    }

    // Legacy function-call format
    if (messageType === 'function-call' && message.functionCall) {
      const { name, parameters } = message.functionCall;
      try {
        const result = await executeTool(name, parameters, 'Voice (Vapi)');
        return reply.send({ result: JSON.stringify(result) });
      } catch (err: any) {
        return reply.send({ result: JSON.stringify({ error: err.message }) });
      }
    }

    // 2. ASSISTANT REQUEST (Dynamic configuration injection on incoming call)
    if (messageType === 'assistant-request') {
      const callerNumber = message.call?.customer?.number || '';
      let callerContext = '';

      if (callerNumber) {
        const history = await sheetsService.findCustomerHistory(callerNumber);
        if (history.length > 0) {
          const last = history[0];
          callerContext = `\nRETURNING CALLER DETECTED: Caller name is ${last.customerName}. Last appointment: ${last.serviceOrTopic} (${last.scheduledTime}). Greet them warmly by name!`;
        }
      }

      const voicePrompt = getSystemPrompt('voice') + callerContext;

      return reply.send({
        assistant: {
          name: 'Cedar Lane Receptionist',
          firstMessage: 'Cedar Lane Auto Detailing, how can I help you today?',
          transcriber: {
            provider: 'deepgram',
            model: 'nova-2',
            language: 'en',
            endpointing: 255, // Low endpointing for sub-second turn-taking
            keywords: ['Cedar Lane', 'detailing', 'polish', 'ceramic'],
          },
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.1,
            maxTokens: 100, // Keep spoken responses concise
            messages: [{ role: 'system', content: voicePrompt }],
            tools: AGENT_TOOLS_DEFINITIONS,
          },
          voice: {
            provider: 'cartesia',
            voiceId: 'a0e99841-438c-4a64-b679-ae501e7d6091', // Natural conversational tone
          },
          silenceTimeoutSeconds: 0.5,
          responseDelaySeconds: 0.1,
          interruptionSensitivity: 0.7,
        },
      });
    }

    // 3. END OF CALL REPORT (Audit trail logging in Google Sheets)
    if (messageType === 'end-of-call-report') {
      const call = message.call || {};
      const customer = call.customer || {};
      const transcript = message.transcript || call.transcript || '';
      const recordingUrl = message.recordingUrl || call.recordingUrl || 'N/A';
      const durationSeconds = call.duration || 0;
      const callerPhone = parsePhoneNumber(customer.number || '') || 'Unknown';
      const callerName = customer.name || 'Caller';

      // Log full call record into Google Sheets Contacts tab
      await sheetsService.logCall({
        timestamp: new Date().toISOString(),
        customerName: callerName,
        customerPhone: callerPhone,
        channel: 'Voice (Vapi)',
        intent: 'General Inquiry',
        serviceOrTopic: `Voice Call (${durationSeconds}s)`,
        status: 'Answered',
        escalationRequired: false,
        notes: `Call ended. Duration: ${durationSeconds}s. Recording: ${recordingUrl}\nTranscript summary: ${transcript.slice(0, 300)}...`,
      });

      return reply.send({ received: true });
    }

    // Default acknowledge for other events (status-update, speech-update, etc.)
    return reply.send({ received: true });
  });
};

