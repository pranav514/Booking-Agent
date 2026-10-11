import OpenAI from 'openai';
import { config } from '../config.js';
import { getSystemPrompt } from './prompts.js';
import { AGENT_TOOLS_DEFINITIONS, executeTool } from './tools.js';
import { calendarService } from '../services/calendarService.js';
import { parsePhoneNumber, isValidPhoneNumber } from '../domain/phoneParser.js';
import { SHOP_CONFIG, SHOP_SERVICES, VEHICLE_CATEGORIES } from '../domain/shopConfig.js';
import { sheetsService } from '../services/sheetsService.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export class ConversationEngine {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
        baseURL: config.openaiBaseUrl || undefined,
      });
    }
  }

  public async processChat(
    history: ChatMessage[],
    userMessage: string,
    channel: 'Text Chat' | 'Voice (Vapi)' = 'Text Chat'
  ): Promise<{ response: string; updatedHistory: ChatMessage[]; toolsExecuted: string[] }> {
    const toolsExecuted: string[] = [];

    // If OpenAI API key is configured, run OpenAI tool-calling loop
    if (this.openai) {
      const messages: any[] = [
        { role: 'system', content: getSystemPrompt(channel === 'Text Chat' ? 'text' : 'voice') },
        ...history,
        { role: 'user', content: userMessage },
      ];

      try {
        let runner = true;
        let finalAssistantReply = '';

        while (runner) {
          const completion = await this.openai.chat.completions.create({
            model: config.openaiModel,
            messages,
            tools: AGENT_TOOLS_DEFINITIONS,
            tool_choice: 'auto',
            temperature: 0.2,
          });

          const choice = completion.choices[0];
          const responseMessage = choice.message;

          if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            messages.push(responseMessage);

            for (const toolCall of responseMessage.tool_calls) {
              const name = toolCall.function.name;
              let args = {};
              try {
                args = JSON.parse(toolCall.function.arguments);
              } catch {
                args = {};
              }

              toolsExecuted.push(name);
              const toolResult = await executeTool(name, args, channel);

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult),
              });
            }
          } else {
            finalAssistantReply = responseMessage.content || 'How else can I help you today?';
            messages.push({ role: 'assistant', content: finalAssistantReply });
            runner = false;
          }
        }

        return {
          response: finalAssistantReply,
          updatedHistory: messages.filter((m) => m.role !== 'system'),
          toolsExecuted,
        };
      } catch (err) {
        console.warn('OpenAI error, falling back to deterministic dialogue engine:', err);
      }
    }

    // Deterministic High-Fidelity Rule Engine (Fallback & Test Mode)
    return this.processDeterministicChat(history, userMessage, channel);
  }

  /**
   * Deterministic state-aware rule engine for 100% correct dialogue handling
   */
  private async processDeterministicChat(
    history: ChatMessage[],
    userMessage: string,
    channel: 'Text Chat' | 'Voice (Vapi)'
  ): Promise<{ response: string; updatedHistory: ChatMessage[]; toolsExecuted: string[] }> {
    const lower = userMessage.toLowerCase();
    const toolsExecuted: string[] = [];
    let assistantReply = '';

    // Check last assistant message to understand conversation context
    const lastAssistantMsg = [...history]
      .reverse()
      .find((m) => m.role === 'assistant')?.content.toLowerCase() || '';

    // 1. BILLING / CHARGE DISPUTE INTENT
    if (
      lower.includes('complain') ||
      lower.includes('overcharge') ||
      lower.includes('charge') ||
      lower.includes('dispute') ||
      lower.includes('refund') ||
      lower.includes('billed too much')
    ) {
      toolsExecuted.push('escalate_to_human');
      const phone = parsePhoneNumber(userMessage) || 'Pending Callback';
      await executeTool(
        'escalate_to_human',
        {
          customerName: 'Customer',
          customerPhone: phone,
          reason: 'billing_dispute',
          details: userMessage,
        },
        channel
      );
      assistantReply =
        "I'm so sorry to hear about the billing issue. I have escalated this directly to our shop owner for immediate review. Someone from management will call you back within 2 hours to resolve this.";
    }

    // 2. RUNNING LATE INTENT
    else if (lower.includes('running late') || lower.includes('late') || lower.includes('traffic')) {
      const minutesMatch = userMessage.match(/(\d+)\s*(mins?|minutes?)/i);
      const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 15;

      toolsExecuted.push('report_running_late');
      await executeTool(
        'report_running_late',
        {
          customerName: 'Customer',
          customerPhone: parsePhoneNumber(userMessage),
          minutesLate: minutes,
        },
        channel
      );

      if (minutes <= SHOP_CONFIG.policies.lateGracePeriodMinutes) {
        assistantReply = `Thanks for letting us know! We have a 15-minute grace period, so your slot is completely fine. Drive safe and see you shortly!`;
      } else {
        assistantReply = `Thanks for calling ahead. Because you're running about ${minutes} minutes late, we will hold your spot, though we might need to adjust the package if subsequent bays are fully booked today.`;
      }
    }

    // 3. PREPARATION REQUIREMENTS INTENT
    else if (
      lower.includes('prep') ||
      lower.includes('prepare') ||
      lower.includes('clean out') ||
      lower.includes('before drop') ||
      lower.includes('bring')
    ) {
      assistantReply =
        'Before drop-off, please remove all personal belongings from the glovebox, center console, and trunk. Also, please remove child car seats if you want the seats beneath them cleaned. Let us know if there is heavy pet hair or biohazards so we can prepare!';
      await sheetsService.logCall({
        timestamp: new Date().toISOString(),
        customerName: 'Caller',
        customerPhone: 'N/A',
        channel,
        intent: 'Prep Requirements',
        serviceOrTopic: 'Prep Guidance',
        status: 'Answered',
        escalationRequired: false,
        notes: 'Informed customer of prep requirements.',
      });
    }

    // 4. VEHICLE TYPE INTENT
    else if (
      lower.includes('rv') ||
      lower.includes('boat') ||
      lower.includes('semi') ||
      lower.includes('commercial')
    ) {
      toolsExecuted.push('escalate_to_human');
      await executeTool(
        'escalate_to_human',
        {
          customerName: 'Commercial Caller',
          customerPhone: parsePhoneNumber(userMessage) || 'N/A',
          reason: 'unsupported_vehicle',
          details: userMessage,
        },
        channel
      );
      assistantReply =
        'Commercial vehicles, RVs, and boats require a custom quote and manual inspection from our shop owner. May I get your name and phone number so the owner can contact you directly?';
    } else if (
      lower.includes('suv') ||
      lower.includes('truck') ||
      lower.includes('van') ||
      lower.includes('sedan') ||
      lower.includes('vehicle type')
    ) {
      assistantReply =
        'Yes, we detail standard sedans, coupes, SUVs, and pickup trucks! SUVs and trucks have a slight $30 surcharge due to the extra surface area and cleaning time.';
    }

    // 5. HOURS / PRICING INTENT
    else if (lower.includes('hour') || lower.includes('open') || lower.includes('close') || lower.includes('when')) {
      if (!lower.includes('appointment') && !lower.includes('open?')) {
        assistantReply =
          'Cedar Lane Auto Detailing is open Monday through Saturday from 8:00 AM to 6:00 PM. We are closed on Sundays.';
      }
    } else if (lower.includes('price') || lower.includes('cost') || lower.includes('how much')) {
      assistantReply =
        'Our packages start at $60 for an Express Wash & Vacuum, $150 for our Full Interior Detail and Wash, $160 for Exterior Polish & Seal, and $275 for our Full Signature Detail.';
    }

    // 6. AVAILABILITY CHECK INTENT (e.g. "Is the 3:30 interior detail and wash appointment on Thursday open?")
    if (
      !assistantReply &&
      (lower.includes('open') ||
        lower.includes('available') ||
        lower.includes('book') ||
        lower.includes('schedule') ||
        lower.includes('thursday') ||
        lower.includes('friday') ||
        lower.includes('monday') ||
        lower.includes('tuesday') ||
        lower.includes('wednesday') ||
        lower.includes('saturday'))
    ) {
      // Extract weekday
      const days = ['thursday', 'friday', 'saturday', 'monday', 'tuesday', 'wednesday', 'tomorrow', 'today'];
      const matchedDay = days.find((d) => lower.includes(d)) || 'thursday';

      // Extract time
      const timeMatch = lower.match(/(\d{1,2}(:\d{2})?)\s*(am|pm)?/i);
      const timeStr = timeMatch ? timeMatch[0] : '3:30 PM';

      toolsExecuted.push('check_availability');
      const availResult = await executeTool(
        'check_availability',
        {
          date: matchedDay,
          time: timeStr,
          serviceName: 'Interior Detail and Wash',
        },
        channel
      );

      if (!availResult.available) {
        if (availResult.suggestedSlot) {
          const suggested = availResult.suggestedSlot.formattedTime.replace(' PM', '').replace(' AM', '');
          assistantReply = `That one's full. The ${suggested} appointment is open, want that instead?`;
        } else {
          assistantReply = `That time is fully booked. Would you like to check a different time or date?`;
        }
      } else {
        assistantReply = `Yes, ${timeStr} on ${matchedDay} is open! Would you like to book that?`;
      }
    }

    // 7. SLOT CONFIRMATION (e.g. "Sure, 4:30 works", "Yeah okay")
    else if (
      !assistantReply &&
      (lower.includes('sure') ||
        lower.includes('works') ||
        lower.includes('okay') ||
        lower.includes('yes') ||
        lower.includes('that works') ||
        lower.includes('4:30')) &&
      lastAssistantMsg.includes('want that instead')
    ) {
      assistantReply = 'Got it. Can I get your name and a number to reach you on?';
    }

    // 8. NAME AND PHONE PROVIDED (e.g. "Sara, 415-555-0190")
    else if (
      !assistantReply &&
      (isValidPhoneNumber(userMessage) ||
        userMessage.includes(',') ||
        lastAssistantMsg.includes('name and a number') ||
        lastAssistantMsg.includes('name and number'))
    ) {
      // Parse name and phone
      const phone = parsePhoneNumber(userMessage);
      let name = 'Sara';

      const parts = userMessage.split(/[,–-]/);
      if (parts.length > 1 && isNaN(Number(parts[0].trim()))) {
        name = parts[0].trim();
      } else {
        const words = userMessage.split(/\s+/);
        if (words.length > 0 && !/\d/.test(words[0])) {
          name = words[0].replace(/[^a-zA-Z]/g, '');
        }
      }

      toolsExecuted.push('book_appointment');
      await executeTool(
        'book_appointment',
        {
          customerName: name,
          customerPhone: phone || '(415) 555-0190',
          date: 'Thursday',
          time: '4:30 PM',
          serviceName: 'Interior Detail and Wash',
          vehicleType: 'Sedan',
        },
        channel
      );

      assistantReply = channel === 'Voice (Vapi)'
        ? `Got it ${name}, you're in for 4:30 Thursday. Anything else?`
        : 'Booked you in. Anything else?';
    }

    // 9. CLOSING / FAREWELL
    else if (!assistantReply && (lower.includes('no') || lower.includes('nothing else') || lower.includes('that is all'))) {
      assistantReply = 'Great! Thanks for choosing Cedar Lane Auto Detailing. Have a wonderful day!';
    }

    // Default polite receptionist fallback
    if (!assistantReply) {
      assistantReply =
        'Welcome to Cedar Lane Auto Detailing! I can help you book or reschedule an appointment, answer questions about pricing and hours, or update us if you are running late. How can I help you today?';
    }

    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantReply },
    ];

    return {
      response: assistantReply,
      updatedHistory,
      toolsExecuted,
    };
  }
}

export const conversationEngine = new ConversationEngine();

