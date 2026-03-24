import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getDb } from '../lib/firebase-admin.mjs';

const execFileAsync = promisify(execFile);

const DEFAULT_RECIPIENTS = [
  'asilva@vmarquitetos.com',
  'financeiro@vmarquitetos.com',
  'vmazoni@vmarquitetos.com'
];

const MAX_SCAN = Number(process.env.NOTIFICATION_SCAN_LIMIT || 25);
const LOCK_TIMEOUT_MS = Number(process.env.NOTIFICATION_LOCK_TIMEOUT_MS || 10 * 60 * 1000);
const MAIL_ACCOUNT_NAME = String(process.env.MAIL_ACCOUNT_NAME || 'VM').trim();
const MAIL_SENDER_ADDRESS = String(process.env.MAIL_SENDER_ADDRESS || 'asilva@vmarquitetos.com').trim();
const MAIL_SCRIPT_PATH = String(
  process.env.MAIL_APP_SCRIPT_PATH ||
    '/Users/avas/Documents/CODEX[VM][BACKEND]-vm-clientes-storage-firebase/scripts/send-vm-notification.applescript'
).trim();
const NOTIFICATION_TRANSPORT = 'mail_app_vm_local';

function clean(value) {
  return String(value ?? '').trim();
}

function parseRecipients(raw) {
  const fallback = DEFAULT_RECIPIENTS.join(',');
  return String(raw || fallback)
    .split(',')
    .map((value) => clean(value).toLowerCase())
    .filter(Boolean);
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function isStaleLock(value) {
  const timestamp = Date.parse(clean(value));
  if (!timestamp) return true;
  return Date.now() - timestamp > LOCK_TIMEOUT_MS;
}

function shouldProcessSubmission(data) {
  const status = clean(data.notification_status);
  if (!status) return true;
  return status !== 'sent_local_mail';
}

function buildSummary({ submissionId, payload }) {
  return {
    submission_id: submissionId,
    source_form: clean(payload.source_form),
    submitted_at: clean(payload.submitted_at),
    received_at: clean(payload.received_at),
    full_name: clean(payload.full_name),
    email_primary: clean(payload.email_primary),
    phone_primary: clean(payload.phone_primary),
    characteristic: clean(payload.characteristic),
    referral_source: clean(payload.referral_source),
    page_url: clean(payload.page_url),
  };
}

function buildSubject(summary) {
  const name = summary.full_name || 'Cliente sem identificacao';
  return `Novo cadastro de cliente: ${name}`;
}

function buildTextBody(summary) {
  return [
    'Novo cadastro inicial de cliente recebido pela VM + Arquitetos.',
    '',
    `Nome: ${summary.full_name || '-'}`,
    `E-mail principal: ${summary.email_primary || '-'}`,
    `WhatsApp principal: ${summary.phone_primary || '-'}`,
    `Caracteristica principal: ${summary.characteristic || '-'}`,
    `Como conheceu: ${summary.referral_source || '-'}`,
    `Data/hora do envio: ${summary.submitted_at || summary.received_at || '-'}`,
    `Formulario: ${summary.source_form || '-'}`,
    `URL: ${summary.page_url || '-'}`,
    `ID interno: ${summary.submission_id || '-'}`,
  ].join('\n');
}

async function sendViaMailApp({ recipients, subject, text }) {
  const { stdout } = await execFileAsync('osascript', [
    MAIL_SCRIPT_PATH,
    MAIL_SENDER_ADDRESS,
    recipients.join('\n'),
    subject,
    text,
  ]);

  return clean(stdout) === 'ok';
}

async function claimSubmission(db, docRef, recipients) {
  const now = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists) return null;

    const data = snapshot.data() || {};
    const status = clean(data.notification_status);

    if (status === 'sent_local_mail') return null;
    if (status === 'sending_local_mail' && !isStaleLock(data.notification_locked_at)) {
      return null;
    }

    const attempts = safeNumber(data.notification_attempts, 0) + 1;

    transaction.update(docRef, {
      notification_status: 'sending_local_mail',
      notification_transport: NOTIFICATION_TRANSPORT,
      notification_recipients: recipients,
      notification_attempts: attempts,
      notification_locked_at: now,
      notification_updated_at: now,
      notification_last_error: '',
    });

    return {
      data,
      attempts,
      lockedAt: now,
    };
  });
}

async function createEvent(db, { submissionId, recipients, subject, summary }) {
  const now = new Date().toISOString();
  const eventRef = await db.collection('client_submission_notifications').add({
    channel: 'email',
    transport: NOTIFICATION_TRANSPORT,
    event: 'client_submission_created',
    submission_id: submissionId,
    recipients,
    subject,
    summary,
    transport_status: 'sending_local_mail',
    transport_detail: `Despacho iniciado via Mail app (${MAIL_ACCOUNT_NAME}).`,
    created_at: now,
    updated_at: now,
  });

  return eventRef;
}

async function markSent(docRef, eventRef, recipients) {
  const now = new Date().toISOString();

  await eventRef.update({
    transport_status: 'sent_local_mail',
    transport_detail: `Mensagem enviada via Mail app (${MAIL_ACCOUNT_NAME}).`,
    updated_at: now,
  });

  await docRef.update({
    notification_status: 'sent_local_mail',
    notification_transport: NOTIFICATION_TRANSPORT,
    notification_recipients: recipients,
    notification_event_id: eventRef.id,
    notification_locked_at: '',
    notification_updated_at: now,
    notification_last_error: '',
  });
}

async function markError(docRef, eventRef, recipients, error, attempts) {
  const detail = clean(error?.message || error).slice(0, 1000) || 'Falha desconhecida.';
  const now = new Date().toISOString();

  await eventRef.update({
    transport_status: 'error_local_mail',
    transport_detail: detail,
    updated_at: now,
  });

  await docRef.update({
    notification_status: 'error_local_mail',
    notification_transport: NOTIFICATION_TRANSPORT,
    notification_recipients: recipients,
    notification_event_id: eventRef.id,
    notification_attempts: attempts,
    notification_locked_at: '',
    notification_updated_at: now,
    notification_last_error: detail,
  });
}

async function processSubmission(db, doc, recipients) {
  const claim = await claimSubmission(db, doc.ref, recipients);
  if (!claim) return { skipped: true };

  const summary = buildSummary({
    submissionId: doc.id,
    payload: claim.data,
  });
  const subject = buildSubject(summary);
  const text = buildTextBody(summary);
  const eventRef = await createEvent(db, {
    submissionId: doc.id,
    recipients,
    subject,
    summary,
  });

  try {
    const sent = await sendViaMailApp({ recipients, subject, text });
    if (!sent) {
      throw new Error('Mail app nao confirmou o envio.');
    }

    await markSent(doc.ref, eventRef, recipients);
    return { sent: true, id: doc.id };
  } catch (error) {
    await markError(doc.ref, eventRef, recipients, error, claim.attempts);
    return { sent: false, id: doc.id, error: clean(error?.message || error) };
  }
}

async function main() {
  const recipients = parseRecipients(process.env.NOTIFICATION_RECIPIENTS);
  if (!recipients.length) {
    throw new Error('NOTIFICATION_RECIPIENTS vazio.');
  }

  const db = getDb();
  const snapshot = await db
    .collection('client_submissions')
    .orderBy('submitted_at', 'asc')
    .limit(MAX_SCAN)
    .get();

  const pendingDocs = snapshot.docs.filter((doc) => shouldProcessSubmission(doc.data() || {}));

  const results = [];
  for (const doc of pendingDocs) {
    results.push(await processSubmission(db, doc, recipients));
  }

  const sent = results.filter((item) => item.sent).length;
  const skipped = results.filter((item) => item.skipped).length;
  const failed = results.filter((item) => item.sent === false).length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        scanned: snapshot.size,
        pending: pendingDocs.length,
        sent,
        skipped,
        failed,
        transport: NOTIFICATION_TRANSPORT,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: clean(error?.message || error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
