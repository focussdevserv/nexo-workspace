# Preparar as integrações do Nexo

Este guia reúne as contas, permissões e valores necessários para habilitar as integrações pendentes. As credenciais devem ser copiadas diretamente para as variáveis protegidas do serviço API no Coolify; não as envie por chat, e-mail ou formulário do Nexo.

## Google Workspace — OAuth de Gmail, Calendar e Drive

1. Entre no [Google Cloud Console](https://console.cloud.google.com/) com a conta Google que será usada pelo Nexo e selecione ou crie um projeto.
2. Ative as APIs Google Calendar, Google Drive e Gmail para esse projeto.
3. Configure a tela de consentimento OAuth com o nome e o e-mail de suporte do titular. Se o app ficar em modo de teste, inclua a conta que será conectada como usuário de teste.
4. Crie uma credencial OAuth do tipo **Aplicativo da Web**.
5. Cadastre exatamente esta URI em **URIs de redirecionamento autorizados**:

   `https://focussdev.space/api/integrations/google/callback`

6. Salve os valores no recurso Compose do Coolify, no serviço `api`:

   - `GOOGLE_CLIENT_ID`: ID do cliente OAuth.
   - `GOOGLE_CLIENT_SECRET`: segredo do cliente OAuth.
   - `GOOGLE_REDIRECT_URI`: `https://focussdev.space/api/integrations/google/callback`.

7. Faça redeploy da API. No Nexo, abra **Integrações → Google Workspace → Autorizar conta Google** e aceite os escopos solicitados. Para Gmail e Drive, confira os requisitos de publicação/verificação do OAuth do Google antes de usar fora das contas de teste.

O Gmail pode enviar novos e-mails e respostas com ate 5 anexos, limitados a 8 MiB no total. O WhatsApp pode enviar um arquivo por mensagem, limitado a 8 MiB, pela rota WAHA `POST /api/sendFile` usando Base64. O envio real exige WAHA configurada e sessao pareada e ativa.

O fluxo solicita openid, email, profile, calendar.events, drive.file, gmail.send e gmail.modify. O acesso `gmail.modify` permite ler threads, marcar mensagens como lidas e responder na thread; por isso, exige nova autorizacao depois do redeploy. Os tokens OAuth ficam criptografados no banco com chave derivada do `JWT_SECRET` da API.

## GitHub — leitura de repositórios

1. Abra [Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new) na conta com acesso aos repositórios.
2. Restrinja o token aos repositórios usados no Nexo e escolha uma validade adequada à política da conta.
3. Conceda somente permissões de repositório **Read-only**: `Metadata`, `Contents`, `Pull requests` e `Deployments`.
4. Copie o token uma vez para `GITHUB_TOKEN` no serviço `api` do Coolify e faça redeploy.
5. No Nexo, teste a conexão e sincronize um repositório autorizado.

O Nexo consulta identidade, metadados, commits, pull requests e deployments. Esse token não precisa de permissão de escrita.

## Clicksign — assinatura de contratos

1. Gere um token de API na [conta Clicksign](https://app.clicksign.com/). Para homologação, use a conta e o endpoint de sandbox da Clicksign.
2. No Coolify, configure `CLICKSIGN_API_TOKEN` e selecione o ambiente em `CLICKSIGN_API_BASE_URL`:
   - Sandbox: `https://sandbox.clicksign.com`
   - Produção: `https://app.clicksign.com`
3. Na conta Clicksign, cadastre e ative um webhook para:

   `https://focussdev.space/api/integrations/clicksign/webhook`

4. Selecione os eventos `document_closed`, `auto_close`, `close`, `cancel`, `deadline`, `refusal` e `sign`. Copie o segredo HMAC do webhook para `CLICKSIGN_WEBHOOK_SECRET` no serviço `api`.
5. Faça redeploy e use **Testar conexão**. Para começar, prefira sandbox; o teste não cria nem envia envelopes.

## Sentry — captura de erros

1. Entre/crie a organização no [Sentry](https://sentry.io/) e crie um projeto para o frontend React e outro para a API Node.js, ou confirme a estratégia de projeto antes de reutilizar um DSN.
2. Copie o DSN de cada projeto:
   - Projeto API → `SENTRY_DSN` como variável de runtime do serviço `api`.
   - Projeto React → `VITE_SENTRY_DSN` como variável de build do serviço `web`.
3. Faça redeploy dos serviços `api` e `web`, pois `VITE_SENTRY_DSN` é incorporado durante o build.
4. Confira o status no painel de Integrações. Não gere erros artificiais em produção para validar a captura.

## Estado verificado no ambiente local — 2026-10-01

O endpoint autenticado `/api/integrations/status` retornou as nove integrações como `configured: false` e `enabled: false`: Mercado Pago, Evolution API, WAHA, Resend, Google Workspace, Clicksign, GitHub, n8n e Sentry. O arquivo de ambiente local da API contém apenas configurações de servidor, banco e sessão; nenhuma variável de provedor está presente. Portanto, mensagens, e-mails, cobranças, OAuth e workflows reais ainda não podem ser usados neste ambiente.

Para habilitar os fluxos mais usados, configure no serviço API do Coolify:

- **Cobranças:** `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET`.
- **E-mail e código do portal:** `RESEND_API_KEY` e `RESEND_FROM_EMAIL`, com domínio verificado no Resend.
- **WhatsApp:** `WAHA_API_URL` e `WAHA_API_KEY`; depois conecte a sessão pelo QR no Nexo. Evolution é alternativa opcional ao WAHA.
- **Gmail, Agenda e Drive:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI`, além do consentimento OAuth e das APIs ativadas no Google Cloud.
- **Automações n8n:** `N8N_BASE_URL` e `N8N_API_KEY`.

As integrações de assinatura, repositórios e monitoramento também exigem suas próprias contas e variáveis listadas neste guia. Não reutilize chaves de produção para os testes locais sem validar o workspace e os efeitos externos.

## Aplicar e validar

No Coolify, edite as variáveis do recurso Nexo, mantenha os segredos como valores protegidos e aplique/reimplante. Não coloque chaves em arquivos versionados (`.env`, `.env.example`) nem em commits. Depois do redeploy, use **Atualizar status** e **Testar conexão** no painel do Nexo. Esses testes de conexão consultam o provedor sem enviar mensagem, e-mail, cobrança ou contrato.

## Links oficiais de referência

- [Google OAuth para aplicações web de servidor](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Permissões dos fine-grained tokens GitHub](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [Documentação da API Clicksign](https://developers.clicksign.com/)
- [Webhooks Clicksign](https://developers.clicksign.com/v2.0/docs/cadastro-de-webhooks-via-api)
- [Criar projeto Sentry](https://docs.sentry.io/api/projects/create-a-new-project/)

## Google Drive e aprovacoes no portal - nota operacional

Compartilhar um arquivo para aprovacao concede leitura a qualquer pessoa que tenha o link, com descoberta publica desativada. O Nexo solicita confirmacao antes de criar essa permissao. Se a politica da conta Google bloquear links publicos, a operacao falha e a aprovacao nao e salva. Permissoes que ja existiam antes do Nexo nao sao removidas pela acao de revogacao do app.

As contas na area financeira sao registros manuais. Transferencias entre elas atualizam o controle interno e nao movimentam fundos na instituicao financeira.
