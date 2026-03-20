# VM Clientes Storage Firebase

Backend serverless do formulario de clientes da VM + Arquitetos.

## Objetivo

Receber os cadastros do formulario publico em `https://www.vmarquitetos.com/forms-cadastro-inicial-clientes/`
e persistir os dados em `Cloud Firestore`, mantendo o link publico atual e removendo a dependencia de Google Forms.

## Estrutura proposta

- Colecao Firestore: `client_submissions`
- Funcao principal: `/.netlify/functions/submit-client`
- Healthcheck: `/.netlify/functions/ping`

## Variaveis de ambiente

Use uma das opcoes abaixo:

1. `FIREBASE_SERVICE_ACCOUNT_BASE64`
2. `FIREBASE_SERVICE_ACCOUNT_JSON`
3. `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`

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
