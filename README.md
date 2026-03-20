# VM Clientes Storage Firebase

Backend serverless do formulario de clientes da VM + Arquitetos.

## Objetivo

Receber os cadastros do formulario publico em `https://www.vmarquitetos.com/forms-cadastro-inicial-clientes/`
e persistir os dados em `Cloud Firestore`, mantendo o link publico atual e removendo a dependencia de Google Forms.

## Estrutura proposta

- Colecao Firestore: `client_submissions`
- Colecao Firestore: `client_submission_notifications`
- Funcao principal: `/.netlify/functions/submit-client`
- Healthcheck: `/.netlify/functions/ping`

## Variaveis de ambiente

Use uma das opcoes abaixo:

1. `FIREBASE_SERVICE_ACCOUNT_BASE64`
2. `FIREBASE_SERVICE_ACCOUNT_JSON`
3. `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`
4. `NOTIFICATION_RECIPIENTS` com e-mails separados por virgula
5. Opcional: `EMAIL_NOTIFICATION_RELAY_URL` ou `GOOGLE_APPS_SCRIPT_RELAY_URL`
6. Opcional: `EMAIL_NOTIFICATION_RELAY_TOKEN` ou `GOOGLE_APPS_SCRIPT_RELAY_TOKEN`

## Campos recebidos

- `characteristic`
- `referral_source`
- `referral_source_other`
- `full_name`
- `cpf`
- `phone_primary`
- `phone_secondary`
- `email_primary`
- `email_secondary`
- `birthday_ddmm`
- `address_correspondence`
- `address_project`
- `extra_info`
- `utm_*`
- `page_url`
- `referrer`

## Estado atual

O frontend ja foi preparado para trocar o destino de envio por configuracao.
A publicacao final depende da credencial do projeto Firebase correto (`vm-cadastro-clientes`) e do deploy do endpoint.

## Notificacoes

Cada novo cadastro gera um evento interno em `client_submission_notifications`.
Se houver um transporte de e-mail configurado, o backend tenta disparar a notificacao.
Sem transporte configurado, o envio fica auditado com status `queued_no_transport`, sem afetar o armazenamento principal do cadastro.
