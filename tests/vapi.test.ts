import { describe, it, expect, beforeEach } from "vitest";
import fastify from "fastify";
import { vapiRoutes } from "../src/server/routes/vapiRoutes.js";
import { calendarService } from "../src/server/services/calendarService.js";
import { sheetsService } from "../src/server/services/sheetsService.js";

describe("Vapi Voice Webhook Route (/api/vapi/webhook)", () => {
  let app: any;

  beforeEach(async () => {
    app = fastify();
    await app.register(vapiRoutes);
    await calendarService.clearAll();
    await calendarService.seedInitialEvents();
    await sheetsService.clearAll();
  });

  it("handles Vapi tool-calls for check_availability with Thursday 3:30 conflict", async () => {
    const payload = {
      message: {
        type: "tool-calls",
        toolCalls: [
          {
            id: "call_check_330",
            type: "function",
            function: {
              name: "check_availability",
              arguments: JSON.stringify({
                date: "Thursday",
                time: "3:30 PM",
                serviceName: "Interior Detail and Wash",
              }),
            },
          },
        ],
      },
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/vapi/webhook",
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.results).toBeDefined();
    expect(body.results.length).toBe(1);

    const resultData = JSON.parse(body.results[0].result);
    expect(resultData.available).toBe(false);
    expect(resultData.suggestedSlot).toBeDefined();
    expect(resultData.suggestedSlot.formattedTime).toBe("4:30 PM");
  });

  it("handles Vapi tool-calls for book_appointment and updates Calendar & Sheets", async () => {
    const payload = {
      message: {
        type: "tool-calls",
        toolCalls: [
          {
            id: "call_book_sara",
            type: "function",
            function: {
              name: "book_appointment",
              arguments: JSON.stringify({
                customerName: "Sara",
                customerPhone: "415-555-0190",
                date: "Thursday",
                time: "4:30 PM",
                serviceName: "Interior Detail and Wash",
                vehicleType: "Sedan",
              }),
            },
          },
        ],
      },
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/vapi/webhook",
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const resultData = JSON.parse(body.results[0].result);

    expect(resultData.success).toBe(true);
    expect(resultData.customerName).toBe("Sara");

    // Verify logged into Google Sheets
    const logs = await sheetsService.listCallLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].channel).toBe("Voice (Vapi)");
    expect(logs[0].status).toBe("Booked");
  });

  it("handles Vapi end-of-call-report and logs transcript to Sheets", async () => {
    const payload = {
      message: {
        type: "end-of-call-report",
        call: {
          id: "vapi-call-test-999",
          customer: {
            number: "+14155550190",
            name: "Sara",
          },
          duration: 48,
          recordingUrl:
            "https://vapi-recordings.s3.amazonaws.com/test-call.wav",
          transcript:
            "Caller: Can I book 3:30? Agent: That is full, 4:30 is open. Caller: 4:30 works. Agent: Booked!",
        },
      },
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/vapi/webhook",
      payload,
    });

    expect(res.statusCode).toBe(200);

    const logs = await sheetsService.listCallLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].channel).toBe("Voice (Vapi)");
    expect(logs[0].notes).toContain(
      "https://vapi-recordings.s3.amazonaws.com/test-call.wav",
    );
  });
});
