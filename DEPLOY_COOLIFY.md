# Publicar o Nexo em `focussdev.space`

## Resultado da inspeção da VPS Hostinger (23/09/2026)

- Ubuntu 24.04 LTS, plano KVM 2, 2 vCPU, 8 GB RAM e 100 GB de disco; recursos suficientes para iniciar o Nexo.
- O servidor já executa a stack `hubfy_platform`, com 10 containers ativos, PostgreSQL e um proxy publicado nas portas 80/443.
- O Gerenciador Docker da Hostinger não está instalado, mas Docker e Compose já estão em uso.
- Não há chave SSH cadastrada visível na conta; o painel mostra o usuário `root` e acesso por SSH.
- Na lista de domínios Hostinger aparece `pagfocuss.tech`; `focussdev.space` não consta nessa conta.
- O painel indica vencimento do VPS em 22/10/2026 e renovação automática desligada.

**Não instale Coolify diretamente nessa VPS neste estado.** Ele precisa controlar o proxy/portas web que já pertencem à Hubfy. Para seguir sem interromper a plataforma existente, escolha entre: (a) publicar Nexo usando a infraestrutura/proxy atual depois de entender como ela é administrada; ou (b) usar outra VPS para Coolify. Migrar a Hubfy para Coolify exigiria planejar e validar a migração, volumes, DNS e janela de indisponibilidade.

## O que fica no VPS nesta primeira publicação

- Coolify para controlar deploys e HTTPS;
- interface React servida por Nginx;
- API Fastify/TypeScript;
- PostgreSQL em rede Docker privada e volume persistente.

Mercado Pago, Resend, Google Calendar/Drive, Evolution API ou WAHA e n8n entram por módulo. Mercado Pago, Resend e Google são serviços externos; WhatsApp e n8n podem exigir containers e variáveis próprios. Não instalar Evolution e WAHA juntos antes de escolher o provedor.

## DNS

No painel DNS do domínio, crie:

| Tipo | Nome | Destino |
| --- | --- | --- |
| A | `@` | IP público do VPS |
| CNAME | `www` | `focussdev.space` (opcional) |
| A | `painel` | IP público do VPS |

Espere os registros propagarem. No Coolify, use `https://painel.focussdev.space` como domínio do painel e `https://focussdev.space` para o app. O app e o backend usam o mesmo domínio; `/api` é encaminhado internamente para Fastify.

## Instalar Coolify em uma VPS livre com Ubuntu 24.04

Coolify lista Ubuntu 24.04 LTS como compatível. A documentação informa mínimo de 2 vCPU, 2 GB RAM e 10 GB livres para o painel; app, banco, imagens e backups precisam de espaço e memória adicionais. Confirme esses recursos no provedor antes de publicar. Use esta instalação somente em servidor livre ou após uma migração planejada; não sobreponha o proxy de aplicações existentes.

1. Configure no firewall do provedor `22/tcp` para SSH restrito ao seu IP, e `80/tcp` + `443/tcp` para web. Durante a instalação inicial, Coolify usa também `8000`, `6001` e `6002`; depois que o painel funcionar pelo domínio, feche esses três acessos públicos conforme a documentação. Não feche SSH durante a configuração.
2. Conecte-se por SSH ao VPS Ubuntu como `root` ou usuário com `sudo`.
3. Instale com o comando publicado pela documentação oficial do Coolify: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash`.
4. Abra o endereço temporário mostrado pelo instalador e crie imediatamente a conta administradora. O primeiro cadastro pode reivindicar a instância.
5. No painel, configure o domínio `https://painel.focussdev.space`, aguarde o certificado TLS e só então remova o acesso direto às portas 8000/6001/6002.
6. Faça backup seguro do arquivo `/data/coolify/source/.env`; ele contém chaves necessárias para recuperar o painel.

## Publicar este repositório

1. Envie o projeto para um repositório Git privado e conecte esse repositório ao Coolify. A VPS deve compilar a aplicação a partir do `compose.yaml` na raiz.
2. Crie um recurso **Docker Compose** com o arquivo `compose.yaml`.
3. Configure as variáveis do recurso:
   - `POSTGRES_PASSWORD`: saída de `openssl rand -hex 32`;
   - `JWT_SECRET`: outro valor de `openssl rand -hex 32`;
   - `BOOTSTRAP_TOKEN`: gere um terceiro token com `openssl rand -hex 32`;
   - `APP_ORIGIN`: `https://focussdev.space`.
4. Atribua o domínio `https://focussdev.space` ao serviço `web`, porta interna `80`. Não publique portas do Postgres nem da API.
5. Faça o deploy. A API aplica as migrações Drizzle ao iniciar; o volume `nexo_postgres` mantém os dados entre atualizações do container.
6. Confirme `https://focussdev.space/api/health` e `https://focussdev.space`.
7. A primeira conta é criada por `POST /api/auth/register`, enviando `x-bootstrap-token: <BOOTSTRAP_TOKEN>`. O cadastro só funciona enquanto ainda não existir usuário; o token nunca deve ser colocado no front-end.

## Estado atual e próximo trabalho

A API já tem organização/usuários, autenticação e CRUD de clientes com escopo por organização. A interface ainda não está conectada às rotas e não existe tela de login/onboarding; portanto, esse deploy publica a UI atual e a API, mas os dados da UI continuam locais até a integração do CRM.

Não há neste computador acesso ao DNS, credenciais SSH nem Docker, e o projeto ainda não tem um remoto Git configurado. Por isso os arquivos de deploy ficam preparados aqui; a instalação do painel e o deploy na VPS dependem desses acessos.
