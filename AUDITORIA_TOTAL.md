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
