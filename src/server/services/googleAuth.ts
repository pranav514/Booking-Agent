import { config } from '../config.js';

export async function getGoogleAuthClient() {
  if (!config.google.isConfigured) {
    return null;
  }

  const { google } = await import('googleapis');
  const jwtClient = new google.auth.JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });

  return jwtClient;
}

