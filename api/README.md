# API Nexo

API em Fastify/TypeScript com PostgreSQL e Drizzle. O primeiro módulo persistido é o CRM de clientes. Todos os registros de negócio usam `organizationId`; as consultas de clientes sempre limitam o escopo à organização do token.

## Desenvolvimento

1. Instale Docker Desktop ou configure um PostgreSQL acessível.
2. Copie `api/.env.example` para `api/.env` e gere um `JWT_SECRET` aleatório com pelo menos 32 caracteres.
3. Defina `POSTGRES_PASSWORD` em um `.env` na raiz e rode `docker compose up -d postgres`.
4. Rode `npm install` em `api/`, depois `npm run db:generate`, `npm run db:migrate`, `npm run dev`.

`POST /api/auth/register` cria a organização e o primeiro usuário proprietário. A rota exige o header `x-bootstrap-token` configurado no servidor e fecha depois do primeiro usuário. Senhas são armazenadas com Argon2id. O token de acesso expira em oito horas.

## Rotas

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/clients`, `GET/PATCH/DELETE /api/clients/:id`

Rotas de clientes exigem `Authorization: Bearer <token>`. Exclusão arquiva o cliente e registra atividade; não apaga dados.

Antes de expor a API no VPS, use HTTPS por proxy reverso, restrinja `APP_ORIGIN`, configure segredos fortes e mantenha a porta do PostgreSQL privada. Integrações e credenciais externas ficam fora deste primeiro módulo.
