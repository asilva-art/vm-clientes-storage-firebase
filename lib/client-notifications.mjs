function clean(value) {
  return String(value ?? '').trim();
}

function parseRecipients(raw) {
  return String(raw || '')
    .split(',')
    .map((value) => clean(value).toLowerCase())
    .filter(Boolean);
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
    page_url: clean(payload.page_url)
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
    `ID interno: ${summary.submission_id || '-'}`
  ].join('\n');
}

async function tryRelayNotification({ recipients, subject, text, summary }) {
  const relayUrl = clean(
    process.env.EMAIL_NOTIFICATION_RELAY_URL ||
      process.env.GOOGLE_APPS_SCRIPT_RELAY_URL
  );

  if (!relayUrl) {
    return {
      status: 'queued_no_transport',
      detail: 'Nenhum transporte de e-mail configurado.'
    };
  }

  const authToken = clean(
    process.env.EMAIL_NOTIFICATION_RELAY_TOKEN ||
      process.env.GOOGLE_APPS_SCRIPT_RELAY_TOKEN
  );

  const headers = {
    'Content-Type': 'application/json'
  };

  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(relayUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event: 'client_submission_created',
      recipients,
      subject,
      text,
      summary
    })
  });

  if (!response.ok) {
    const detail = clean(await response.text()).slice(0, 500);
    return {
      status: 'queued_transport_error',
      detail: `${response.status} ${detail}`.trim()
    };
  }

  return {
    status: 'sent',
    detail: 'Notificacao aceita pelo transporte configurado.'
  };
}

export async function notifyClientSubmission({ db, submissionId, payload }) {
  const recipients = parseRecipients(process.env.NOTIFICATION_RECIPIENTS);
  const now = new Date().toISOString();

  if (!recipients.length) {
    await db.collection('client_submissions').doc(submissionId).update({
      notification_status: 'disabled_no_recipients',
      notification_updated_at: now,
      notification_recipients: []
    });

    return {
      status: 'disabled_no_recipients',
      detail: 'Nenhum destinatario configurado.'
    };
  }

  const summary = buildSummary({ submissionId, payload });
  const subject = buildSubject(summary);
  const text = buildTextBody(summary);

  const queueRef = await db.collection('client_submission_notifications').add({
    channel: 'email',
    event: 'client_submission_created',
    submission_id: submissionId,
    recipients,
    subject,
    summary,
    transport_status: 'queued',
    transport_detail: 'Aguardando tentativa de envio.',
    created_at: now,
    updated_at: now
  });

  let relayResult;
  try {
    relayResult = await tryRelayNotification({
      recipients,
      subject,
      text,
      summary
    });
  } catch (error) {
    relayResult = {
      status: 'queued_transport_error',
      detail: clean(error?.message || error)
    };
  }

  const updatedAt = new Date().toISOString();

  await queueRef.update({
    transport_status: relayResult.status,
    transport_detail: relayResult.detail,
    updated_at: updatedAt
  });

  await db.collection('client_submissions').doc(submissionId).update({
    notification_status: relayResult.status,
    notification_recipients: recipients,
    notification_event_id: queueRef.id,
    notification_updated_at: updatedAt
  });

  return {
    status: relayResult.status,
    detail: relayResult.detail,
    notificationEventId: queueRef.id
  };
}
