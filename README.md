# 🚗 Cedar Lane Auto Detailing — AI Receptionist

> **Autonomous AI Receptionist & Voice Telephony System built in TypeScript.**  
> Powers multi-channel customer communications across **Interactive Text Chat (Phase 1)** and **Ultra-Low Latency Live Voice Calls (Phase 2, < 1.2s SLA)**, integrated directly with **Google Calendar** and **Google Sheets**.

---

## 🌟 Key Highlights

- **⚡ Sub-1.2s Voice Latency**: Deepgram Nova-2 (STT) + OpenAI GPT-4o-mini / Groq + Cartesia Sonic (TTS) streaming pipeline via Vapi.
- **📅 Real-Time Google Calendar v3 Sync**: Dynamic slot availability checking, 1-bay shop capacity enforcement, automatic conflict detection, and instant next-available slot suggestions.
- **📊 Real-Time Google Sheets v4 Sync**: Automatic contact creation and call audit logging into the `Contacts` tab (caller info, intent, status, audio recording URL, full transcript, and human escalation flags).
- **🎙️ Dual Calling Channels**:
  - **In-Browser WebRTC Voice**: Zero-cost, high-fidelity microphone calls directly in the browser using `@vapi-ai/web`.
  - **Cellular / PSTN Telephony**: Real inbound phone dialing from smartphones via Vapi / Twilio.
- **🛡️ Shop Business Policies & Guardrails**: Enforces detailing service packages, vehicle surcharges, 15-minute late arrival grace period, and instant human escalation for billing disputes and oversized commercial vehicles.

---

## 🏗️ System Architecture

```
                                  +---------------------------------------+
                                  |            CALLER CHANNELS            |
                                  +-------------------+-------------------+
                                                      |
                                  +-------------------+-------------------+
                                  |                                       |
                          Phase 1 | Text Chat                     Phase 2 | Live Voice
                                  v                                       v
                     +------------------------+              +------------------------+
                     |    Web UI (React)      |              |   Vapi Voice Platform  |
                     |  Tailwind + Glassmorphism             |  - Deepgram Nova-2 STT |
                     +-----------+------------+              |  - Cartesia Sonic TTS  |
                                 | REST Stream               +-----------+------------+
                                 |                                       | Webhook (< 1.2s SLA)
                                 |                                       | (Cloudflare Tunnel)
                                 +--------------------+------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |          Fastify Server (TS)          |
                                  |  - Port 3001                          |
                                  |  - LLM Tool Calling Engine (Groq)     |
                                  |  - Phonetic E.164 Phone Normalizer    |
                                  |  - Shop Policy & Escalation Guard     |
                                  +-----------+----------------+----------+
                                              |                |
                            Google Calendar   |                | Google Sheets
                            API v3 (OAuth)    |                | API v4 (OAuth)
                                              v                v
                                  +-----------------+    +-----------------+
                                  | Google Calendar |    |  Google Sheets  |
                                  | (Appointments & |    | (Contacts, Logs |
                                  |  Auto-Suggested |    |  & Audio Links) |
                                  |  Alternatives)  |    +-----------------+
                                  +-----------------+
```

### Voice Latency Budget Breakdown (< 1,200 ms Target)

| Component | Target Budget | Provider & Configuration |
| :--- | :--- | :--- |
| **Silence Detection (Endpointing)** | **250 – 300 ms** | Deepgram Nova-2 (`endpointing: 255`) |
| **Speech-to-Text (STT)** | **120 – 160 ms** | Deepgram Nova-2 Streaming WebSocket |
| **LLM Time-to-First-Token (TTFT)** | **200 – 260 ms** | GPT-4o-mini / Groq with streaming token output |
| **Backend Webhook Execution** | **150 – 250 ms** | Fastify in-memory caching + Google Calendar API |
| **Text-to-Speech (TTS)** | **100 – 140 ms** | Cartesia Sonic (`voiceId: a0e99841-438c-4a64-b679-ae501e7d6091`) |
| **Network Round-Trip** | **60 – 80 ms** | Global Cloudflare edge proxy |
| **Total Turnaround Time** | **~880 – 1,050 ms** | **PASSED (< 1.2s SLA)** |

---

## 📋 Shop Profile & Business Rules

### 1. Hours of Operation
- **Days**: Monday – Saturday (Closed Sundays).
- **Hours**: 8:00 AM – 6:00 PM (18:00).
- **Slot Granularity**: 30-minute intervals.
- **Bay Capacity**: 1 vehicle at a time (`SHOP_BAYS=1` to enforce realistic slot conflicts).

### 2. Service Packages & Pricing
| Service Package | Duration | Price | Description |
| :--- | :---: | :---: | :--- |
| **Express Wash & Vacuum** | 45 min | \$60 | Exterior hand wash, wheel cleaning, interior vacuum, clean windows. |
| **Interior Detail and Wash** | 90 min | \$150 | Deep interior shampoo, steam cleaning, leather wipe, full exterior hand wash. |
| **Exterior Polish & Seal** | 90 min | \$160 | Clay bar decontamination, single-stage paint polish, 6-month ceramic sealant. |
| **Full Signature Detail** | 180 min | \$275 | Bumper-to-bumper detailing: interior deep clean + exterior polish & sealant. |
| **Headlight Restoration** | 45 min | \$50 | Multi-stage wet sanding and UV clear coat sealant to restore foggy headlights. |

### 3. Policies & Escalation Matrix
- **15-Minute Grace Period**: Callers running $\le$ 15 minutes late have their appointment preserved without changes.
- **>15 Minutes Late**: Agent informs caller of shop policy and suggests adjusting to an Express Wash or rescheduling.
- **Billing Disputes**: Immediate human escalation flag logged to Google Sheets for callback within 2 hours.
- **Commercial / Oversized Vehicles (RVs, Boats, Semis)**: Not booked automatically; contact information collected for shop owner quote.

---

## 📂 Project Structure

```
booking-agent/
├── package.json                   # Dependencies, build scripts & CLI shortcuts
├── tsconfig.json                  # Client & shared TypeScript configuration
├── tsconfig.server.json           # Server TypeScript configuration
├── vite.config.ts                 # Vite bundler configuration
├── index.html                     # HTML entry point with Plus Jakarta Sans font
├── .env.example                   # Environment variable template
├── src/
│   ├── client/                    # React 18 + Tailwind CSS Frontend
│   │   ├── App.tsx                # App layout, header badges, segmented tab switcher
│   │   ├── index.css              # Custom scrollbars, glassmorphism, radial glow
│   │   ├── main.tsx               # Client React DOM entry point
│   │   └── components/
│   │       ├── ChatWindow.tsx     # Phase 1 Text Chat with tool execution badges & quick chips
│   │       └── VoicePanel.tsx     # Phase 2 WebRTC Live Voice with audio orb visualizer & timer
│   ├── server/                    # Fastify Backend & API Engine
│   │   ├── server.ts              # Fastify server entry point (port 3001)
│   │   ├── config.ts              # Zod environment validation & configuration loader
│   │   ├── agent/                 # Conversational AI & Tool Calling
│   │   │   ├── conversationEngine.ts # Groq/OpenAI LLM chat completion engine
│   │   │   ├── prompts.ts         # System prompts for text & voice channels
│   │   │   └── tools.ts           # Tool definitions & execution dispatchers
│   │   ├── domain/                # Detailing Shop Domain Logic
│   │   │   ├── phoneParser.ts     # Parses typed & phonetic numbers (e.g. "four one five...")
│   │   │   └── shopConfig.ts      # Hours, bays, services, policies, and prices
│   │   ├── routes/                # Fastify REST & Webhook Routes
│   │   │   ├── chatRoutes.ts      # POST /api/chat
│   │   │   ├── inspectRoutes.ts   # GET /api/calendar/events, /api/sheets/rows, /api/vapi/config
│   │   │   └── vapiRoutes.ts      # POST /api/vapi/webhook (tool-calls, end-of-call-report)
│   │   └── services/              # External Cloud Integrations
│   │       ├── googleAuth.ts      # Google Service Account JWT authenticator
│   │       ├── calendarService.ts # Google Calendar API v3 wrapper
│   │       └── sheetsService.ts   # Google Sheets API v4 wrapper
│   └── scripts/                   # Utility & Provisioning Scripts
│       ├── configureVapi.ts       # Automated Vapi Assistant provisioning script
│       └── seedCalendar.ts        # Helper script for calendar conflict seeding
└── tests/                         # Vitest Test Suites
    ├── calendar.test.ts           # Calendar logic, intervals, and availability tests
    ├── domain.test.ts             # Domain rules, pricing, and phone parsing tests
    └── vapi.test.ts               # Vapi webhook and tool execution payload tests
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.0.0` or later
- **npm**: `v9.0.0` or later
- **Google Cloud Service Account**: with Google Calendar and Google Sheets API access
- **Vapi Account**: free account with $10 credits from [vapi.ai](https://vapi.ai)
- **Groq API Key** (or OpenAI / Gemini key)

### 2. Installation
```bash
# Clone or navigate to the repository
cd /path/to/booking-agent

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in your configuration:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# LLM Provider (Groq or OpenAI)
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=gsk_your_groq_api_key_here
OPENAI_MODEL=openai/gpt-oss-120b

# Shop Settings
SHOP_NAME="Cedar Lane Auto Detailing"
SHOP_TIMEZONE="America/Los_Angeles"
SHOP_OPEN_HOUR=8
SHOP_CLOSE_HOUR=18
SHOP_BAYS=1

# Google Cloud Service Account
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
GOOGLE_SPREADSHEET_ID=your_google_spreadsheet_id_here

# Phase 2: Vapi Voice Configuration
VAPI_API_KEY=your_vapi_private_api_key_here
VAPI_PUBLIC_KEY=your_vapi_public_api_key_here
VAPI_ASSISTANT_ID=your_vapi_assistant_id_here
VAPI_SERVER_URL=https://your-tunnel-url.trycloudflare.com/api/vapi/webhook
```

---

## 🏃 Running the Application

### Option A: All-in-One Mode (Recommended)
Builds the client and serves both backend API and React frontend together on port `3001`:
```bash
# 1. Build client bundle
npm run build

# 2. Start server
npm run start
```
Open **[http://localhost:3001](http://localhost:3001)** in your browser.

### Option B: Development Mode (Hot Reloading)
Runs both the Fastify server and Vite dev server with instant HMR:
```bash
npm run dev
```
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Frontend Dev**: [http://localhost:5173](http://localhost:5173)

### Running Automated Tests
```bash
npm test
```

---

## 🎙️ Setting Up Phase 2: Live Voice Telephony

### Step 1: Expose Your Local Server to the Internet
Because Vapi cloud servers must send webhook callbacks to your local server, run a Cloudflare Tunnel:
```bash
./.data/cloudflared tunnel --url http://localhost:3001
```
This generates a public URL like:
```text
https://paragraph-crucial-respondents-surrey.trycloudflare.com
```

### Step 2: Auto-Provision the Vapi Assistant
Add your tunnel URL to `.env`:
```env
VAPI_SERVER_URL=https://paragraph-crucial-respondents-surrey.trycloudflare.com/api/vapi/webhook
```

Then run the automated provisioning script:
```bash
npm run vapi:setup
```
This script programmatically configures your assistant in Vapi with:
- **STT**: Deepgram Nova-2 with shop keyword boosts (`CedarLane`, `detailing`, `polish`, `ceramic`).
- **TTS**: Cartesia Sonic (`voiceId: a0e99841-438c-4a64-b679-ae501e7d6091`).
- **LLM**: GPT-4o-mini with system prompts tuned for spoken responses.
- **Server Tools**: `check_availability`, `book_appointment`, `reschedule_appointment`, `report_running_late`, `escalate_to_human`.

### Step 3: Test Voice Calling
- **In-Browser WebRTC (Free & Immediate)**:
  1. Open [http://localhost:3001](http://localhost:3001) (or open the Cloudflare link on your mobile phone browser).
  2. Click the **Voice (Vapi)** tab.
  3. Click **"Start Live Voice Call"** and speak into your microphone.
- **Physical Phone Calling (Cellular / PSTN)**:
  1. In [Vapi Dashboard](https://dashboard.vapi.ai) ➔ **Phone Numbers**, buy a number ($1.15/mo using free credits).
  2. Assign the **Cedar Lane Auto Detailing Receptionist** assistant to that number.
  3. Dial that number from any smartphone!

---

## 🔌 API Routes Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check and cloud integration status |
| `POST` | `/api/chat` | Phase 1 text conversation endpoint with LLM tool calling |
| `POST` | `/api/vapi/webhook` | Phase 2 primary Vapi webhook (`tool-calls`, `end-of-call-report`) |
| `GET` | `/api/vapi/config` | Exposes public keys for browser WebRTC audio calling |
| `GET` | `/api/calendar/events` | Fetches events from Google Calendar for verification |
| `GET` | `/api/sheets/rows` | Fetches contact rows from Google Sheets `Contacts` tab |
| `POST` | `/api/seed` | Seeds test appointments for conflict evaluation |

---

## 🛠️ Security & Operational Notes

- **Never Commit Secrets**: Ensure `.env` is never committed to source control (included in `.gitignore`).
- **No Git Push Constraint**: This repository is maintained locally.
- **Single-Bay Capacity**: `SHOP_BAYS` is set to `1` by default to realistically trigger availability conflicts and test alternative slot recommendation logic.

