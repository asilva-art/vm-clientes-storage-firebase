import { GoogleAuth } from 'google-auth-library';

const projectId = 'vm-cadastro-clientes';
const keyFile = '/Users/avas/Downloads/10_Credenciais_Acessos/vm-cadastro-clientes-firebase-adminsdk-fbsvc-526e2e6318.json';

const rulesContent = String.raw`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isRequiredString(value, max) {
      return value is string && value.size() > 0 && value.size() <= max;
    }

    function isOptionalString(value, max) {
      return value is string && value.size() <= max;
    }

    function isRequiredEmail(value) {
      return isRequiredString(value, 160) && value.matches('^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$');
    }

    function isOptionalEmail(value) {
      return value == '' || (value is string && value.size() <= 160 && value.matches('^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$'));
    }

    function isRequiredPhone(value) {
      return isRequiredString(value, 24) && value.matches('^[0-9+()\\-\\s]+$');
    }

    function isOptionalPhone(value) {
      return value == '' || (value is string && value.size() <= 24 && value.matches('^[0-9+()\\-\\s]+$'));
    }

    function isIsoDateTime(value) {
      return value is string && value.matches('^\\d{4}-\\d{2}-\\d{2}T[^\\s]+Z$');
    }

    function hasExpectedKeys() {
      return request.resource.data.keys().hasOnly([
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
        'submitted_at',
        'received_at',
        'origin',
        'page_path',
        'user_agent',
        'status',
        'storage_mode',
        'storage_version'
      ]) && request.resource.data.keys().hasAll([
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
        'submitted_at',
        'received_at',
        'origin',
        'page_path',
        'user_agent',
        'status',
        'storage_mode',
        'storage_version'
      ]);
    }

    function hasValidEnums() {
      return (
        request.resource.data.characteristic == 'Pós-venda' ||
        request.resource.data.characteristic == 'Inovação' ||
        request.resource.data.characteristic == 'Qualidade' ||
        request.resource.data.characteristic == 'Sofisticação' ||
        request.resource.data.characteristic == 'Relacionamento' ||
        request.resource.data.characteristic == 'Criatividade' ||
        request.resource.data.characteristic == 'Assiduidade' ||
        request.resource.data.characteristic == 'Competitividade "Preço"'
      ) && (
        request.resource.data.referral_source == 'Google' ||
        request.resource.data.referral_source == 'Instagram' ||
        request.resource.data.referral_source == 'Facebook' ||
        request.resource.data.referral_source == 'Amigos' ||
        request.resource.data.referral_source == 'Outro'
      );
    }

    function hasValidMetadata() {
      return request.resource.data.source_form == 'forms-cadastro-inicial-clientes'
        && request.resource.data.status == 'new'
        && request.resource.data.storage_mode == 'firebase_client'
        && request.resource.data.storage_version == 1
        && request.resource.data.origin == 'https://www.vmarquitetos.com'
        && request.resource.data.page_path.matches('^/forms-cadastro-inicial-clientes/?$')
        && request.resource.data.page_url.matches('^https://www\\.vmarquitetos\\.com/forms-cadastro-inicial-clientes/?(?:\\?.*)?$')
        && isIsoDateTime(request.resource.data.submitted_at)
        && isIsoDateTime(request.resource.data.received_at);
    }

    function hasValidPayload() {
      return hasExpectedKeys()
        && hasValidEnums()
        && hasValidMetadata()
        && isRequiredString(request.resource.data.full_name, 200)
        && request.resource.data.cpf is string
        && request.resource.data.cpf.matches('^\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}$')
        && isRequiredPhone(request.resource.data.phone_primary)
        && isOptionalPhone(request.resource.data.phone_secondary)
        && isRequiredEmail(request.resource.data.email_primary)
        && isOptionalEmail(request.resource.data.email_secondary)
        && request.resource.data.birthday_ddmm is string
        && request.resource.data.birthday_ddmm.matches('^\\d{2}/\\d{2}$')
        && isRequiredString(request.resource.data.address_correspondence, 1200)
        && isRequiredString(request.resource.data.address_project, 1200)
        && isOptionalString(request.resource.data.referral_source_other, 200)
        && isOptionalString(request.resource.data.extra_info, 2000)
        && isOptionalString(request.resource.data.utm_source, 200)
        && isOptionalString(request.resource.data.utm_medium, 200)
        && isOptionalString(request.resource.data.utm_campaign, 200)
        && isOptionalString(request.resource.data.utm_term, 200)
        && isOptionalString(request.resource.data.utm_content, 200)
        && isOptionalString(request.resource.data.referrer, 500)
        && isOptionalString(request.resource.data.user_agent, 500)
        && (
          request.resource.data.referral_source != 'Outro' ||
          isRequiredString(request.resource.data.referral_source_other, 200)
        );
    }

    match /client_submissions/{submissionId} {
      allow create: if hasValidPayload();
      allow read, update, delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;

const auth = new GoogleAuth({
  keyFile,
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase'
  ]
});

const client = await auth.getClient();
const tokenData = await client.getAccessToken();
const accessToken = typeof tokenData === 'string' ? tokenData : tokenData?.token;

if (!accessToken) {
  throw new Error('Nao foi possivel obter access token.');
}

const createResponse = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    source: {
      files: [
        {
          name: 'firestore.rules',
          content: rulesContent
        }
      ]
    }
  })
});

const createText = await createResponse.text();
if (!createResponse.ok) {
  console.error(createText);
  process.exit(1);
}

const created = JSON.parse(createText);

const releaseResponse = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    release: {
      name: `projects/${projectId}/releases/cloud.firestore`,
      rulesetName: created.name
    },
    updateMask: 'rulesetName'
  })
});

const releaseText = await releaseResponse.text();
if (!releaseResponse.ok) {
  console.error(releaseText);
  process.exit(1);
}

console.log(JSON.stringify({ ruleset: created.name, release: JSON.parse(releaseText) }, null, 2));
