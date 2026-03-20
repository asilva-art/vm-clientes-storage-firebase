import { getDb } from '../../lib/firebase-admin.mjs';
import { notifyClientSubmission } from '../../lib/client-notifications.mjs';

const ALLOWED_ORIGINS = new Set([
  'https://www.vmarquitetos.com'
]);

const FIELDS = [
  'characteristic',
  'referral_source',
  'referral_source_other',
  'full_name',
  'cpf',
  'phone_primary',
  'phone_secondary',
  'email_primary',
  'email_secondary',
  'birthday_ddmm',
  'address_correspondence',
  'address_project',
  'extra_info',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'page_url',
  'referrer',
  'source_form',
  'submitted_at'
];

function clean(value) {
  return String(value ?? '').trim();
}

function parseRequestBody(raw) {
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }
}

function getCorsHeaders(origin = '') {
  const safeOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.vmarquitetos.com';
  return {
    'Access-Control-Allow-Origin': safeOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin'
  };
}

function json(body, init = {}, origin = '') {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...getCorsHeaders(origin),
      ...(init.headers || {})
    }
  });
}

function pickPayload(input) {
  const payload = {};
  for (const field of FIELDS) payload[field] = clean(input[field]);
  return payload;
}

function validatePayload(payload) {
  const required = [
    'characteristic',
    'referral_source',
    'full_name',
    'cpf',
    'phone_primary',
    'email_primary',
    'address_correspondence',
    'address_project'
  ];

  for (const field of required) {
    if (!clean(payload[field])) return `Campo obrigatorio ausente: ${field}`;
  }

  if (payload.referral_source === 'Outro' && !clean(payload.referral_source_other)) {
    return 'Campo obrigatorio ausente: referral_source_other';
  }

  return '';
}

export default async (request, context) => {
  const origin = request.headers.get('origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: getCorsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, message: 'Metodo nao permitido.' }, { status: 405 }, origin);
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ ok: false, message: 'Origem nao autorizada.' }, { status: 403 }, origin);
  }

  const raw = await request.text();
  const parsed = parseRequestBody(raw);

  if (clean(parsed.website)) {
    return json({ ok: true, message: 'Recebido.' }, { status: 200 }, origin);
  }

  const payload = pickPayload(parsed);
  payload.source_form = payload.source_form || 'forms-cadastro-inicial-clientes';
  payload.submitted_at = payload.submitted_at || new Date().toISOString();
  payload.received_at = new Date().toISOString();
  payload.origin = origin;
  payload.user_agent = clean(request.headers.get('user-agent'));
  payload.ip_country = clean(context.geo?.country?.code || context.geo?.country?.name || '');
  payload.status = 'new';

  const validationError = validatePayload(payload);
  if (validationError) {
    return json({ ok: false, message: validationError }, { status: 400 }, origin);
  }

  const db = getDb();
  const docRef = await db.collection('client_submissions').add(payload);
  const notificationTask = notifyClientSubmission({
    db,
    submissionId: docRef.id,
    payload
  }).catch((error) => {
    console.error('client notification failed', error);
  });

  if (typeof context.waitUntil === 'function') {
    context.waitUntil(notificationTask);
  } else {
    await notificationTask;
  }

  return json(
    {
      ok: true,
      id: docRef.id,
      message: 'Cadastro armazenado com sucesso.'
    },
    { status: 200 },
    origin
  );
};
