# Auditoria total do Nexo Workspace

**Data:** 24/09/2026  
**Escopo:** navegação, telas, persistência, API, integrações, fluxos entre módulos, dados relacionais, responsividade e pontos de experiência do usuário.  
**Método:** leitura do frontend e da API, buscas por ações simuladas/estado local, build de produção do frontend e compilação TypeScript da API. Health check do ambiente publicado. Não criei registros artificiais nem disparei mensagens, pagamentos ou convites reais.

## Resultado executivo

O Nexo já tem uma base real: login restrito ao proprietário, API com banco PostgreSQL, CRUD genérico para registros do workspace, notificações persistidas, cobrança e assinatura pelo Mercado Pago, sessão/QR de WhatsApp pelo WAHA, OAuth seguro do Google, portal do cliente com link assinado e deploy pelo Coolify.

Ainda nao e correto classificar todas as integracoes como operacionais. A caixa de entrada agora tem envio de texto pela WAHA e webhook de recebimento implementados, mas ainda precisam de validacao com sessao autenticada conectada em producao; automacoes n8n continuam sem criacao/ativacao de workflows pelo Nexo; arquivos nao tem upload real; assinatura eletronica nao tem provedor. O Calendar agora tem operacoes para criar, atualizar e excluir eventos, convidar e-mails informados e solicitar link do Meet, mas o fluxo OAuth real ainda precisa de teste autenticado em uma conta conectada.

**Validacao desta revisao:** builds do frontend e da API passaram; `git diff --check` passou; o dominio respondeu HTTP 200, `/api/health` confirmou o banco conectado e o bundle do commit `4610773` foi servido. `https://n8n.pagfocuss.tech/healthz` e `/healthz/readiness` responderam HTTP 200. Isso valida disponibilidade, nao execucao autenticada de workflow.

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

1. **WhatsApp na Caixa de entrada:** a tela carrega conversas salvas, mas o botão de enviar sempre informa que o envio está indisponível. Falta receber webhooks da WAHA/Evolution, enviar texto e mídia, persistir id de mensagem/status, associar a conversa ao contato e tratar falha/duplicidade.
2. **Automações n8n:** a área atual salva fluxos como `Rascunho`; não cria/ativa workflows no n8n, não executa testes e não mostra histórico real de execução. O health check do n8n não constitui integração de automação.
3. **Arquivos:** a tela de arquivos aceita o seletor, mas informa que não faz upload. Falta upload seguro ao Google Drive (ou storage próprio), metadados e link de download, associação por cliente/projeto e envio real como anexo pelo canal.
4. **Operacoes Google:** OAuth e escopos existem. Calendar agora cria/atualiza/exclui eventos, envia convites para e-mails explicitamente informados e pode pedir conferencia Meet. A conta OAuth e o ciclo real ainda precisam ser validados com sessao proprietaria; Gmail e Drive ainda nao possuem operacoes no produto.
5. **Resend:** há teste de credencial/domínios, mas não há fluxo de envio para propostas, contratos, cobrança ou notificações, nem registro de entrega/rejeição.
6. **Assinatura eletrônica:** contrato pode ser gerado/baixado em HTML, mas não há provedor de assinatura integrado, envio de envelope, callback ou documento assinado verificável.

### P1 — integridade dos fluxos e dados

1. **Vínculos cliente → pagamentos:** a API aceita `clientId`, e o portal busca pagamentos por esse identificador, mas o formulário do `PaymentConsole` envia `clientName` sem selecionar/enviar o ID. Assim, uma cobrança pode não aparecer no portal do cliente.
2. **Vínculos em registros antigos:** o portal busca projetos/tarefas/contratos/aprovações por `clientId`. Registros legados com apenas nome não aparecem. Foi corrigida a criação nova pela ficha e por conversão de proposta, mas contratos/tarefas criados por outros caminhos ainda precisam de seleção de cliente consistente.
3. **Ficha do cliente usa correspondência parcial por nome** em vários relacionamentos. Isso pode misturar empresas com nomes parecidos ou falhar com abreviações. A regra-alvo deve ser `clientId`; nome apenas como compatibilidade temporária.
4. **Eventos e reunioes:** eventos sincronizam com Google Calendar; convidados e link Meet sao opcionais. A agenda conserva o registro no workspace se o Google nao estiver autorizado e indica o estado. Ainda falta verificar em producao a conta OAuth, a propagacao de alteracoes e respostas dos participantes.
5. **Ativos e monitoramento:** sites/domínios/hospedagens são cadastro manual; uptime, SSL, vencimento real e alerta não são consultados. A tela não deve exibir “online” sem um check real.
6. **GitHub:** cadastro manual de repositório e teste de token existem; commits, PRs, deploys e status de workflow não são sincronizados. A área ainda contém indicação de deploy simulado.
7. **Mercado Pago:** cobranças e recorrências estão no caminho real. Falta vincular cliente por ID no formulário, fazer reconciliação de estados pendentes/expirados e comprovar notificação de webhook na produção antes de tratar a baixa como definitiva.

### P2 — acabamento, previsibilidade e acessibilidade

1. **Rotas do app:** a tela selecionada é guardada em `sessionStorage`, então recarregar na mesma sessão tende a manter o módulo, mas o endereço não representa a tela. Links profundos, histórico Voltar/Avançar e abertura direta de um módulo não são confiáveis.
2. **Texto corrompido:** existe ao menos um caractere de substituição no filtro “Concluída” e textos com `?` no rótulo de último teste e em detalhes comerciais.
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
3. Implementar mensagens WAHA (webhook de entrada + envio de texto/mídia + histórico/status), com uma sessão selecionável por conversa.
4. Ligar fluxos de e-mail e calendário aos provedores configurados e apresentar falhas/entregas.
5. Criar workflows n8n importáveis com ativação, credenciais via ambiente, execuções e logs reais.
6. Integrar assinatura eletrônica e callbacks; gerar PDF/artefato assinado e registrar evidência no contrato.
7. Ligar monitoramento de sites e sincronização GitHub; remover indicadores que não tenham dados reais.
8. Corrigir rotas/histórico, varrer controles sem ação, corrigir textos e executar validação visual desktop/mobile e dos fluxos principais com conta autorizada.

## Limites desta auditoria

Esta revisão combinou inspeção estática, compilação e health check. Não executei pagamento, envio de mensagem/e-mail, convite Google, upload, assinatura ou cadastro de dados de validação em produção. Os provedores precisam ser validados com credenciais ativas e eventos reais controlados antes de qualquer promessa de funcionamento ponta a ponta.

## Atualizacao de implementacao ? 24/09/2026

- Commit `4610773`: endpoints autenticados do Calendar para criar, atualizar com idempotencia por event ID e excluir eventos; os tokens Google sao obtidos pelo mecanismo OAuth cifrado existente.
- A agenda passou a oferecer sincronizacao com Google Calendar, campo de convidados e opcao de link Meet. Edicoes e exclusoes de eventos sincronizados propagam para o Calendar.
- A criacao local continua disponivel quando a conta Google nao esta autorizada; o evento fica marcado como nao sincronizado e a interface explica como conectar.
- Validei builds e disponibilidade do app/API apos o deploy. Nao criei evento real de teste: a aba Nexo esta sem sessao autenticada, entao nao foi possivel provar o OAuth ou uma chamada real ao Calendar nesta revisao.


## Atualizacao de implementacao ? WhatsApp WAHA ? 24/09/2026

- Caixa de entrada consulta sessoes WAHA ativas, permite escolher uma sessao, cria conversas com telefone e identifica o JID brasileiro; novas conversas sao persistidas antes de selecionar o registro do banco. O botao de QR agora tambem tenta iniciar sessoes em estado FAILED.
- Envio de texto usa endpoint autenticado, limite de requisicoes, verificacao de propriedade da sessao/conversa, idempotencia, persistencia de estado e confirmacao do WAHA. Webhook valida segredo em tempo constante, registra entrada, atualiza confirmacoes e evita duplicidade.
- Compose configura eventos `message` e `message.ack` e envia cabecalho secreto ao app. A sess?o de produ??o estava como FAILED; a corre??o publicada permitiu reinici?-la e gerar o QR no app, que agora aguarda leitura. A caixa de entrada mostra corretamente que ainda n?o h? sess?o conectada. Envio/recebimento real n?o foi exercitado antes do pareamento e sem conversa controlada.
- `npm run build`, `npm --prefix api run build` e `git diff --check` passaram depois das alteracoes. A implantacao precisa ser confirmada por health check e bundle apos o push.
