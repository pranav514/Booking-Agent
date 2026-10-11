import dotenv from 'dotenv';
import path from 'path';

// Load .env if present
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel: string;
  anthropicApiKey?: string;
  shopName: string;
  shopTimezone: string;
  shopOpenHour: number;
  shopCloseHour: number;
  google: {
    serviceAccountEmail?: string;
    privateKey?: string;
    calendarId?: string;
    spreadsheetId?: string;
    isConfigured: boolean;
    isCalendarConfigured: boolean;
    isSheetsConfigured: boolean;
  };
  vapi: {
    apiKey?: string;
    publicKey?: string;
    assistantId?: string;
    webhookSecret?: string;
    serverUrl?: string;
  };
}

const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

const isCalendarConfigured = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  privateKey &&
  process.env.GOOGLE_CALENDAR_ID
);

const isSheetsConfigured = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  privateKey &&
  process.env.GOOGLE_SPREADSHEET_ID
);

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiBaseUrl: process.env.OPENAI_BASE_URL,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  shopName: process.env.SHOP_NAME || 'Cedar Lane Auto Detailing',
  shopTimezone: process.env.SHOP_TIMEZONE || 'America/Los_Angeles',
  shopOpenHour: parseInt(process.env.SHOP_OPEN_HOUR || '8', 10),
  shopCloseHour: parseInt(process.env.SHOP_CLOSE_HOUR || '18', 10),
  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey,
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    isConfigured: isCalendarConfigured || isSheetsConfigured,
    isCalendarConfigured,
    isSheetsConfigured,
  },
  vapi: {
    apiKey: process.env.VAPI_API_KEY || process.env.VAPI_PRIVATE_API_KEY,
    publicKey: process.env.VAPI_PUBLIC_KEY,
    assistantId: process.env.VAPI_ASSISTANT_ID,
    webhookSecret: process.env.VAPI_WEBHOOK_SECRET,
    serverUrl: process.env.VAPI_SERVER_URL,
  },
};

