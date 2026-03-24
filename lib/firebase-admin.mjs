import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

function parseServiceAccount() {
  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '';
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  const rawPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '';

  let parsed = null;

  if (rawBase64) {
    parsed = JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8'));
  } else if (rawJson) {
    parsed = JSON.parse(rawJson);
  } else if (rawPath) {
    parsed = JSON.parse(readFileSync(rawPath, 'utf8'));
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    parsed = {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  }

  if (!parsed) {
    throw new Error('Credenciais Firebase ausentes. Configure FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH ou as variaveis FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.');
  }

  return parsed;
}

export function getDb() {
  if (!getApps().length) {
    const serviceAccount = parseServiceAccount();
    initializeApp({
      credential: cert(serviceAccount)
    });
  }

  return getFirestore();
}
