import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { getGoogleAuthClient } from './googleAuth.js';
import { CallLogRecord, ISheetsService } from './types.js';
import { parsePhoneNumber } from '../domain/phoneParser.js';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const SHEETS_STORE_FILE = path.join(DATA_DIR, 'sheets.json');

export const SHEET_COLUMNS = [
  'Timestamp',
  'Caller Name',
  'Phone Number',
  'Channel',
  'Intent',
  'Service / Topic',
  'Scheduled Time',
  'Status',
  'Escalation Required',
  'Call Notes / Summary',
];

export class SheetsService implements ISheetsService {
  private logs: CallLogRecord[] = [];

  constructor() {
    this.ensureStorage();
    this.loadFromStorage();
  }

  private ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SHEETS_STORE_FILE)) {
      fs.writeFileSync(SHEETS_STORE_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private loadFromStorage() {
    try {
      const data = fs.readFileSync(SHEETS_STORE_FILE, 'utf-8');
      this.logs = JSON.parse(data);
    } catch {
      this.logs = [];
    }
  }

  private saveToStorage() {
    fs.writeFileSync(SHEETS_STORE_FILE, JSON.stringify(this.logs, null, 2), 'utf-8');
  }

  public async logCall(record: CallLogRecord): Promise<void> {
    const enrichedRecord: CallLogRecord = {
      ...record,
      id: record.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: record.timestamp || new Date().toISOString(),
      customerPhone: parsePhoneNumber(record.customerPhone) || record.customerPhone,
    };

    if (config.google.isSheetsConfigured) {
      try {
        const auth = await getGoogleAuthClient();
        if (auth) {
          const { google } = await import('googleapis');
          const sheets = google.sheets({ version: 'v4', auth });
          const rowValues = [
            enrichedRecord.timestamp,
            enrichedRecord.customerName,
            enrichedRecord.customerPhone,
            enrichedRecord.channel,
            enrichedRecord.intent,
            enrichedRecord.serviceOrTopic,
            enrichedRecord.scheduledTime || 'N/A',
            enrichedRecord.status,
            enrichedRecord.escalationRequired ? 'TRUE' : 'FALSE',
            enrichedRecord.notes,
          ];

          await sheets.spreadsheets.values.append({
            spreadsheetId: config.google.spreadsheetId,
            range: 'Contacts!A:J',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [rowValues],
            },
          });
        }
      } catch (err) {
        console.warn('Google Sheets API append error, logging locally:', err);
      }
    }

    // Save locally
    this.logs.unshift(enrichedRecord); // newest first
    this.saveToStorage();
  }

  public async listCallLogs(limit: number = 50): Promise<CallLogRecord[]> {
    return this.logs.slice(0, limit);
  }

  public async findCustomerHistory(customerPhone: string): Promise<CallLogRecord[]> {
    const cleanPhone = parsePhoneNumber(customerPhone).replace(/\D/g, '');
    if (!cleanPhone) return [];

    return this.logs.filter((log) => {
      const logPhone = parsePhoneNumber(log.customerPhone).replace(/\D/g, '');
      return logPhone.includes(cleanPhone) || cleanPhone.includes(logPhone);
    });
  }

  public async clearAll(): Promise<void> {
    this.logs = [];
    this.saveToStorage();
  }
}

export const sheetsService = new SheetsService();

