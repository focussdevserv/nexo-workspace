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
## Proposta e variantes do catalogo - 24/09/2026

- Inspecao de producao encontrou 88 servicos ja cadastrados. Quatro nomes repetidos existem porque o catalogo original apresenta o mesmo nome em grupos distintos; mantive essas variantes e alterei a chave de importacao para grupo + nome.
- A selecao de servico em proposta agora guarda e resolve o ID do registro, evitando escolher o template errado para variantes com o mesmo nome.
- Foram repetidos os 18 testes da API e builds; todos passaram. Bundle Vite em 504.99 kB.

## Interface de integrações — reauditoria em produção — 24/09/2026

- Corrigido o diálogo do Google Workspace: agora distingue credenciais OAuth ausentes, credenciais configuradas e conta Google autorizada. Antes qualquer objeto de status era interpretado como credencial detectada, mesmo quando o servidor reportava a integração como não configurada.
- Reorganizado o aviso de autorização, URI de retorno e botão para leitura em coluna. A conferência visual desktop/celular mostrou que o conteúdo não comprime mais esses controles lado a lado.
- Google continua indisponível até adicionar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no serviço API do Coolify; o app informa isso e mantém autorização desabilitada.
- Testes da API: 18/18; build Vite passou. Na validação móvel, viewport de 390 px sem overflow horizontal; console do navegador sem erros. Após o deploy, o domínio e `/api/health` voltaram a HTTP 200 com banco conectado.

## Sites e arquivos — continuidade da auditoria — 24/09/2026

- Cadastros de sites/domínios/hospedagens usam os registros autenticados do workspace, mostram carregamento/erro e vinculam novos ativos a um cliente existente por `clientId`. Status inicial passa a ser `Não verificado`; DNS, renovação automática e uptime só são apresentados quando há dados.
- Métricas de renovação agora usam datas cadastradas (incluindo formatos anteriores aceitos) e respeitam o filtro da tela. Remoção usa o endpoint real do workspace.
- A página Arquivos deixou de afirmar um consumo fixo de 18,6 GB/100 GB e agora informa que o armazenamento Google Drive não está conectado.
- Build Vite, 18 testes da API e `git diff --check` passaram. A criação de registro em produção não foi simulada; a persistência precisa ser validada na operação normal com um cliente real cadastrado.

## Contratos — integridade de status — 24/09/2026

- A interface e a API agora impedem definir manualmente `Aguardando assinatura`, `Assinado` ou `Ativo`. Esses estados exigem confirmação externa; registros preexistentes nesses estados continuam visíveis, mas não podem receber uma nova transição manual.
- O documento é identificado como rascunho/modelo HTML para revisão e informa que o download não registra assinatura. Campos comerciais e de identificação ainda precisam ser revisados antes de uso externo; não há provedor de assinatura configurado.
- A criação manual do rascunho agora exige cliente cadastrado, valor válido, escopo e prazo; pode preencher escopo/prazo/valor com o serviço selecionado no catálogo e grava o texto-base no contrato.
- Adicionados testes da política de estados e da renderização do modelo. API: 21/21 testes; build da API e do frontend passaram. Sem contrato de teste ou assinatura fictícia em produção.

## Auditoria total em andamento - Meu Dia e Repositórios - 24/09/2026

- Recarreguei o app autenticado em produção. `/api/health` respondeu HTTP 200 com PostgreSQL conectado; n8n `/healthz` respondeu HTTP 200. Os sete pedidos do Meu Dia (usuário, leads, projetos, tarefas, agenda, propostas, cobranças e notificações) responderam HTTP 200 após nova navegação, sem erros novos no console. O histórico antigo do navegador continha respostas 5xx de WAHA/notificações durante deploys anteriores; não reproduzi essas falhas nesta leitura.
- Produção tem zero cobranças cadastradas. Não criei cobrança, mensagem nem registro fictício para testar.
- Corrigido o Meu Dia: contagem passa a considerar apenas tarefas abertas com prazo hoje; filtro, estilo concluído e alternância reconhecem estados em português com/sem acento e estados em inglês (`completed`/`done`).
- Corrigida a tela de Repositórios: removida uma referência a `activeRepo` inexistente que lançaria erro ao renderizar um repositório salvo. A seção agora identifica claramente que commits/deploys não estão sincronizados e não exibe atividade demonstrativa.
- Validação local: `npm run build`, `npm run api:build`, `npm --prefix api test` (21/21) e `git diff --check` passaram. O bundle ainda excede o aviso Vite de 500 kB (507,69 kB); divisão de código segue como melhoria de desempenho.
- A auditoria é incremental e permanece aberta. Ainda faltam validação ponta a ponta dos módulos de CRM, projetos e cobrança com registros normais, OAuth e Calendar em conta autorizada, WAHA pareado, automações n8n executadas, e-mail entregue, arquivos, assinatura eletrônica, GitHub, Sentry, monitoramento externo, acessibilidade/responsividade por módulo e varredura dos controles de exportação/paginação.
- Publicação do commit `10179b9`: durante a troca de serviço, o app e n8n apresentaram 503 transitório; em nova checagem, app e n8n voltaram a HTTP 200, PostgreSQL conectado. O bundle servido em produção contém os textos/ajustes novos; `/app/repositorios` e sua consulta autenticada responderam 200 e o console ficou sem erros. A passagem automatizada por todas as rotas não foi concluída porque a sessão Playwright encerrou o transporte; segue pendente, sem evidência de falha funcional nas demais rotas nesta etapa.

## Automação de cobrança vencida - implementação pronta para deploy - 24/09/2026

- O evento `payment.overdue` agora tem modelo compatível no app/n8n e um scanner no backend que identifica cobranças `pending` cujo `dueAt` passou. O scanner registra uma linha única por cobrança em `billing_overdue_events`, revalida estado antes do envio, reserva trabalho com `FOR UPDATE SKIP LOCKED`, reaproveita o mesmo `eventId` e usa repetição exponencial até 1 hora quando o workflow não está ativo ou falha.
- A ação n8n cria tarefa interna de prioridade alta vinculada à cobrança/cliente. A descrição exige conferir o estado atual no Mercado Pago antes de emitir outra cobrança. Não envia WhatsApp/e-mail e não reaproveita links expirados.
- O modelo foi retirado da categoria de ação local e agora pode criar workflow remoto. Publicar o workflow habilita o evento no backend. Falhas de despacho n8n deixaram de rejeitar/derrubar a ação que as originou.
- A migração `0004_billing_overdue_events` cria somente o índice por status/vencimento e a tabela outbox; não recria tabelas financeiras existentes. Não apliquei migração ao banco compartilhado localmente (Docker indisponível).
- Testes isolados: 24/24; build TypeScript da API, build Vite e `git diff --check` passaram. Bundle Vite permanece em 507,87 kB. Falta deploy, criação/publicação do workflow remoto e verificação de execução com registro vencido real; produção atualmente não tem cobranças, portanto não existe evento real para execução sem inserir dados de teste.

## Workflow de cobrança vencida no n8n - publicado - 24/09/2026

- Migração `0004` e API foram implantadas; `/api/health` voltou a 200 com PostgreSQL conectado. Coolify registrou os serviços API como saudáveis e iniciou o novo web container. Houve 503 transitório durante a troca, seguido por recuperação.
- Adicionei o modelo "Revisar cobrança vencida" no workspace, criei o workflow remoto `Nexo · Revisar cobrança vencida` e publiquei pelo app. A tela consultou o estado ativo na API do n8n: 6 workflows publicados. Após recarregar, a ficha local também confirmou "Ativo no n8n".
- O histórico do n8n ainda mostra zero execuções. O workspace não possui cobranças, então não inseri cobrança vencida artificial nem forcei webhook. A primeira execução real fica pendente até existir uma cobrança real que ultrapasse `dueAt` sem confirmação de pagamento.
- Corrigi mais um estado visual: depois de publicar/despublicar, o cliente atualiza a lista local e a lista do n8n em conjunto. O texto dos modelos distingue os compatíveis com workflow remoto dos rascunhos personalizados. A UI antiga só atualizava o n8n e deixava a automação local como "Rascunho n8n" até recarregar a página.

## Revalidação OAuth Google no Coolify — 24/09/2026

- Criado no Google Cloud o cliente Web `Nexo Workspace - Web Production`, com origem `https://focussdev.space` e retorno `https://focussdev.space/api/integrations/google/callback`.
- Entradas `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` foram adicionadas ao ambiente do app no Coolify. A revisão da tela não confirmou que os valores foram aplicados ao processo da API: o Nexo ainda respondeu “credenciais ausentes” no diálogo Google Workspace após o redeploy.
- OAuth não foi autorizado e nenhum evento de Calendar foi criado. Gmail e Drive também não foram validados; a interface informa essas capacidades, mas o fluxo operacional ainda não foi demonstrado.
- Produção e n8n estavam HTTP 200 (`/api/health` com PostgreSQL conectado e `/healthz` ok) na checagem desta sessão.
- Próximo passo técnico: confirmar no serviço API do Coolify que as três variáveis estão disponíveis no container em produção, reiniciar o serviço e verificar `GET /api/integrations/status` antes de iniciar o consentimento Google. Não considerar esta integração concluída até o status OAuth trazer a conta conectada.
## Auditoria total e Google Workspace - 24/09/2026 (continuidade)

### Estado verificado
- A correcao OAuth em producao foi confirmada: `GOOGLE_REDIRECT_URI` aponta para `/api/integrations/google/callback`; a conta de teste `emprisefocussdev@gmail.com` autorizou a aplicacao e o teste de conexao respondeu que Google Workspace esta conectado. A conta OAuth segue no modo Testing do Google Cloud.
- Calendar ja cria, atualiza e remove eventos pelo endpoint autenticado; o formulario da agenda pode pedir conferencias Google Meet via `conferenceData`. Nao criei eventos reais durante esta auditoria.
- Gmail e Drive tinham escopos consentidos, mas ainda nao tinham chamadas operacionais no app. Esta fatia adiciona envio de propostas pelo Gmail como alternativa ao Resend e upload de arquivos ao Drive. Propostas continuam com Resend como opcao inicial.
- Upload exige sessao autenticada e Google ativo, valida nome/MIME/base64, limita o arquivo a 8 MiB, usa token OAuth do servidor, nao grava conteudo no banco, registra evento de auditoria e persiste no workspace somente id/link/metadados do Drive. A lista de Arquivos abre o link Drive para itens enviados por esta interface.
- O Gmail usa o HTML/texto renderizado da proposta existente, reserva o envio com chave de idempotencia no banco e grava provedor, destinatario, status e ID retornado. O envio requer acao explicita na ficha da proposta.
- Nao enviei e-mail nem subi arquivo a producao para evitar criar comunicacoes/arquivos artificiais. A confirmacao ponta a ponta de permissao, destinatario, entrega e link permanece pendente da primeira operacao real autorizada.

### Validacao local desta fatia
- API: 26/26 testes; build TypeScript passou.
- Frontend: build Vite passou; bundle principal 509,19 kB e ainda supera o aviso de 500 kB.
- `git diff --check` passou. Nao executei operacoes que escrevem dados no PostgreSQL compartilhado.

### Pendencias do produto e da producao
- Verificar deploy e `/api/health` depois desta publicacao; nao considerar as novas acoes Gmail/Drive testadas em producao ate um envio/upload real controlado.
- O teste de conexao Google comprova OAuth/UserInfo, nao cada permissao Workspace. A primeira chamada real pode revelar APIs/escopos que ainda precisam ser habilitados no Google Cloud.
- WAHA segue dependendo de ler o QR com o telefone e validar envio/recebimento; n8n tem seis workflows publicados, ainda sem execucoes porque nao existem registros financeiros reais elegiveis; Evolution, GitHub e Sentry precisam de decisao/configuracao antes de marcar como operacionais.
- Assinatura eletronica nao esta integrada; contratos atuais sao rascunhos HTML para revisao. Monitoramento de uptime/SSL, leitura/sincronizacao Gmail, listagem/arvore de pastas no Drive, vinculacao automatica de arquivos ao cliente/projeto, ciclo completo Mercado Pago, testes e2e de cada fluxo e revisao visual/acessibilidade de todos os modulos continuam no backlog.
- O segredo OAuth apareceu em saida de diagnostico anterior desta sessao. Nao o reproduzir; rotacionar o segredo no Google Cloud e atualiza-lo no Coolify como acao de seguranca pendente.
- Esta auditoria permanece aberta; somente capabilities com confirmacao observavel devem ser anunciadas como conectadas/funcionais.

### Pos-publicacao desta fatia - 24/09/2026
- Commits `a751630` e `df434aa` publicados na branch principal. O Coolify concluiu ambos com PostgreSQL e API saudaveis; `/api/health` retornou `database: connected`, o n8n `/healthz` retornou 200.
- O bundle servido em producao contem o seletor de provedor Gmail, a chamada `/api/integrations/google/drive/upload` e a linha de status Drive. Apos atualizar a aba autenticada, a pagina Arquivos mostrou `Google Drive conectado: emprisefocussdev@gmail.com`.
- Nao existe proposta real na conta para abrir o seletor e enviar uma mensagem sem criar teste; nao enviei e-mail nem arquivo. A validacao observada confirma deploy e UI, nao entrega Gmail nem upload efetivo.
- Risco para operacao diaria: Google Cloud permanece em Testing. A documentacao oficial informa que autorizacoes de test users expiram em 7 dias quando a app solicita escopos alem de nome/e-mail/perfil; portanto, pode ser necessario reautorizar semanalmente. Ver [Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en). Publicar em Production pode exigir verificacao de OAuth e revisao dos escopos.

## WhatsApp e notificações - fatia de auditoria - 24/09/2026

- Conferi a estrutura dos eventos com a documentação oficial WAHA: `message` traz timestamp Unix em segundos, e `message.ack` traz `id` e estado numérico. A conversão do timestamp no handler atual está correta. Referência: https://waha.devlike.pro/docs/how-to/events/.
- Lacuna corrigida: mensagens WhatsApp recebidas agora criam evento persistido `inbox/received`; o sino passa a incluí-las e abre `Caixa de entrada`. O polling do sino foi reduzido de 60 para 10 segundos. O handler mantém a deduplicação pelo ID do provedor antes de atualizar conversa e notificação.
- WAHA oferece eventos de mídia, mas o Nexo ainda só registra o nome/texto indicativo; download e armazenamento/visualização de anexos recebidos não estão implementados. O envio de anexos continua desabilitado na interface. Não anunciar mídia como funcional.
- A sessão WAHA em produção ainda requer leitura do QR no telefone. Não enviei mensagens nem inseri registros artificiais. Assim, webhook/recebimento, notificações WhatsApp em produção, entrega/leitura, e ciclo pareado permanecem sem validação ponta a ponta.
- Validação local desta fatia: testes API 26/26, build TypeScript da API, build Vite e `git diff --check` passaram. Vite ainda alerta bundle JS principal acima de 500 kB.
- Próximo passo: publicar e confirmar health check; após o usuário parear a sessão, validar uma mensagem recebida autorizada e seu aviso no sino. Em seguida continuar a auditoria módulo por módulo.

### Pós-deploy da fatia de notificações WhatsApp - 30/09/2026
- `4a36543` foi publicado na branch `main`. Durante a substituição houve 503 transitório no web container; a leitura posterior confirmou `https://focussdev.space/` HTTP 200, `https://focussdev.space/api/health` com banco conectado e `https://flow.pagfocuss.tech/healthz` ok.
- O HTML de produção referencia o bundle `index-CQK7ZXM5.js`; o próprio bundle servido contém a consulta das notificações com repetição de 10 segundos. O hash do bundle difere do build local por variações do build do container; confirmei o comportamento no conteúdo servido, sem depender do nome do arquivo.
- Esta checagem comprova disponibilidade e publicação do frontend, mas não inspeciona diretamente o código executado no container API nem simula o webhook com escrita. Recebimento real e exibição do alerta seguem pendentes do pareamento WAHA e de uma mensagem controlada.

## Anexos reais nas tarefas - fatia implementada - 30/09/2026
- O seletor de arquivo do detalhe da tarefa agora envia o arquivo pelo endpoint Google Drive (limite de 8 MiB), em vez de salvar apenas o nome local. O endpoint valida o `taskId` com `organization_id` e recurso `tasks`, atualiza o anexo do registro e emite evento de atividade; a tarefa passa a expor o link real do Drive. A interface também adiciona o arquivo à lista de Arquivos e exibe links do Drive.
- Arquivos antigos cujo campo `attachment` contém apenas texto continuam identificados como referências locais antigas, sem alegar que foram enviados.
- Validação local: testes API 26/26, build TypeScript e build Vite passaram; bundle principal 510,98 kB (aviso Vite >500 kB); `git diff --check` passou. Nenhum upload ou escrita no banco de produção foi usado como teste.
- Pendente: validar upload real com autorização Google ainda ativa e uma tarefa real, confirmar acesso ao Drive e persistência após recarregar. Requer operação explícita do usuário na interface, portanto não foi simulada.

### Pós-deploy do vínculo de anexos - 30/09/2026
- `07a4d33` publicado em `main`. Após a janela transitória de 503, a página serviu `index-CPEkp3oZ.js` com os textos do fluxo de upload/vínculo de anexo. `https://focussdev.space/api/health` confirmou banco conectado; n8n `/healthz` respondeu `ok`.
- A confirmação é de deploy/health, não de upload efetivo: não criei arquivo no Drive nem alterei tarefa real nesta validação.
- O IP `2.25.239.145` responde ao Coolify na porta 8000 com redirecionamento HTTP para `/login`; `panel.focussdev.space` não resolve. O acesso direto ao login em HTTP não oferece TLS e é uma pendência de segurança operacional. Configurar hostname com certificado e restringir a porta direta é necessário antes de usar o painel para credenciais.

## Agenda: persistência e sincronização explícitas — 30/09/2026
- A criação de eventos agora aguarda a gravação no workspace antes de chamar Google Calendar. A interface só mostra sucesso local após a confirmação da API; falhas de Calendar preservam o evento no Nexo, exibem a mensagem do provedor e registram o estado de sincronização.
- A edição aguarda a gravação do evento e a atualização do Calendar; a exclusão aguarda a confirmação do Calendar quando há vínculo e a exclusão no Nexo. Erros da API deixam de ser tratados como sucesso nos fluxos da agenda.
- A sincronização malsucedida fica visível na ficha do evento. O formulário impede submissões duplicadas enquanto o salvamento está em andamento.
- Builds e testes locais passaram. Não criei reuniões nem alterei dados do workspace em produção. A publicação será verificada por health check e pelo bundle servido; nenhuma automação do navegador será usada enquanto o usuário estiver no PC.
## Catálogo comercial com modelos iniciais — 30/09/2026
- Os 88 serviços/produtos informados pelo usuário agora recebem texto-base editável para propostas e contratos; planos mensais têm campos próprios para ciclo, renovação e cancelamento.
- Preços, custos e prazos continuam vazios e os itens entram como rascunho. Os campos entre colchetes precisam ser revisados/preenchidos antes de enviar documentos; nenhum preço, prazo ou promessa foi inventado.
- A seleção do serviço na proposta/contrato continua usando os modelos do catálogo. Teste novo cobre os 88 itens e confirma modelos presentes sem dados comerciais fictícios.
- Validação: 30 testes de API passaram; build do frontend e `git diff --check` passaram. Não inseri itens no banco em produção; o cadastro segue pela ação explícita “Cadastrar catálogo informado”.
## Webhook Mercado Pago idempotente para replays de status — 30/09/2026
- O webhook agora compara status normalizado, detalhe e ID do pagamento com o snapshot salvo antes de atualizar a cobrança ou registrar atividade. Replays idênticos deixam de produzir atualizações/atividades repetidas e não redespacham `payment.confirmed`; alterações nesses campos continuam sendo registradas.
- Teste unitário cobre replay idêntico, normalização de campos opcionais e mudanças de status/detalhe/ID. Não usei chamadas de escrita nem cobranças reais no Mercado Pago.
- Validação local: build TypeScript da API, 32 testes e `git diff --check` passaram. A validação de produção será apenas health check após o deploy; o caminho assinado de webhook não foi exercitado em produção.

## Correcao da tela de integracoes e base Clicksign - 30/09/2026
- A funcao React Integrations havia sido removida durante uma alteracao da tela de monitoramento; isso deixava a rota de integracoes com referencia inexistente. O componente foi restaurado e a consulta manual HTTP/SSL de ativos cadastrados foi mantida.
- Clicksign agora aparece no status e na tela de integracoes. O teste autenticado consulta envelopes draft pela API v3, sem criar, notificar ou alterar contratos. O host e limitado aos ambientes oficiais sandbox e producao; padrao e sandbox.
- Para conexao real, cadastrar CLICKSIGN_API_TOKEN e (opcional) CLICKSIGN_API_BASE_URL no servico API no Coolify e redeployar. Nao havia token disponivel para validar com a Clicksign. Envio de contrato, webhook e atualizacao automatica do status de assinatura ainda nao estao implementados nesta fatia.
- Build Vite, build TypeScript da API, 32 testes API e git diff --check passaram. Nenhum dado real foi criado ou alterado.


## Assinatura de contratos via Clicksign - fluxo implementado - 30/09/2026
- A ficha do contrato agora permite revisar o documento completo, informar nome/e-mail do signatario, confirmar envio, criar envelope, anexar arquivo TXT UTF-8, configurar requisito de assinatura e autenticacao por e-mail, ativar o envelope e solicitar notificacao. A extensao TXT esta entre os formatos de upload suportados pela API Clicksign.
- O processo Clicksign e persistido no workspace; envio concorrente e duplicidade sao bloqueados. A notificacao pode ser reenviada e a ficha tem sincronizacao manual que reflete estados running/closed/canceled. Contratos com envelope nao permitem edicao local do documento, status ou metadados de assinatura.
- O modelo exige completar todos os campos entre colchetes antes do envio. O botao de baixar agora usa o texto revisado. O app nao envia nada ao abrir o contrato; o disparo ocorre so por acao confirmada do usuario.
- Validei a sequencia API com fetch mock: envelope, documento TXT, signatario, requisitos de assinatura e evidencia por e-mail, ativacao; tambem testei bloqueio de hosts fora do sandbox/producao oficiais. API build, Vite build, 34 testes e diff-check passaram.
- Pendente: configurar CLICKSIGN_API_TOKEN no Coolify e validar com envelope de sandbox; sem credencial nao foi criada assinatura real. O status atualiza sob demanda, sem webhook Clicksign nesta versao. O bundle principal segue acima de 500 kB.

- Ajuste de deploy: a API recebe CLICKSIGN_API_TOKEN e CLICKSIGN_API_BASE_URL explicitamente pelo compose.yaml; sem isso, variaveis salvas no Coolify nao chegariam ao container. O token permanece vazio por padrao e o ambiente padrao continua sandbox.

## Captura de erros Sentry no frontend e API - 30/09/2026
- O SDK oficial captura erros de renderizacao React e erros nao tratados HTTP 500 da API. Os eventos removem identificacao de usuario, corpo/cookies/cabecalhos/consulta da requisicao e valores de breadcrumbs; nao habilitamos traces nem dados pessoais.
- O card de Integracoes informa que SENTRY_DSN (API) e VITE_SENTRY_DSN (build web) sao ambos necessarios. O teste nao fabrica incidente; sem DSNs configurados, a ingestao ainda nao pode ser comprovada em producao.
- A agenda redesenhada ja esta em producao desde os commits 40e95d8 e 7c6ffb1: dia/semana/mes, busca, resumo, mini calendario, lista futura, persistencia e sincronizacao explicita com Calendar/Meet. Este deploy nao altera a agenda.
- Validacao local: build Vite, build TypeScript da API, 36 testes API, auditoria npm de dependencias de producao (0 vulnerabilidades) e git diff --check passaram. O bundle web ainda excede 500 kB.
- Correcao complementar: o indicador do Sentry exige agora os DSNs da API e do build web, e explica quais variaveis faltam sem apresentar uma integracao parcial como pronta. Nenhum evento artificial e criado pelo teste.

## Reparacao dos modelos do catalogo - 30/09/2026
- Consulta autenticada somente leitura em producao confirmou 88 registros, nas quatro categorias solicitadas. Todos estavam sem `proposalTemplate` e `contractTemplate`, apesar de o catalogo fonte conter esses modelos; assim, escolher o servico nao preenchia o escopo da proposta/contrato.
- O botao do catalogo agora completa somente campos vazios usando os modelos fornecidos, preserva nomes, precos, custos, prazos e textos personalizados, e nao cria itens duplicados. Continua sem inventar valores comerciais.
- Testes cobrem 88 templates, preservacao de precos/textos e ausencia de duplicatas. Validacao local: build Vite, build TypeScript, 34 testes API e diff-check passaram.
- Apos o deploy, a API autenticada reparou os 88 registros existentes com templates de proposta e contrato e checklists. Verificacao posterior confirmou 88/88 em cada campo, os 10 planos mensais marcados com ciclo mensal e os 88 precos ainda vazios; nenhum preco foi inventado, nenhum registro foi criado ou duplicado.

## Revalidacao autenticada das integracoes - 30/09/2026
- Testes de leitura pela API autenticada: Mercado Pago (meios de pagamento), WAHA (API/sessoes), Resend (dominios), Google (perfil OAuth) e n8n (API) responderam conectados. Nenhuma cobranca, mensagem, proposta, contrato, email ou evento foi criado.
- Evolution, Clicksign e GitHub retornaram sem credenciais configuradas. Sentry permanece `setup_required`; nao enviamos incidente artificial.
- A consulta autenticada do n8n confirmou 6 workflows ativos e 0 execucoes. Nao simulei lead, pagamento ou ticket para gerar execucao. O teste da WAHA confirma API acessivel, mas nao confirma telefone pareado nem mensagem entregue. Google conectado confirma OAuth/perfil, nao envio Gmail ou upload Drive.
- Durante o deploy, app/API e n8n apresentaram indisponibilidade transitória 503; os tres endpoints voltaram a HTTP 200 com PostgreSQL conectado.

## Fila persistente para eventos n8n - 30/09/2026
- Os eventos lead.created, ticket.created, project.published, proposal.accepted e payment.confirmed agora entram na tabela `n8n_event_deliveries` antes da resposta da API. Cada workflow recebe uma entrega idempotente, com lease para concorrencia, retry crescente (ate 8 tentativas) e remocao do payload de cliente ao concluir ou descartar.
- O callback de acoes agora tem indice unico por organizacao/evento e trata replay concorrente como ja processado. O outbox existente de cobrancas vencidas permanece independente.
- Testes locais: build TypeScript e 37 testes API passaram, incluindo backoff, limite de tentativas e journal/indices da migracao. Nenhum evento real ou registro artificial foi criado nesta validacao; a execucao remota do fluxo aguarda o proximo evento operacional real. Health apos deploy confirmara que a migracao aplicou no banco de producao.

## Agenda renovada e entrega n8n observavel - 30/09/2026
- A agenda abre na visao diaria, organiza eventos em ordem cronologica e oferece calendarios de semana/mes, navegacao de datas, busca por participantes e atalhos de criacao. A integracao existente de eventos/Google Calendar foi preservada. Commit `6d324bd`; o HTML publicado serviu o novo bundle e site/API responderam HTTP 200.
- O endpoint autenticado de workflows do n8n agora agrega contagens da fila persistente por organizacao (aguardando, entregues, descartados), sem retornar payloads. A tela exibe os tres estados. Commit `d35b4c7`; builds Vite/TypeScript, 37 testes API e diff-check passaram; bundle publicado incluiu `Entrega de eventos`, site/API responderam HTTP 200.
- A verificacao comprova codigo implantado e disponibilidade, nao uma entrega de webhook real. A ultima verificacao autenticada registrada ainda mostrava seis workflows ativos e nenhuma execucao; o proximo evento operacional real sera necessario para confirmar um ciclo completo ponta a ponta.

## Remocao de telas financeiras demonstrativas nao roteadas - 30/09/2026
- Removidos os componentes legados de assinaturas/cobrancas baseados em `localStorage`, links `.local` e atualizacao manual de pagamento. O roteamento ativo ja usa `PaymentConsole` para pedidos e assinaturas do Mercado Pago; receitas, despesas e contas usam os registros autenticados do workspace.
- A tela Resumo Financeiro deixou de referenciar o fallback removido e continua carregando receitas/despesas pela API e cobrancas por `/api/billing/orders`. Rotulos que diziam "local" foram ajustados para refletir os registros do workspace.
- Nenhum registro foi apagado ou criado em producao. Build Vite, build TypeScript da API, 37 testes da API e `git diff --check` passaram. Apos publicar, site/API serao verificados; isso nao substitui um pagamento de ponta a ponta autorizado.

## Remocao de mensagens inconsistentes sobre persistencia - 30/09/2026
- Detalhes de projeto e aprovacao agora descrevem persistencia no workspace/API, nao no navegador. O detalhe de arquivo distingue anexos armazenados no Drive de registros que contêm apenas metadados; nao sugere que o original foi enviado quando nao foi.
- Build Vite e diff-check passaram. Nenhum dado foi escrito; commit e health de producao serao conferidos apos deploy.
- Ajustados também os rótulos do cronômetro e dos comentários de projeto: esses registros usam a API do workspace e não armazenamento local do navegador.

## Relatorios com agrupamento temporal correto e graficos de dados reais - 30/09/2026
- Corrigido o periodo "Este ano" para iniciar em 1 de janeiro, e "Ultimos 90 dias" para usar a janela exata de 90 dias. Datas sem horario sao interpretadas no calendario local; leads, despesas, pagamentos, horas e conclusoes de projeto usam suas datas de referencia apropriadas.
- O grafico agora agrega receita paga por mes, leads criados por semana/mes ou entregas concluidas por semana/mes. A aba Financeiro lista pagamentos e despesas do periodo; adicionados atualizar, carregamento, erro e vazio explicitos. Nada e preenchido com exemplos.
- Cinco testes unitarios cobrem inicio/fim dos periodos, fusos de data-only, agrupamento anual e janela semanal de 90 dias. Build Vite passou. Deploy e bundle servido ainda precisam ser confirmados.

## Conversao atomica de propostas - 30/09/2026
- Aprovar uma proposta agora usa `POST /api/workspace/proposals/:id/accept` e grava, em uma transacao, proposta aprovada, contrato em rascunho, projeto e tarefas; o vínculo por `sourceProposalId` permite repeticao idempotente.
- A API rejeita aprovacoes feitas por criacao/edicao generica e impede que uma proposta ja convertida perca seu estado aprovado. A tela oferece `Aceitar e iniciar` em propostas abertas, sem exigir uma mudanca manual de status. O callback n8n verifica tarefas ja criadas para nao duplicar o inicio do projeto.
- Validacao local desta fatia: 40 testes API, build TypeScript, build Vite e `git diff --check` passaram. Nenhuma proposta de teste ou escrita de negocio foi criada em producao. Commit `8541171` publicado; apos janela transitÃ³ria de 503, o site/API voltaram a HTTP 200 com banco conectado, os health checks `flow.pagfocuss.tech` e `n8n.pagfocuss.tech` responderam 200, e o bundle servido confirmou endpoint, acao e retorno de sucesso da conversao.

## Status operacional do Resend - 30/09/2026
- O teste da integração agora distingue chave/API acessível de envio pronto: só informa `connected` quando existe ao menos um domínio verificado e `RESEND_FROM_EMAIL` válido pertence a um deles.
- Sem domínio verificado ou remetente compatível, a integração fica `setup_required` com instrução objetiva; isso coincide com os pré-requisitos já exigidos pelo endpoint que envia propostas. Nenhum e-mail foi enviado nesta validação.
- Três testes cobrem configuração pronta, domínio/remetente ausentes e remetente fora do domínio verificado. API TypeScript, 43 testes API, build Vite e `git diff --check` passaram; bundle principal continua com aviso acima de 500 kB.- Validacao autenticada apos o deploy: `POST /api/integrations/resend/test` retornou `connected`, 1/1 dominios verificados e `focussdev.space` como dominio verificado. Nenhum email foi enviado.
## Sincronizacao GitHub dos repositorios - 30/09/2026
- A tela Repositórios agora usa o estado real da conexão no servidor e oferece sincronização sob demanda por repositório. O endpoint autenticado e somente leitura consulta metadados, commits recentes, pull requests abertas e o status do deployment mais recente; nenhum conteúdo é publicado ou workflow alterado.
- Respostas mostram links e horário de sincronização, erros de permissão e estado vazio explícitos. O setup de GitHub informa as permissões de leitura requeridas; a API limita owner/repo a nomes válidos e aplica rate limit.
- Validação local: mapper com cenários completos/vazios, 45 testes API, build TypeScript, build Vite e diff-check passaram. GITHUB_TOKEN continua ausente, então não houve consulta real ao repositório; a sincronização de produção requer cadastrar o token no Coolify.
## Revalidacao de n8n e escopo Calendar - 30/09/2026
- Leitura autenticada em producao confirmou 6 workflows ativos (incluindo lembrete de cobranca vencida), 0 execucoes e fila de entrega sem pendencias, entregas ou descartes. Nenhum evento de teste foi criado; a execucao automatica aguarda um evento real elegivel.
- Google Workspace agora testa tambem uma leitura limitada de `primary/events` antes de marcar o Calendar como conectado; HTTP 403 vira `setup_required` com indicacao para reautorizar o escopo `calendar.events`. A resposta informa explicitamente que o teste nao envia Gmail nem faz upload no Drive.
- Validacao local: testes API 47/47, build TypeScript, build Vite e diff-check passaram. A confirmacao do acesso de leitura Calendar em producao sera feita apos este deploy, sem criar evento.