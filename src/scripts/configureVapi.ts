/**
 * Helper script to programmatically create or update the Vapi Assistant
 * with tuned low-latency voice parameters (< 1.2s SLA) and server tools.
 *
 * Usage:
 *   npx tsx src/scripts/configureVapi.ts
 */

import { config } from "../server/config.js";
import { getSystemPrompt } from "../server/agent/prompts.js";
import { AGENT_TOOLS_DEFINITIONS } from "../server/agent/tools.js";

async function configureVapiAssistant() {
  const apiKey = config.vapi.apiKey;
  if (!apiKey) {
    console.error(
      "Error: VAPI_API_KEY is not set in environment or .env file.",
    );
    console.log(
      "To configure your Vapi voice assistant, add VAPI_API_KEY=your_key to .env.",
    );
    process.exit(1);
  }

  const rawServerUrl =
    config.vapi.serverUrl ||
    process.env.VAPI_SERVER_URL ||
    process.env.PUBLIC_SERVER_URL ||
    "https://your-domain.ngrok-free.app";

  const webhookUrl = rawServerUrl.endsWith("/api/vapi/webhook")
    ? rawServerUrl
    : `${rawServerUrl.replace(/\/$/, "")}/api/vapi/webhook`;

  console.log(`Configuring Vapi Assistant targeting server webhook: ${webhookUrl}`);

  // Build Vapi Assistant payload with low-latency knobs tuned
  const assistantPayload = {
    name: "Cedar Lane Auto Detailing Receptionist",
    firstMessage: "Cedar Lane Auto Detailing, how can I help you today?",
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
      endpointing: 255, // Low endpointing for snappy turn taking (<300ms)
      smartFormat: true,
      keywords: ["CedarLane:2", "detailing:2", "polish:2", "ceramic:2", "Sara:2"],
    },
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.1,
      maxTokens: 100, // Short spoken replies
      messages: [
        {
          role: "system",
          content: getSystemPrompt("voice"),
        },
      ],
      tools: AGENT_TOOLS_DEFINITIONS,
    },
    voice: {
      provider: "cartesia",
      voiceId: "a0e99841-438c-4a64-b679-ae501e7d6091", // Natural conversational female tone
    },
    serverUrl: webhookUrl,
    serverMessages: ["tool-calls", "end-of-call-report", "status-update", "hang", "user-interrupted"],
    silenceTimeoutSeconds: 30,
    backchannelingEnabled: false,
  };

  try {
    const existingAssistantId = config.vapi.assistantId;
    let url = "https://api.vapi.ai/assistant";
    let method = "POST";

    if (existingAssistantId) {
      url = `https://api.vapi.ai/assistant/${existingAssistantId}`;
      method = "PATCH";
      console.log(`Updating existing assistant: ${existingAssistantId}`);
    } else {
      console.log("Creating new Vapi Assistant...");
    }

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(assistantPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Vapi API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log("\nSuccess! Vapi Assistant successfully configured:");
    console.log(`Assistant ID: ${data.id}`);
    console.log(`Server Webhook: ${assistantPayload.serverUrl}`);
    console.log("\nAdd this to your .env file:");
    console.log(`VAPI_ASSISTANT_ID=${data.id}`);
  } catch (err: any) {
    console.error("Failed to configure Vapi assistant:", err.message);
  }
}

configureVapiAssistant();
