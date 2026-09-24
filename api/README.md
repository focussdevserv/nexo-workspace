# API Nexo

API em Fastify/TypeScript com PostgreSQL e Drizzle. CRM, cobranças e assinaturas são persistidos e isolados por `organizationId`.

## Desenvolvimento

1. Instale Docker Desktop ou configure um PostgreSQL acessível.
2. Copie `api/.env.example` para `api/.env` e gere um `JWT_SECRET` aleatório com pelo menos 32 caracteres.
3. Defina `POSTGRES_PASSWORD` em um `.env` na raiz e rode `docker compose up -d postgres`.
4. Rode `npm install` em `api/`, depois `npm run db:migrate` e `npm run dev`.

O cadastro publico foi removido. `OWNER_EMAIL` (padrao `contato@focussdev.art`) e a unica conta permitida; o startup apaga outros usuarios apenas depois de localizar essa conta. Senhas usam Argon2id e a sessao fica em cookie HttpOnly, Secure em producao e SameSite=Strict, com expiracao de oito horas.

## Rotas

- `GET /api/health`
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST /api/clients`, `GET/PATCH/DELETE /api/clients/:id`
- `GET /api/billing/payment-methods`, `GET/POST /api/billing/orders`
- `GET/POST /api/billing/subscriptions`, `POST /api/billing/subscriptions/:id/cancel`
- `POST /api/integrations/mercadopago/webhook`

Rotas protegidas usam o cookie de sessao HttpOnly; requisicoes que alteram dados tambem validam o cabecalho Origin contra `APP_ORIGIN`. Cobrancas avulsas aceitam Pix, boleto e cartao; os dados do cartao sao tokenizados pelo MercadoPago.js.

Assinaturas usam a API `/preapproval`: o Nexo cria uma autorização pendente e entrega o `init_point` para o pagador escolher e autorizar o método no Mercado Pago. Depois da autorização, o Mercado Pago agenda as renovações e novas tentativas. A rota de cancelamento cancela também no provedor.

Defina `MERCADOPAGO_ACCESS_TOKEN` no ambiente da API. Depois de publicar, configure no app do Mercado Pago o webhook de produção para `https://focussdev.space/api/integrations/mercadopago/webhook`, evento **Order (Mercado Pago)**; coloque a chave gerada no painel em `MERCADOPAGO_WEBHOOK_SECRET` no Coolify e faça redeploy. O webhook valida a assinatura HMAC e consulta o recurso ao Mercado Pago antes de alterar estados locais.

Antes de expor a API no VPS, use HTTPS por proxy reverso, restrinja `APP_ORIGIN`, configure segredos fortes e mantenha a porta do PostgreSQL privada.
