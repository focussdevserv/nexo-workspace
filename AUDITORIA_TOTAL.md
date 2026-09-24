# Auditoria total do Nexo Workspace

**Data:** 24/09/2026  
**Escopo:** navegação, telas, persistência, API, integrações, fluxos entre módulos, dados relacionais, responsividade e pontos de experiência do usuário.  
**Método:** leitura do frontend e da API, buscas por ações simuladas/estado local, build de produção do frontend e compilação TypeScript da API. Health check do ambiente publicado. Não criei registros artificiais nem disparei mensagens, pagamentos ou convites reais.

## Resultado executivo

O Nexo já tem uma base real: login restrito ao proprietário, API com banco PostgreSQL, CRUD genérico para registros do workspace, notificações persistidas, cobrança e assinatura pelo Mercado Pago, sessão/QR de WhatsApp pelo WAHA, OAuth seguro do Google, portal do cliente com link assinado e deploy pelo Coolify.

Ainda nao e correto classificar todas as integracoes como operacionais. A caixa de entrada tem envio de texto pela WAHA e webhook de recebimento implementados, mas ainda precisam de validacao com sessao autenticada conectada em producao; automacoes n8n continuam sem criacao/ativacao de workflows pelo Nexo; arquivos nao tem upload real; assinatura eletronica nao tem provedor. O Calendar agora tem operacoes para criar, atualizar e excluir eventos, convidar e-mails informados e solicitar link do Meet, mas o fluxo OAuth real ainda precisa de teste autenticado em uma conta conectada.

**Validacao:** builds do frontend e da API passaram; `git diff --check` passou; as rotas do workspace foram validadas no navegador. Nesta revisao, `/api/health` confirmou o PostgreSQL conectado, a pagina inicial e o bundle atualizado responderam HTTP 200, os health checks de `https://n8n.pagfocuss.tech` responderam HTTP 200 e o teste do Resend confirmou 1 dominio sem enviar e-mail. O rótulo corrigido ?Ultimo teste:? foi conferido na tela de Integracoes em producao apos o deploy do commit `33f9f47`.

## O que já funciona de verdade

- Autenticação de proprietário pela API, sessão em cookie HTTP-only e cadastro público desativado.
- Persistência PostgreSQL para clientes, leads, propostas, contratos, projetos, tarefas, eventos, tickets, notificações, arquivos como metadados e outros registros do workspace.
- Criação de cobrança Pix/boleto/cartão e assinatura recorrente via Mercado Pago pela área financeira. Assinaturas dependem da autorização do cliente no checkout do Mercado Pago.
- Conexão e controle de sessões WAHA, incluindo QR Code, pausa, retomada, logout e exclusão.
- OAuth Google com tokens cifrados no banco, refresh token e revogação; o teste verifica autorização/identidade.
- Portal público com token assinado e versão revogável.
- Tela de integrações mostra configurações e testes informados pelo servidor; a apresentação visual foi reorganizada nesta entrega.
- Ficha do cliente agrega dados comerciais, projetos, tarefas, cobranças, contratos, conversas e arquivos registrados. A criação de projeto pela ficha agora grava no backend e inclui `clientId`.
- Corrigido filtro de tarefas do Meu Dia: reconhece `A fazer` como pendente e estados concluídos com ou sem acento.
- Propostas e contratos novos vinculam `clientId` quando o nome corresponde a um cliente cadastrado; a conversão de proposta aceita propaga o vínculo aos projetos e tarefas gerados.

## Bloqueios funcionais por prioridade

### P0 — necessário para afirmar “integração funcionando”

1. **WhatsApp na Caixa de entrada:** envio de texto e webhook de recebimento/status pela WAHA foram implementados, com persistencia, verificacao da sessao e deduplicacao. O numero de producao ainda aguarda leitura do QR; envio e recebimento reais ainda nao foram validados. Envio de midia permanece indisponivel; Evolution API nao foi configurada.
2. **Automações n8n:** a área atual salva fluxos como `Rascunho`; não cria/ativa workflows no n8n, não executa testes e não mostra histórico real de execução. O health check do n8n não constitui integração de automação.
3. **Arquivos:** a tela de arquivos aceita o seletor, mas informa que não faz upload. Falta upload seguro ao Google Drive (ou storage próprio), metadados e link de download, associação por cliente/projeto e envio real como anexo pelo canal.
4. **Operacoes Google:** OAuth e escopos existem. Calendar agora cria/atualiza/exclui eventos, envia convites para e-mails explicitamente informados e pode pedir conferencia Meet. A conta OAuth e o ciclo real ainda precisam ser validados com sessao proprietaria; Gmail e Drive ainda nao possuem operacoes no produto.
5. **Resend:** credencial detectada e teste de API aprovado nesta revisao (1 dominio). O produto ainda nao envia propostas, contratos, cobrancas ou notificacoes por e-mail, nem registra entrega/rejeicao.
6. **Assinatura eletrônica:** contrato pode ser gerado/baixado em HTML, mas não há provedor de assinatura integrado, envio de envelope, callback ou documento assinado verificável.

### P1 — integridade dos fluxos e dados

1. **Vínculos cliente → pagamentos (resolvido no código):** desde o commit `6772be5`, cobranças e assinaturas carregam clientes do workspace, permitem selecionar o cadastro e enviam `clientId` no POST; a API valida que o cliente pertence à organização e o portal consulta por esse ID. Falta validar a exibição ponta a ponta com uma cobrança controlada.
2. **Vínculos em registros antigos:** o portal busca projetos/tarefas/contratos/aprovações por `clientId`. Registros legados com apenas nome não aparecem. Foi corrigida a criação nova pela ficha e por conversão de proposta, mas contratos/tarefas criados por outros caminhos ainda precisam de seleção de cliente consistente.
3. **Ficha do cliente usa correspondência parcial por nome** em vários relacionamentos. Isso pode misturar empresas com nomes parecidos ou falhar com abreviações. A regra-alvo deve ser `clientId`; nome apenas como compatibilidade temporária.
4. **Eventos e reunioes:** eventos sincronizam com Google Calendar; convidados e link Meet sao opcionais. A agenda conserva o registro no workspace se o Google nao estiver autorizado e indica o estado. Ainda falta verificar em producao a conta OAuth, a propagacao de alteracoes e respostas dos participantes.
5. **Ativos e monitoramento:** sites/domínios/hospedagens são cadastro manual; uptime, SSL, vencimento real e alerta não são consultados. A tela não deve exibir “online” sem um check real.
6. **GitHub:** cadastro manual de repositório e teste de token existem; commits, PRs, deploys e status de workflow não são sincronizados. A área ainda contém indicação de deploy simulado.
7. **Mercado Pago:** cobrancas e recorrencias usam o caminho real e o formulario ja envia `clientId` quando um cliente cadastrado e selecionado. Restam reconciliar estados pendentes/expirados e comprovar notificacoes de webhook em producao.

### P2 — acabamento, previsibilidade e acessibilidade

1. **Rotas do app (validado em produção):** cada módulo tem URL `/app/<módulo>`. Testei abertura direta de Automações, navegação que atualiza a URL para Integrações, Voltar e recarga mantendo o módulo. O portal público `/portal/<slug>` permanece fora do roteador privado.
2. **Texto corrompido:** o rotulo ?Ultimo teste? na tela de Integracoes foi corrigido nesta entrega. Ainda precisa varredura dos demais modulos para caracteres de substituicao e textos com `?`.
3. **Ações de aparência funcional:** “Mais filtros” na toolbar não abre filtro; alguns botões de relatório apenas exibem toast; menus de linha recorrem a mensagens genéricas em vez de abrir edição contextual.
4. **Hierarquia visual:** há diferenças de escala, espaçamento, estados de foco e tamanho de texto entre módulos. Alguns rótulos e informações secundárias usam fonte muito pequena e contraste fraco; a ficha do cliente reúne oito abas num modal grande e precisa de prioridade/estrutura mais clara em telas menores.
5. **Ações de módulo:** várias telas têm estado vazio honesto, mas ainda oferecem botões que só navegam para outra área em vez de iniciar o fluxo com cliente já selecionado. A ficha deve abrir proposta, cobrança e ticket com o cliente preenchido.
6. **Financeiro operacional:** contas e lançamentos de receita/despesa são controles manuais, sem conciliação bancária ou extrato. Precisam ser nomeados como lançamentos manuais e não como contas conectadas.

## Melhorias de designer recomendadas

- Usar um sistema compartilhado de título, resumo, ações primárias, estados de carregamento/erro/vazio e cards entre módulos.
- Aumentar corpo de texto e rótulos críticos, manter contraste AA, área de clique adequada e foco de teclado visível.
- Tornar filtros de toolbar acionáveis ou remover o controle; botões só devem aparecer quando executam uma ação definida.
- Trocar o perfil modal por uma ficha responsiva com cabeçalho fixo, resumo de relacionamento e navegação lateral em desktop; em telas estreitas, abas compactas com rolagem e ações fixas.
- Criar formulários contextuais que recebam `clientId`, `projectId` e valores existentes ao abrir a partir da ficha.
- Separar o estado de integração em: credenciais detectadas, autorização OAuth, último teste e recursos efetivamente habilitados. Não usar apenas “Conectada” como sinônimo dos quatro estados.
- Substituir “deploy simulado”, “visualização demonstrativa” e botões de toast por estado vazio explícito ou operação real.

## Sequência sugerida para concluir

1. Padronizar seleção e propagação de `clientId` em cobrança, proposta, contrato, tarefa, projeto, aprovação e evento; revisar a projeção do portal.
2. Implementar upload e armazenamento de arquivos com associação cliente/projeto; só então habilitar “Enviar arquivo” na ficha e no chat.
3. Validar envio e recebimento WAHA apos parear o numero; concluir envio de midia e confirmar estados de entrega/leitura com uma conversa controlada.
4. Ligar fluxos de e-mail e calendário aos provedores configurados e apresentar falhas/entregas.
5. Criar workflows n8n importáveis com ativação, credenciais via ambiente, execuções e logs reais.
6. Integrar assinatura eletrônica e callbacks; gerar PDF/artefato assinado e registrar evidência no contrato.
7. Ligar monitoramento de sites e sincronização GitHub; remover indicadores que não tenham dados reais.
8. Corrigir rotas/histórico, varrer controles sem ação, corrigir textos e executar validação visual desktop/mobile e dos fluxos principais com conta autorizada.

## Limites desta auditoria

Esta revisão combinou inspeção estática, compilação e health check. Não executei pagamento, envio de mensagem/e-mail, convite Google, upload, assinatura ou cadastro de dados de validação em produção. Os provedores precisam ser validados com credenciais ativas e eventos reais controlados antes de qualquer promessa de funcionamento ponta a ponta.

## Revisao de seguranca e disponibilidade - 24/09/2026

- Build do frontend (`npm run build`) e compilacao TypeScript da API (`npm run api:build`) passaram nesta revisao.
- O health da API respondeu HTTP 200 com banco conectado; workspace, privacidade, termos e health de n8n responderam HTTP 200. Isso confirma disponibilidade, nao a execucao de fluxos n8n nem integracoes de negocio.
- Identificado bypass na validacao do endpoint generico `/api/workspace/:resource`: nomes de campos de credencial eram bloqueados somente no primeiro nivel, permitindo que um campo `accessToken` ou `apiKey` fosse guardado dentro de objeto/array aninhado. O limite de tamanho tambem usava uma serializacao recursiva sem limite de profundidade.
- Corrigido com validação recursiva, bloqueio de chaves de credencial e chaves sensiveis a prototype pollution em qualquer profundidade, maximo de 32 niveis/5.000 nos e limite de 64.000 bytes. A assinatura HTTP/JSON e as rotas existentes foram preservadas.
- Cinco testes unitarios isolados cobrem registros normais, chaves secretas aninhadas, prototype pollution, profundidade/tamanho e valores nao objeto. `npm --prefix api test` passou (5/5). Nenhum teste escreveu no PostgreSQL compartilhado.
- Proximos riscos que permanecem: integracoes sem prova de fluxo real, automacoes n8n nao gerenciadas pelo produto, uploads/assinatura eletronica ausentes e a revisao completa dos controles no frontend.

## Auditoria funcional de equipe e segurança - 24/09/2026

- A tela autenticada de Integracoes respondeu com dados do backend: Mercado Pago, WAHA e Resend constam como testadas/conectadas; Evolution, Google Workspace, GitHub, n8n e Sentry nao estao configuradas. O indicador geral mostrou zero falhas nos ultimos testes.
- Identificado que Equipe permitia cadastrar "convites" e alternar supostos acessos sem criar contas ou enviar e-mails; Configuracoes mostrava tres membros ficticios e oferecia controles de papel, 2FA e validade da sessao que nao alteravam a autenticacao.
- Corrigido: Equipe agora e explicitamente um cadastro operacional para distribuir trabalho, nao concede login, nao promete envio de convite e mostra situacoes do cadastro. Criar/editar/ativar/remover aguarda o resultado real da API antes de confirmar sucesso.
- Corrigido: Configuracoes descreve o acesso de proprietario unico que o servidor aplica, informa a expiracao real de 8 horas e declara que 2FA nao esta disponivel; removeu contagens inventadas e preferencias de seguranca sem efeito. Exportacao/importacao e armazenamento agora descrevem corretamente que apenas preferencias sao exportadas e que sao persistidas no banco.
- Build do frontend, compilacao da API, cinco testes unitarios e `git diff --check` passaram. O commit `cd628ad` foi implantado; `/api/health` respondeu HTTP 200 com banco conectado e o navegador autenticado confirmou as telas novas de Equipe e Configuracoes, com zero pessoas operacionais cadastradas e um acesso de proprietario.

## Implementacao registrada - Google Calendar - 24/09/2026

- Commit `4610773`: endpoints autenticados do Calendar para criar, atualizar com idempotência por event ID e excluir eventos; os tokens Google são obtidos pelo mecanismo OAuth cifrado existente.
- A agenda oferece sincronização com Google Calendar, campo de convidados e opção de link Meet. Edições e exclusões de eventos sincronizados propagam para o Calendar.
- A criação local continua disponível quando a conta Google não está autorizada; o evento fica marcado como não sincronizado e a interface explica como conectar.
- Os builds e o health check do app/API passaram. O OAuth e o ciclo real de evento ainda precisam de teste com a conta autorizada.

## Implementacao registrada - WhatsApp WAHA - 24/09/2026

- A Caixa de entrada consulta sessões WAHA ativas, permite escolher uma sessão e cria conversas com telefone normalizado; novos registros são salvos antes de serem selecionados.
- Envio de texto usa endpoint autenticado, limite de requisições, verifica propriedade da sessão e conversa, aplica idempotência e persiste estado. O webhook valida segredo em tempo constante, registra mensagens recebidas, atualiza confirmações e evita duplicidade.
- O Compose configura os eventos `message` e `message.ack` com cabeçalho secreto. A sessão de produção estava como FAILED; a correção publicada permitiu reiniciá-la e gerar o QR no app. Ela aguarda leitura; envio/recebimento real ainda não foi testado.
- `npm run build`, `npm --prefix api run build` e `git diff --check` passaram. Coolify publicou os commits `3a3c2b4` e `462be4e`; o app/API voltaram a responder com banco conectado e o n8n readiness respondeu HTTP 200.

## Atualização de implementação ? navegação e auditoria financeira ? 24/09/2026

- Cobranças e assinaturas enviam `clientId` quando o operador seleciona um cliente existente; a API valida o vínculo dentro da organização. Falta provar a exibição no portal com uma cobrança controlada.
- O frontend usa URLs estáveis `/app/<módulo>`, abertura direta, sincronização com Voltar/Avançar e restauração após recarga. A rota pública `/portal/<slug>` segue separada.
- Build passou. No Chrome autenticado, abri `/app/automacoes` diretamente, naveguei para Integrações, usei Voltar e recarreguei; o endereço e o módulo permaneceram corretos. Coolify marcou o commit `6db738b` como sucesso; API e banco responderam saudáveis.


## Atualizacao de auditoria - Resend e texto da tela - 24/09/2026

- A credencial Resend foi aplicada ao servico API pelo Coolify e o teste de producao consultou a API de dominios sem enviar mensagens; resposta: 1 dominio disponivel. Resend aparece habilitado e conectado no ultimo teste.
- Ainda nao ha operacao de envio de e-mail dentro dos fluxos de propostas, contratos, cobrancas ou notificacoes. A credencial valida nao habilita esses fluxos.
- Corrigido em `src/screens/ServiceScreens.jsx` o rotulo corrompido do ultimo teste; build e deploy passaram e a tela foi conferida em producao apos o commit `33f9f47`.

## Auditoria complementar - catalogo e n8n

- O catalogo informado pelo proprietario ja esta persistido no workspace: a tela de Servicos mostra 88 itens. Os precos e prazos estao em branco para evitar valores inventados; a proposta aceita importa checklist/modelo de tarefa do servico selecionado.
- O estado anterior do n8n era impreciso: health check da instancia nao prova que a API esta autenticada. A integracao foi alterada para exigir `N8N_API_KEY` e validar `GET /api/v1/workflows?limit=1` com o cabecalho de API key, sem executar fluxos.
- `N8N_API_KEY` foi adicionado ao Compose, ao exemplo de ambiente e ao guia visual. Sem essa chave, n8n deve aparecer como nao configurado, mesmo que `/healthz` esteja saudavel.
- A tela `https://n8n.pagfocuss.tech` mostra no Chrome um aviso de site perigoso. Nao foi enviada senha nem API key para essa origem. O acesso administrativo precisa ser feito em um hostname seguro antes de gerar e aplicar uma API key; ate entao, criar workflows e validar execucoes reais permanece bloqueado por seguranca.
- O projeto OAuth `Nexo Workspace` foi iniciado no Google Auth Platform em modo externo, pois a conta Cloud nao pertence a uma organizacao Google Workspace. Ainda nao existe cliente OAuth nem teste de autorizacao. O Google exige publicacao e verificacao dos escopos sensiveis para uso continuo; as paginas publicas `/privacy` e `/terms` foram adicionadas para preparar a configuracao, mas ainda precisam de dominio verificado e publicacao.

## Envio de propostas por Resend - 24/09/2026

- Implementado envio autenticado da proposta para um destinatario escolhido. O e-mail inclui cliente, investimento, servico, escopo, prazo e condicoes de pagamento; o HTML e escapado no servidor.
- Cada tentativa usa uma chave idempotente no Resend. A proposta registra destinatario, estado, identificador do provedor e horario confirmado. O estado so muda para Enviada depois da confirmacao do Resend.
- Coolify recebeu `RESEND_FROM_EMAIL` como variavel de runtime. O remetente usa o dominio verificado `focussdev.space`.
- O teste autenticado em producao retornou HTTP 200: 1/1 dominio verificado e remetente configurado. O teste consulta dominios e nao envia mensagens.
- Commit `366600e` publicado e deploy Coolify confirmado. Frontend e API compilaram; os 8 testes unitarios passaram sem criar registros de teste no banco.
- Nenhum e-mail real foi enviado. Ainda falta validar recebimento e resposta com uma proposta e destinatario autorizados. Contratos, cobrancas e notificacoes ainda nao enviam e-mail.

## Continuação da auditoria operacional — 24/09/2026

- Revalidação local: `npm run build`, `npm --prefix api run build`, `npm --prefix api test` (8/8) e `git diff --check` passaram. Revalidação pública: `https://focussdev.space/api/health` e `https://n8n.pagfocuss.tech/healthz` retornaram HTTP 200. Health 200 confirma disponibilidade do endpoint, não autenticação nem execução de workflows.
- DNS: `focussdev.space` e `n8n.pagfocuss.tech` resolvem para `2.25.239.145`; `n8n.focussdev.space` ainda não resolve. O painel Hostinger aberto pertence a uma conta que só mostra `pagfocuss.tech`, embora o domínio `focussdev.space` esteja registrado na Hostinger. Não foi possível editar a zona DNS nesta conta.
- O navegador mostra intersticial de segurança ao abrir `n8n.pagfocuss.tech`. Não inserir senha ou chave API nessa origem até remover o bloqueio e confirmar o hostname seguro.
- Google Auth Platform: o projeto `Nexo Workspace` está External/Testing, com `emprisefocussdev@gmail.com` incluído como usuário de teste. A marca ainda acusa domínio autorizado ausente para `focussdev.space`. Não há cliente OAuth web ativo; sem DNS/validação de domínio e uma forma segura de guardar o segredo diretamente no serviço API, o OAuth não foi habilitado no Coolify. URI de callback planejada: `https://focussdev.space/api/integrations/google/callback`.
- Prioridades operacionais mantidas: (1) acessar a conta/zona DNS correta, publicar e verificar `focussdev.space` e criar hostname seguro para n8n; (2) gerar a chave API do n8n na origem validada e salvá-la somente no Coolify; (3) concluir cliente OAuth Google e armazenar credenciais somente no Coolify; (4) testar QR/pareamento WAHA e mensagens reais controladas; (5) implementar CRUD/ativação/execução/logs de workflows n8n; (6) continuar testes E2E sem registros artificiais para financeiro, documentos, arquivos, Gmail e portal.
- A pasta `output/` já estava não rastreada antes desta revisão e foi preservada.

## N8N EVENT AUTOMATION UPDATE - 2026-09-24

- The app now creates authenticated n8n workflows for lead-created, proposal-accepted, payment-confirmed, project-published, and ticket-created events. The server provisions the bridge credential; its secret is not returned to the browser. Generated workflows disable successful, failed, and manual execution data persistence.
- Backend events call published n8n webhooks. The callback verifies the bridge signature in constant time, validates the linked automation and event, and creates a workspace task. Webhook responses wait for the final action node.
- The overdue-payment model remains a local draft. It is deliberately excluded from remote workflow creation because no scheduled `payment.overdue` event emitter exists yet.
- Frontend/API builds, `git diff --check`, and 11 API tests passed. Remote workflow creation and execution remain unverified until a safe n8n hostname and `N8N_API_KEY` are configured in Coolify.

## SUPPORT TICKETS PERSISTENCE UPDATE - 2026-09-24

- Replaced the browser-only ticket list with the authenticated workspace-record API. Creating a ticket now persists it to PostgreSQL; status, priority, owner, and details edits use PATCH. Loading and API errors are visible with a retry action.
- Ticket creation now reaches the backend ticket event hook, so a published compatible n8n workflow can receive it. No sample ticket or customer record was created.
- Frontend/API builds and the existing 11 API tests passed. The change still needs production deploy verification.

## PRODUCTION VERIFICATION - SUPPORT TICKETS - 2026-09-24

- Coolify marked commit `fe46c51` as Success; the deployment log confirmed PostgreSQL and API healthy, then the web container started.
- `https://focussdev.space/` returned HTTP 200 with the new frontend bundle. The bundle includes the ticket save confirmation from the database-backed flow. `/api/health` returned HTTP 200 and `database: connected`.
- No ticket was created as a test. End-to-end create/edit still needs a deliberate real ticket in normal business use.

## Revalidacao de producao — 24/09/2026

- `https://focussdev.space/api/health` respondeu HTTP 200 com `database: connected`; `https://flow.pagfocuss.tech/healthz` respondeu HTTP 200.
- A API autenticou no n8n com `GET /api/v1/workflows?limit=1`; o teste do app confirmou a chave e retornou zero workflows. A chave no container foi verificada sem revelar o valor: 268 bytes incluindo quebra de linha. Não há automações remotas ativas ainda.
- O deploy do commit `882fced` publicou a correção de diagnóstico 401/403. O fluxo de criação remota de workflow ainda não foi comprovado; a tela continua listando um modelo local e nenhum workflow remoto.
- A aba aberta manteve o bundle antigo até recarga forçada; o HTML servido não tinha política explícita de cache. Foi adicionada política `no-cache` para `index.html` e cache imutável para assets com hash; aguardando publicação e validação no domínio.
- Validação local: `npm run build`, `npm --prefix api test` (12/12), `npm --prefix api run build` e `git diff --check` passaram. O Vite mantém aviso de chunk JavaScript acima de 500 kB.
- Limite desta etapa: não enviei mensagens, e-mails nem pagamentos. Não criei registros adicionais de clientes/projetos. `output/` permaneceu intacto.

## Auditoria em andamento — criação de workflows n8n — 24/09/2026

- A tentativa real no painel de Automações retornou HTTP 400. O backend antes ocultava a resposta de validação do n8n; agora expõe somente a mensagem segura do provedor, truncada e sem corpo/payload. O commit `cb77075` foi publicado.
- O diagnóstico confirmou `request/body/meta is read-only`. Removi o campo `meta` somente leitura do objeto enviado à API n8n e cobri isso em teste (`44ff512`).
- O deploy temporariamente deixou o domínio sem servidor por cerca de um minuto; app/API voltaram a HTTP 200 com banco conectado. O n8n permaneceu saudável.
- A interface ainda apresenta zero workflows; é necessário confirmar que o commit `44ff512` está ativo e repetir a criação. Nenhum workflow foi confirmado, publicado ou executado ainda.
- A etapa de release depende do deploy automático do Coolify; o painel na VPS abre na tela de login e não há sessão autenticada disponível nesta janela. Nenhuma credencial de login foi reutilizada de outro serviço.

## Revalidação funcional e UX — 24/09/2026

- A causa da criação remota foi corrigida: a API n8n rejeitava o campo somente leitura `meta`. O commit `44ff512` entrou em produção. Criar e publicar foram confirmados pela UI e API.
- Foram criados e publicados cinco workflows reais: novo lead, proposta aprovada, pagamento confirmado, projeto publicado e novo ticket. O n8n mostra 5/5 publicados e zero execuções; nenhum lead, ticket, projeto, pagamento, cliente ou tarefa de teste foi criado.
- O lembrete de cobrança vencida continua sendo apenas um modelo local: o backend ainda não tem rotina agendada que emita `payment.overdue`.
- O app e PostgreSQL voltaram a responder HTTP 200 depois do deploy; `flow.pagfocuss.tech/healthz` também respondeu 200.
- Integrações na última leitura de produção: 4 configuradas e confirmadas (Mercado Pago, WAHA, Resend, n8n); Evolution, Google Workspace, GitHub e Sentry não configuradas. Mercado Pago enumerou 12 meios de pagamento; esse teste não criou cobrança. Resend confirmou 1/1 domínio e remetente, sem enviar e-mail.
- WAHA: há uma sessão cadastrada, mas o estado é `FAILED` e 0 sessões conectadas. O app não exibia o QR porque o backend tratava a resposta binária de imagem da WAHA como JSON. Corrigido no código para transportar bytes como Base64 sem cache; deploy e leitura final do estado ainda pendentes.
- Limitações funcionais confirmadas no código: OAuth Google ausente; arquivos não são enviados ao Drive (a interface informa isso); contratos são documentos base baixáveis sem assinatura eletrônica; sites/domínios são cadastro, sem monitoramento automático de uptime/SSL; GitHub e Sentry não configurados; não foi feito ciclo financeiro com pagamento de produção.
- Revisão de interface: os módulos têm estados vazios e navegação por URL; permanecem cópias antigas e não roteadas de cobrança/assinaturas que usam `localStorage`, além de controles de paginação/exportação sem implementação completa em algumas tabelas. Revisar acessibilidade e responsividade em todos os módulos continua pendente.
- A revisão aplica as regras atuais de interface para foco, navegação, rótulos, estados assíncronos, formulários e responsividade: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

## Correção do fluxo QR WAHA — 24/09/2026

- A rota oficial de QR serve bytes de imagem; o backend usava um parser JSON e devolvia `data: null`. A rota agora lê `arrayBuffer`, permite somente `image/*`, converte em Base64 para o app e define `Cache-Control: no-store`, pois o QR é uma credencial de sessão.
- `npm --prefix api test` passou com 13/13; `npm --prefix api run build`, `npm run build` e `git diff --check` passaram. O Vite ainda avisa que o bundle JavaScript tem 502.84 kB.
- A sessão WAHA já existente reporta `FAILED`; o deploy precisa confirmar se o endpoint consegue gerar um QR com o estado atual. O pareamento e qualquer envio/recebimento ainda dependem do usuário ler o QR e de validar uma conversa autorizada.

## Update de verificacao - 24/09/2026

- Publicados os commits `8e0eeba` (imagem binaria do QR sem cache) e `e0af695` (erro seguro e acionavel para falhas do endpoint WAHA).
- Confirmado em producao: `https://focussdev.space/api/health` retornou status ok e banco conectado; apos recarregar o app, a imagem QR da sessao WAHA apareceu na tela.
- A sessao ainda aguarda leitura pelo WhatsApp do usuario. Nao houve pareamento, envio ou recebimento de mensagem nesta validacao.
- Validacao local: 13/13 testes da API, build TypeScript e build Vite passaram antes das duas publicacoes. O bundle Vite segue acima do limite recomendado por 2.84 kB.
## Ciclo de QR expirado - 24/09/2026

- A revalidacao posterior mostrou HTTP 422 da WAHA: o desafio de pareamento nao estava mais pendente. A documentacao oficial define esse retorno como estado sem QR ativo (inclui codigo expirado).
- Corrigi o app para consultar o QR apenas quando o status da sessao e SCAN_QR_CODE, tratar 422 como ausencia normal de desafio, e reiniciar sessao FAILED com a acao restart. A tela informa quando precisa gerar um novo QR.
- Testes da classificacao de resposta WAHA cobrem 204, 404, 422, imagem, respostas nao-imagem e erros HTTP.
## Catalogo e projetos por template - 24/09/2026

- A importacao do catalogo agora descarta nomes repetidos tanto no workspace quanto dentro da lista informada, sem cadastrar precos ficticios.
- A criacao de projeto pelo template de servico agora exige cliente cadastrado e persiste projeto e tarefas relacionadas no workspace; antes apenas mostrava uma confirmacao sem gravar os registros.
- Ao escolher um servico numa proposta, o formulario preenche escopo, prazo e ciclo mensal quando definidos no catalogo, e preserva o valor digitado quando o servico ainda nao tem preco.
- Cobertura adicionada para deduplicacao, criacao do projeto/tarefas e exigencia de cliente existente.