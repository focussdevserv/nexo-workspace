# Plano de melhoria do Nexo

## Objetivo

Deixar o primeiro uso guiado, as fichas completas, as aÃ§Ãµes ligadas ao registro certo e cada Ã¡rea utilizÃ¡vel sem depender de planilhas ou de caminhos escondidos. O plano cobre as abas atuais do menu e as novas Ã¡reas necessÃ¡rias.

## Progresso de implementa??o

- Concluido nesta rodada: atalhos de cobranca e portal preservam o cliente; grafico financeiro usa os dados cadastrados; formulario de receita/despesa aceita contraparte, categoria, data e vencimento; tipografia minima ampliada nas areas CRM e operacoes; receitas e despesas aceitam series manuais semanais, mensais, trimestrais e anuais.
- Validado: navegador autenticado com serie mensal de 3 receitas e datas de fim de mes, registros de teste removidos; 53 testes frontend, 115 testes API, lint, builds frontend/API e diff-check passaram.
- Estado geral: o plano continua aberto. Autenticacao do portal por codigo e acesso basico da equipe por convite/papel foram implementados; permanecem pendentes permissoes por registro e validacao ponta a ponta e integracoes que exigem credenciais externas. O portal depende de Resend configurado e habilitado para entregar os codigos.

## Auditoria inicial

- O menu contÃ©m 37 destinos. A auditoria encontrou aÃ§Ãµes que sÃ³ mostram um aviso ou levam a uma Ã¡rea genÃ©rica, formulÃ¡rios resumidos e capacidades descritas como disponÃ­veis que dependem de serviÃ§os ainda nÃ£o ligados.
- O cadastro de clientes mistura pessoa fÃ­sica, empresa, contato e cliente em campos genÃ©ricos. TambÃ©m hÃ¡ clientes do CRM em `workspace_records` e clientes de cobranÃ§a em outra tabela; isso quebra vÃ­nculos em alguns fluxos.
- O Financeiro possui contas manuais, cobrancas Mercado Pago e assinaturas; o grafico calcula seis meses com os lancamentos existentes. Lancamentos aceitam contraparte, categoria, data e vencimento; edicao, fluxo previsto/realizado, transferencias e recorrencia manual finita foram implementados. Conciliacao bancaria continua dependendo de integracao/configuracao.
- A ficha do cliente jÃ¡ reÃºne alguns dados relacionados, mas seus atalhos de projetos, cobranÃ§as, propostas, atendimento e arquivos nÃ£o mantÃªm sempre o cliente selecionado.
- A caixa de entrada unifica conversas WhatsApp do workspace e threads Gmail em uma interface; leitura, resposta em thread, anexos e marcacao de lido estao implementadas. A atribuicao de conversas WhatsApp agora persiste no workspace. Dependem de credenciais e autorizacao Gmail/WAHA; Hostinger IMAP/SMTP, atribuicao de threads Gmail e validacao de trafego real permanecem pendentes.
- O Portal gera link individual assinado de 90 dias e oferece revogacao explicita; ainda falta login com verificacao por codigo/senha e preferencia por cliente. O acesso nao deve aceitar CPF/e-mail/telefone isoladamente como prova.
- IntegraÃ§Ãµes jÃ¡ tÃªm teste e controles de conexÃ£o, mas as credenciais sÃ£o configuradas no servidor. Os cartÃµes nÃ£o deixam evidente o caminho de configuraÃ§Ã£o; WAHA precisa de acesso direto Ã s sessÃµes e ao QR.
- Equipe tem convites de uso unico, ativacao de senha, suspensao e regras fixas por papel; faltam permissoes granulares por modulo/registro e validacao ponta a ponta no banco. Algumas preferencias ainda nao alteram comportamentos de forma consistente e envio de logotipo continua pendente.
- A navegaÃ§Ã£o lateral e vÃ¡rios textos de telas usam corpo de 7â€“11 px. Aumentar sÃ³ o menu nÃ£o resolve a legibilidade geral.
- O visual foi compactado para caber muitos cartÃµes e colunas. Isso reduz leitura, hierarquia e Ã¡rea de toque, especialmente em tabelas, formulÃ¡rios e telas menores.

## Plano por aba do menu

| Grupo / aba | Melhoria proposta | Prioridade |
|---|---|---|
| Meu Dia | Painel configurÃ¡vel com tarefas, agenda, leads, cobranÃ§as e alertas que abram o registro correto; retirar nÃºmeros demonstrativos e distinguir carregamento, erro e vazio. | P0 |
| Agenda | Criar, editar, cancelar e repetir eventos; filtros por equipe/projeto; sincronizaÃ§Ã£o Google bidirecional com conflitos e fuso horÃ¡rio visÃ­veis. | P1 |
| Tarefas | EdiÃ§Ã£o completa, recorrÃªncia, subtarefas, dependÃªncias, anexos, comentÃ¡rios e atribuiÃ§Ã£o real a membros; manter projeto e cliente ao abrir. | P1 |
| Caixa de entrada | Caixa unificada de e-mail e WhatsApp; sincronizar e-mail, abrir conversa, responder no thread, anexar arquivos, atribuir responsÃ¡vel, marcar lido, pesquisar e filtrar por canal/cliente/status. | P0 |
| AprovaÃ§Ãµes | Criar revisÃ£o ligada a projeto/arquivo; comentÃ¡rios, versÃµes, prazo, notificaÃ§Ã£o e decisÃ£o no portal; corrigir compartilhamento que hoje avisa que depende do portal. | P1 |
| CRM | Transformar em visÃ£o geral navegÃ¡vel com captaÃ§Ã£o por formulÃ¡rio, e-mail, WhatsApp e API; origens, responsÃ¡veis, lembretes e conversÃ£o auditÃ¡vel. | P0 |
| Leads | FormulÃ¡rio com canal/origem, contato, consentimento, serviÃ§o, valor e prÃ³ximo passo; deduplicar por e-mail/telefone e permitir converter em cliente sem perder histÃ³rico. | P0 |
| Pipeline | Etapas configurÃ¡veis, arrastar e soltar persistente, probabilidade, previsÃ£o, filtros por responsÃ¡vel e aÃ§Ãµes reais em oportunidade. | P1 |
| Clientes | Cadastro PF, PJ ou PF+PJ; CPF e CNPJ separados; contato, endereÃ§os, origem, serviÃ§os, preÃ§o e cobranÃ§a Ãºnica/parcelada/recorrente opcionais; ficha editÃ¡vel e relacionamento correto com todos os mÃ³dulos. | P0 |
| Empresas | Definir claramente se empresa Ã© cadastro separado ou parte do cliente PJ; relacionar contatos, clientes, projetos e oportunidades sem duplicar entidades. | P1 |
| Contatos | Gerenciar mÃºltiplos contatos e papÃ©is por empresa/cliente; validar duplicidade e oferecer aÃ§Ãµes de e-mail, WhatsApp e ligaÃ§Ã£o. | P1 |
| Propostas | Modelos por serviÃ§o, impostos/descontos, validade, revisÃ£o, envio Gmail/Resend, abertura/aceite, lembretes e conversÃ£o idempotente em contrato/projeto. | P1 |
| ServiÃ§os | CatÃ¡logo com preÃ§o, custo, margem, modalidade de cobranÃ§a e templates; selecionar serviÃ§os ao cadastrar cliente, proposta, projeto ou cobranÃ§a. | P1 |
| Contratos | Modelos jurÃ­dicos editÃ¡veis, partes e anexos corretos, versÃ£o, vigÃªncia, renovaÃ§Ã£o, Clicksign e acompanhamento de eventos sem estados manuais enganosos. | P1 |
| Projetos | Criar e editar escopo, marcos, tarefas, equipe, prazo, orÃ§amento, cliente e arquivos; visualizaÃ§Ãµes quadro/lista/calendÃ¡rio com filtros persistentes. | P1 |
| Horas | CronÃ´metro por tarefa/projeto, correÃ§Ã£o de registros, aprovaÃ§Ã£o, custo/hora, rentabilidade e relatÃ³rio faturÃ¡vel. | P2 |
| Arquivos | Upload e pastas reais, permissÃµes, versÃµes, busca, preview, relaÃ§Ã£o com cliente/projeto e compartilhamento seguro. | P1 |
| WhatsApp | Conectar nÃºmero por QR claramente, listar estado/erros, selecionar sessÃ£o, receber e responder mensagens, anexos, templates e vÃ­nculo de conversa com cliente. | P0 |
| Tickets | Abertura pelo cliente/equipe, prioridade, SLA, atribuiÃ§Ã£o, mensagens e anexos; ligar ticket Ã  ficha e ao histÃ³rico do cliente. | P1 |
| Sites | GestÃ£o de ativos com cliente/projeto, ambiente, URL, credenciais externas referenciadas com seguranÃ§a e aÃ§Ãµes de manutenÃ§Ã£o. | P2 |
| DomÃ­nios | Datas de renovaÃ§Ã£o, provedor, DNS, alertas e histÃ³rico; separar domÃ­nio de site/hospedagem quando necessÃ¡rio. | P2 |
| Hospedagens | Provedor, plano, vencimento, ambiente e vÃ­nculo com domÃ­nios; lembretes de renovaÃ§Ã£o e custo mensal. | P2 |
| RepositÃ³rios | Sincronizar GitHub, relacionar repositÃ³rio com projeto/cliente e mostrar falha de conexÃ£o com aÃ§Ã£o de recuperaÃ§Ã£o. | P2 |
| Monitoramento | VerificaÃ§Ã£o agendada, histÃ³rico de disponibilidade/SSL, alertas e configuraÃ§Ã£o por ativo; hoje as verificaÃ§Ãµes sÃ£o manuais. | P2 |
| Financeiro | Fluxo de caixa real por perÃ­odo, previsto x realizado, contas a pagar/receber, categorias, centro de custo, conciliaÃ§Ã£o, exportaÃ§Ã£o e relatÃ³rios. | P0 |
| Receitas | Campos completos (cliente, serviÃ§o, categoria, vencimento, conta, forma, parcelamento, recorrÃªncia, status); editar, duplicar, baixar e filtrar. | P0 |
| Despesas | Fornecedor, categoria, projeto, conta, vencimento, recorrÃªncia, comprovante, aprovaÃ§Ã£o e baixa; alertas e relatÃ³rios. | P0 |
| Contas | Saldos por conta, transferÃªncias, categorias e conciliaÃ§Ã£o; indicar com clareza se a integraÃ§Ã£o bancÃ¡ria Ã© manual ou existe. | P1 |
| CobranÃ§as | Lista filtrada por cliente, status e vencimento; criar cobranÃ§a avulsa/parcelada e abrir assinatura opcional com preÃ§o/serviÃ§o prÃ©-preenchidos; acompanhar Pix/boleto/cartÃ£o e estornos. | P0 |
| Assinaturas | ServiÃ§o, valor, frequÃªncia, cliente, autorizaÃ§Ã£o, pausas/cancelamento, falhas de pagamento, prÃ³xima cobranÃ§a e histÃ³rico. | P1 |
| Portal do cliente | Link individual revogÃ¡vel, login por e-mail/CPF/telefone com cÃ³digo de verificaÃ§Ã£o, opÃ§Ã£o de senha, escopo por cliente e aprovaÃ§Ã£o segura; cobrar autenticaÃ§Ã£o confiÃ¡vel, sem aceitar dado pessoal isolado como prova. | P0 |
| Equipe | Convites, usuÃ¡rios, papÃ©is e permissÃµes por mÃ³dulo/registro, remoÃ§Ã£o e trilha de auditoria. | P0 |
| AutomaÃ§Ãµes | Modelos ligados a gatilhos reais; estado rascunho/publicado, execuÃ§Ã£o, falhas, retries e histÃ³rico de entregas. | P2 |
| IntegraÃ§Ãµes | Configurar ou autorizar cada serviÃ§o, conectar/desconectar, testar, renovar autorizaÃ§Ã£o, indicar prÃ©-requisitos e mostrar erro acionÃ¡vel. | P0 |
| RelatÃ³rios | PerÃ­odo e filtros coerentes, drill-down para o registro de origem, exportaÃ§Ã£o e comparaÃ§Ã£o de metas; nÃ£o exibir nÃºmeros sem fonte. | P1 |
| Metas | Metas por perÃ­odo/responsÃ¡vel/categoria, valores realizados a partir dos registros e alertas de ritmo. | P1 |
| ConfiguraÃ§Ãµes | Perfil completo da agÃªncia, identidade/logo, equipe e acesso, moeda/fuso, canais e remetentes, padrÃµes financeiros, notificaÃ§Ãµes efetivas, seguranÃ§a, auditoria e backup restaurÃ¡vel. | P0 |

## Novas Ã¡reas de menu recomendadas

1. **E-mail** (ou uma Caixa de entrada unificada com canal E-mail): caixa recebida, threads, rascunhos, enviados, pastas/labels e configuraÃ§Ã£o Gmail/Hostinger. Para Hostinger: SMTP para envio e IMAP para recebimento, com segredos armazenados no servidor.
2. **Central de notificaÃ§Ãµes**: fila de alertas acionÃ¡veis com preferÃªncias por usuÃ¡rio e estado lido/nÃ£o lido. Pode comeÃ§ar dentro de Meu Dia e ganhar aba prÃ³pria quando crescer.
3. **Central de ajuda**: onboarding, documentaÃ§Ã£o de configuraÃ§Ã£o de integraÃ§Ãµes e suporte, para reduzir a dependÃªncia de configuraÃ§Ã£o manual.

## Auditoria de automaÃ§Ãµes

### O que jÃ¡ estÃ¡ ligado no cÃ³digo

| Gatilho | Comportamento atual | SituaÃ§Ã£o |
|---|---|---|
| Lead criado | API cria tarefa â€œPrimeiro contatoâ€ para o prÃ³ximo dia; se houver o workflow n8n ativo correspondente, delega ao n8n. | AutomÃ¡tico, mas sem escolha de responsÃ¡vel, SLA configurÃ¡vel ou notificaÃ§Ã£o de atraso. |
| Proposta aceita pelo fluxo de aceite | Cria contrato, projeto e tarefas do serviÃ§o na mesma operaÃ§Ã£o; emite evento para n8n. | AutomÃ¡tico; Ã© o fluxo de conversÃ£o mais completo. |
| Projeto concluÃ­do/publicado | API cria tarefa de acompanhamento para sete dias depois, exceto se o workflow n8n de projeto estiver ativo; tambÃ©m enfileira evento. | AutomÃ¡tico, com prazo fixo e sem regra por tipo de serviÃ§o. |
| Ticket criado | Emite evento para n8n. | A tarefa de atendimento depende de modelo compatÃ­vel criado no Nexo, workflow publicado e n8n disponÃ­vel. |
| Pagamento confirmado | Webhook do Mercado Pago atualiza o registro e enfileira evento. | A tarefa de conferÃªncia depende de workflow n8n ativo; nÃ£o hÃ¡ alternativa nativa clara. |
| CobranÃ§a vencida | Verificador periÃ³dico detecta vencimentos e enfileira evento com retry/idempotÃªncia. | A tarefa de revisÃ£o depende de workflow n8n ativo; o cÃ³digo deliberadamente nÃ£o cobra nem avisa o cliente automaticamente. |
| Falha/atraso de entrega ao n8n | Fila tenta novamente e exibe contadores recentes. | Existe retry tÃ©cnico, mas falta histÃ³rico operacional por automaÃ§Ã£o com aÃ§Ã£o de reprocessar/descartar. |

Os seis modelos mostrados em AutomaÃ§Ãµes nÃ£o equivalem a seis automaÃ§Ãµes ativas. Eles comeÃ§am como rascunho e alguns sÃ³ executam depois de configurar o n8n, criar o workflow e publicÃ¡-lo. Rascunhos personalizados tambÃ©m nÃ£o executam. A aÃ§Ã£o de criar tarefa existe para os modelos compatÃ­veis; nÃ£o hÃ¡ construtor genÃ©rico de condiÃ§Ãµes e aÃ§Ãµes.

### AutomaÃ§Ãµes necessÃ¡rias que faltam

| AutomaÃ§Ã£o | Regra sugerida | Prioridade |
|---|---|---|
| Entrada multicanal de lead | E-mail/formulÃ¡rio/WhatsApp cria ou atualiza contato e lead, detecta duplicados e registra canal e consentimento. | P0 |
| SLA de primeiro contato | Se lead continuar sem atividade apÃ³s prazo configurÃ¡vel, avisar responsÃ¡vel e depois escalar. | P0 |
| Proposta sem resposta | Lembretes configurÃ¡veis antes do vencimento, com limite, pausa apÃ³s resposta e opÃ§Ã£o de aprovaÃ§Ã£o antes do envio. | P1 |
| Onboarding de cliente | ApÃ³s negÃ³cio ganho/contrato assinado: checklist, reuniÃ£o inicial, portal, coleta de materiais e responsÃ¡vel. | P0 |
| Assinatura pendente | Acompanhar envelope, lembrar equipe e respeitar estado real da Clicksign; cliente nÃ£o recebe mensagens duplicadas do Nexo e do provedor. | P1 |
| Prazos de projeto e tarefa | Alertas antes/depois do prazo, escalonamento e notificaÃ§Ã£o ao cliente apenas nos marcos aprovados. | P1 |
| AprovaÃ§Ã£o pendente | Lembretes ao contato do cliente, escalonamento interno e pausa quando solicitada alteraÃ§Ã£o. | P1 |
| CobranÃ§a prÃ³xima do vencimento | Lembretes configurados por canal, cliente, horÃ¡rio e consentimento; parar assim que paga/cancela. | P0 |
| Pagamento falhou/recorrÃªncia | Aviso Ã  equipe, atualizar situaÃ§Ã£o da assinatura, abrir tarefa e encaminhar instruÃ§Ã£o de atualizaÃ§Ã£o do meio de pagamento. | P0 |
| RenovaÃ§Ã£o de serviÃ§o/contrato/domÃ­nio | Alertas em janelas configurÃ¡veis, proposta de renovaÃ§Ã£o e confirmaÃ§Ã£o explÃ­cita antes de gerar nova cobranÃ§a. | P1 |
| Ticket sem resposta / SLA | AtribuiÃ§Ã£o automÃ¡tica por fila, confirmaÃ§Ã£o de recebimento, lembretes e escalonamento por prioridade. | P1 |
| PÃ³s-entrega e satisfaÃ§Ã£o | Pesquisa curta apÃ³s entrega e tarefa de acompanhamento; respeitar preferÃªncia do cliente. | P2 |
| Backup e exportaÃ§Ã£o | CÃ³pia agendada criptografada, relatÃ³rio de execuÃ§Ã£o e teste documentado de restauraÃ§Ã£o. | P1 |

### Regras obrigatÃ³rias para automaÃ§Ãµes

- Tela de detalhe deve mostrar gatilho, filtros, aÃ§Ã£o, destinatÃ¡rio, canal, horÃ¡rio, limites, prÃ©via e botÃ£o para ativar/desativar.
- Adicionar botÃ£o â€œTestar com dados de exemploâ€ que nÃ£o envia mensagens nem cria cobranÃ§a real.
- Gravar cada execuÃ§Ã£o com evento de origem, inÃ­cio/fim, resultado, tentativas e erro tratÃ¡vel; oferecer repetir com proteÃ§Ã£o contra duplicidade.
- Mensagens externas exigem template revisÃ¡vel, endereÃ§o/nÃºmero confirmado, preferÃªncia/consentimento e limites de frequÃªncia.
- CobranÃ§a, cancelamento, publicaÃ§Ã£o e assinatura exigem confirmaÃ§Ã£o humana; automaÃ§Ã£o nÃ£o deve fazer aÃ§Ã£o financeira irreversÃ­vel sem regra explÃ­cita.
- Mostrar estados separados: modelo, rascunho, aguardando configuraÃ§Ã£o, ativo, pausado, falhou e concluÃ­do. NÃ£o chamar rascunho de conectado/ativo.

## Fluxos completos de uso

### 1. Primeiro acesso Ã  agÃªncia

`Criar workspace â†’ preencher perfil da agÃªncia â†’ escolher moeda/fuso e notificaÃ§Ãµes â†’ conectar pagamentos/e-mail/WhatsApp (ou pular) â†’ cadastrar serviÃ§o e preÃ§o â†’ cadastrar primeiro cliente â†’ criar projeto ou proposta â†’ emitir cobranÃ§a de teste`

Cada etapa deve dizer por que Ã© necessÃ¡ria, indicar dependÃªncias, permitir salvar e continuar depois e abrir a tela correta. O primeiro uso nÃ£o deve depender de uma lista vazia sem instruÃ§Ã£o.

### 2. Lead atÃ© venda

`Lead chega por canal â†’ deduplicar e registrar consentimento â†’ atribuir responsÃ¡vel e prÃ³ximo passo â†’ qualificar â†’ montar proposta usando catÃ¡logo â†’ enviar e acompanhar â†’ aceite confirmado â†’ gerar contrato, projeto e tarefas â†’ iniciar onboarding`

O cliente e o histÃ³rico devem ser a mesma entidade durante todo o fluxo. Hoje a divisÃ£o entre registros genÃ©ricos de clientes e a tabela de clientes de cobranÃ§a precisa ser resolvida antes de prometer esse vÃ­nculo.

### 3. Cadastro e inÃ­cio de atendimento do cliente

`Escolher PF/PJ/misto â†’ preencher identidade e contato â†’ selecionar serviÃ§os â†’ registrar preÃ§o e cobranÃ§a (nenhuma, Ãºnica, parcelas ou recorrente) â†’ escolher se cria projeto/proposta/contrato agora â†’ revisar â†’ salvar`

Salvar a ficha nÃ£o deve emitir cobranÃ§a. Se a pessoa optar por criar cobranÃ§a/assinatura, abrir revisÃ£o do valor, vencimento, meio e frequÃªncia antes de enviar ao provedor.

### 4. Entrega do projeto

`Projeto criado pelo serviÃ§o/contrato â†’ equipe e tarefas atribuÃ­das â†’ registrar arquivos e horas â†’ atualizar marcos â†’ pedir aprovaÃ§Ã£o no portal â†’ aplicar ajustes â†’ concluir/publicar â†’ acompanhamento e satisfaÃ§Ã£o`

Todos os itens devem abrir na ficha do mesmo cliente/projeto. Se o portal ainda nÃ£o estiver configurado, a tela deve resolver a configuraÃ§Ã£o antes de afirmar que compartilhou.

### 5. CobranÃ§a e recebimento

`Selecionar cliente e serviÃ§o â†’ escolher Ãºnica/parcelada/recorrente â†’ conferir valor e calendÃ¡rio â†’ criar no Mercado Pago â†’ entregar link/QR ao cliente â†’ receber webhook â†’ atualizar financeiro e ficha â†’ tratar falha/atraso com tarefa e lembrete permitido`

O registro financeiro deve manter um identificador de cliente canÃ´nico, inclusive quando a cobranÃ§a vem da ficha. O valor da parcela e o total do contrato precisam ficar distintos.

### 6. Atendimento multicanal

`Mensagem recebida â†’ criar/ligar conversa Ã  pessoa certa â†’ detectar cliente/lead existente â†’ classificar e atribuir â†’ responder na mesma conta/thread â†’ converter em lead, tarefa ou ticket â†’ manter histÃ³rico na ficha`

E-mail precisa ter recebidos, enviados e resposta no thread. WhatsApp precisa manter o ID de sessÃ£o/chat e o histÃ³rico do provedor. Anexo nÃ£o pode parecer enviado se sÃ³ o nome do arquivo foi selecionado.

## Ordem sugerida de execuÃ§Ã£o

1. Fluxo de primeiro uso e modelos de cliente/contato/cobranÃ§a; navegaÃ§Ã£o com contexto; contraste e legibilidade.
2. Caixa de entrada e integraÃ§Ãµes essenciais, incluindo prÃ©-requisitos reais para Gmail/Hostinger/WAHA.
3. Financeiro de ponta a ponta, com lanÃ§amentos completos, cobranÃ§as, parcelas, recorrÃªncias, recebimentos e fluxo de caixa.
4. Portal autenticado e onboarding de cliente.
5. AtivaÃ§Ãµes/execuÃ§Ãµes n8n, SLAs de CRM, cobranÃ§a, projeto e suporte com logs e proteÃ§Ã£o contra duplicaÃ§Ã£o.
6. Equipe/permissÃµes, gestÃ£o, backup restaurÃ¡vel e Ã¡reas operacionais secundÃ¡rias.

## SequÃªncia de entrega

### Fase 0 â€” Tornar seguro e orientado no primeiro uso

- Corrigir aÃ§Ãµes que navegam para Ã¡rea errada e preservar cliente/projeto selecionado ao abrir outros mÃ³dulos.
- Cadastro de cliente PF/PJ/misto, serviÃ§os e condiÃ§Ã£o de cobranÃ§a opcional.
- Revisar autenticaÃ§Ã£o do portal, links, expiraÃ§Ã£o, revogaÃ§Ã£o e dados exibidos.
- Menu e tipografia legÃ­veis em desktop e celular; estados de carregamento/erro/vazio em todas as pÃ¡ginas.
- Onboarding inicial com cadastro da agÃªncia, primeiro cliente, serviÃ§o, canal e cobranÃ§a de teste sem movimentaÃ§Ã£o real.

### Fase 1 â€” Fluxo comercial e atendimento

- CRM e funil integrados a contatos, clientes, propostas, contratos e tarefas.
- Caixa de entrada WhatsApp funcional; conectar Gmail/Hostinger conforme credenciais e permissÃµes disponÃ­veis.
- AprovaÃ§Ãµes e portal relacionados a arquivos, projetos e clientes.

### Fase 2 â€” Financeiro utilizÃ¡vel

- Cadastros financeiros completos e associados a clientes/serviÃ§os/projetos.
- CobranÃ§as Ãºnicas, parceladas e recorrentes com simulaÃ§Ã£o/revisÃ£o antes de enviar ao provedor.
- Fluxo de caixa, contas a pagar/receber, conciliaÃ§Ã£o e relatÃ³rios derivados dos mesmos registros.

### Fase 3 â€” OperaÃ§Ã£o, equipe e gestÃ£o

- Projetos, arquivos, horas e tickets com permissÃµes e rastreabilidade.
- PapÃ©is de equipe; notificaÃ§Ãµes e automaÃ§Ãµes acionadas por eventos reais.
- RelatÃ³rios, metas, sites, domÃ­nios, hospedagens e monitoramento com dados confiÃ¡veis.

## CritÃ©rios para considerar pronto

- Cada botÃ£o executa a aÃ§Ã£o anunciada e mantÃ©m o contexto do registro selecionado.
- Criar/editar/remover atualiza a API e continua correto apÃ³s recarregar a pÃ¡gina.
- Toda tela apresenta estados de carregamento, vazio, erro e sucesso, com recuperaÃ§Ã£o possÃ­vel.
- PermissÃµes isolam organizaÃ§Ã£o, cliente e equipe; links externos expiram e podem ser revogados.
- Fluxos crÃ­ticos passam por testes automatizados e navegador real em desktop e celular.
- ServiÃ§os externos sÃ³ aparecem como conectados apÃ³s teste real e explicam o que precisa ser configurado quando nÃ£o estÃ£o disponÃ­veis.

## Frente de design e legibilidade

Esta frente acompanha todas as fases e comeÃ§a antes de adicionar mais opÃ§Ãµes Ã s telas. Aumentar texto sem rever largura, hierarquia e espaÃ§amento sÃ³ faria a interface transbordar.

- Criar tokens comuns de tipografia, cores, espaÃ§amento, bordas e estados; retirar a mistura atual de tamanhos locais minÃºsculos.
- Alvos iniciais para revisar em todas as telas: corpo 14â€“16 px; rÃ³tulos, tabela e navegaÃ§Ã£o 13â€“14 px; ajuda e metadados 12 px no mÃ­nimo; tÃ­tulo de seÃ§Ã£o 18â€“22 px e tÃ­tulo de pÃ¡gina 28â€“32 px. Ajustar telas densas sem esconder informaÃ§Ã£o essencial.
- Menu lateral com texto de pelo menos 13 px, grupos destacados, estado ativo colorido com contraste forte e versÃ£o recolhida acessÃ­vel por rÃ³tulo. Manter o menu responsivo no celular.
- BotÃµes e controles com Ã¡rea de toque mÃ­nima de 44 Ã— 44 px em celular, foco de teclado visÃ­vel, rÃ³tulo persistente e erro ao lado do campo.
- Reduzir colunas simultÃ¢neas: em largura estreita, converter tabelas em linhas/cartÃµes com campos prioritÃ¡rios e abrir detalhes sem rolagem horizontal inesperada.
- Padronizar espaÃ§os entre tÃ­tulo, explicaÃ§Ã£o, aÃ§Ã£o principal, filtros, conteÃºdo e feedback; distinguir visualmente aÃ§Ã£o principal de configuraÃ§Ãµes e aÃ§Ãµes destrutivas.
- Aplicar paleta funcional e consistente para navegaÃ§Ã£o, sucesso, atenÃ§Ã£o, falha e estado neutro; nÃ£o transmitir estado sÃ³ pela cor.
- Rever contraste, truncamento, zoom do navegador, leitura por teclado e `prefers-reduced-motion`.
- Validar cada grupo de telas em 390 px, 768 px e 1440 px com navegador real, registrando defeitos visuais antes/depois. NÃ£o aprovar uma aba sÃ³ porque o build passou.

## DependÃªncias externas identificadas

- Gmail: a autorizaÃ§Ã£o atual inclui envio; sincronizar a caixa recebida exige escopo de leitura, nova autorizaÃ§Ã£o e tratamento de threads/histÃ³rico.
- Hostinger: exige configuraÃ§Ã£o de IMAP/SMTP no servidor; nenhuma credencial deve ser exposta ao navegador.
- WhatsApp: requer WAHA ativo e pareamento por QR. O app nÃ£o pode concluir o pareamento sem leitura do QR pelo aparelho do usuÃ¡rio.
- Pagamentos: requer conta Mercado Pago e credenciais vÃ¡lidas; emissÃ£o, parcelamento e recorrÃªncia devem ser testados em sandbox antes da produÃ§Ã£o.
- Banco: a tela atual cadastra saldo manual. SincronizaÃ§Ã£o depende de provedor Open Finance e autorizaÃ§Ã£o da instituiÃ§Ã£o.

## Atualizacao de execucao - 2026-09-30

Este estado substitui os itens de progresso e auditoria inicial acima quando houver divergencia.

- Implementado: o cliente CRM tem identificador canonico nas cobrancas e assinaturas; a migracao 0006 adiciona o vinculo com validacao por organizacao e faz backfill apenas quando o nome exato e unico.
- Implementado: cadastro PF, PJ e misto com documentos separados; servicos podem registrar valor unico, parcelas, recorrencia ou nenhum encargo. Salvar o cadastro nao cria cobranca automaticamente.
- Implementado: a ficha abre financeiro e cobrancas/assinaturas preservando o cliente selecionado. O formulario financeiro inclui contraparte, categoria, data e vencimento; removido o campo de valor duplicado.
- Implementado: links do portal expiram em 90 dias e podem ser revogados; os dados de cobrancas/assinaturas do portal usam o vinculo canonico do cliente.
- Implementado: caixa de entrada pode ler threads Gmail, marcar como lida, responder na thread e iniciar novo e-mail. A implementacao depende de `gmail.modify`, OAuth ativo e redeploy; anexos Gmail agora sao enviados como MIME multipart, ate 8 MiB no total; a conexao OAuth Gmail continua necessaria.
- Validado localmente: `npm run build`, `npm run lint`, `npm --prefix api run build` e 77 testes da API passaram.
- Nao validado em navegador autenticado: nao ha `.env` raiz ou `api/.env`, API/PostgreSQL local com credenciais, nem OAuth Gmail autorizado neste workspace.
- Bloqueios externos: aplicar a migracao 0006 no banco usado, fornecer credenciais PostgreSQL e OAuth, reautorizar a conta Google, parear WAHA com QR e validar as credenciais dos provedores. Isso requer ambiente/contas reais.
- Pendencias atuais no codigo/ambiente: sincronizacao Hostinger IMAP/SMTP, conciliacao bancaria/Open Finance e cobertura visual sistematica das 37 abas. O login do portal por codigo de uso unico e as permissoes por modulo da equipe foram implementados; a entrega do codigo depende de Resend configurado. Integracoes externas ainda exigem credenciais, autorizacoes e validacao de trafego real.
## Atualizacao - fluxo de aprovacoes

- Aprovacoes novas exigem cliente ativo do mesmo workspace e arquivo existente no Google Drive.
- O link do arquivo aparece no portal apenas depois da confirmacao de compartilhamento publico somente leitura.
- A permissao criada pelo Nexo pode ser revogada pela ficha da aprovacao. Permissoes preexistentes sao preservadas.
- A API valida cliente no cadastro e na edicao e devolve ao portal apenas titulo, projeto, tipo, status, resposta do cliente e link seguro do Drive; notas internas e revisor ficam ocultos.
- A decisao e o comentario do cliente ficam no registro da aprovacao e os status concluidos saem da lista de pendencias.
- Testes novos cobrem projecao publica, bloqueio de links inseguros e normalizacao de status.

## Atualizacao - onboarding inicial

- Implementado checklist no Meu Dia para completar perfil da agencia, catalogo de servicos, primeiro cliente, projeto/proposta e canal integrado.
- As etapas existentes sao detectadas automaticamente; a tela de perfil da agencia abre diretamente na secao correta das configuracoes.
- O progresso e as etapas adiaveis ficam salvos em um registro de configuracoes do workspace; nenhuma cobranca e criada pelo checklist.
- Build e lint do frontend passaram; build da API passou e 77 testes passaram.
- Tentativa de abrir o app local no navegador chegou a tela de login; o proxy do Vite nao conseguiu conectar a API em `/api/auth/me` (ECONNREFUSED). O teste de fluxo autenticado continua bloqueado porque a API e o banco nao estao ativos neste ambiente.

## Atualizacao - edicao de receitas e despesas

- A lista de receitas e despesas agora oferece uma acao explicita para editar os dados do lancamento no formulario existente.
- O salvamento usa PATCH, preserva status, codigo e metadados do registro, e descarta os campos de transporte da API antes de enviar os dados.
- Fechar a edicao limpa o formulario para que seus valores nao reaparecam ao iniciar um novo lancamento.
- Build, lint, build da API e os 77 testes passaram. A edicao usa o endpoint generico de atualizacao ja coberto pela API; o fluxo visual autenticado depende da API e do banco ativos.


## Atualizacao - previsto e realizado no fluxo de caixa

- O grafico financeiro separa receitas recebidas, receitas previstas, despesas pagas e despesas previstas.
- Lancamentos pendentes usam o vencimento; atrasados entram no mes atual para manter a previsao visivel. Itens pagos usam data de baixa quando disponivel.
- O periodo mostra tres meses anteriores, o atual e os dois seguintes; datas sem horario sao interpretadas no fuso local para evitar troca de mes.
- Build e lint do frontend passaram; dois testes unitarios novos cobrem classificacao, atraso e fuso das datas. Os 77 testes da API seguem aprovados; o navegador autenticado continua indisponivel sem API e banco locais.


## Atualizacao - preservacao de contas de equipe

- A inicializacao da API deixou de apagar contas de usuario diferentes da conta proprietaria. Esse comportamento destruia dados a cada inicio e impedia evoluir para equipes sem perda de contas existentes.
- O servidor ainda aceita login somente para a conta proprietaria. Contas preservadas nao ganham acesso; convites, autenticacao e autorizacao por papel continuam pendentes e precisam de uma implementacao RBAC antes de liberar novos logins.
- O cadastro operacional da equipe permite nome sem e-mail e continua informando que nao cria acesso ao Nexo.
- Validado: build da API e 77 testes passaram; build/lint do frontend e dois testes de fluxo de caixa passaram nas validacoes recentes. Ainda nao foi possivel iniciar a API contra o banco deste ambiente.


## Atualizacao - anexos Gmail

- A caixa de entrada aceita selecionar, revisar e remover um anexo ao compor e responder e-mails Gmail.
- O servidor valida nome e tipo MIME, limita a cinco arquivos e 8 MiB no total, rejeita inje??o de cabe?alho e monta partes `multipart/mixed` com conte?do base64; o envio continua sujeito ao OAuth Gmail conectado.
- A caixa de entrada envia anexos Gmail e arquivos WhatsApp pelo WAHA (`POST /api/sendFile`), com limite de 8 MiB por arquivo; o envio real depende de uma sessao WAHA pareada e ativa.
- Build/lint do frontend e build da API passaram. A su?te da API passou com 79 testes, incluindo dois testes MIME/valida??o de anexos.


### WhatsApp: envio de arquivos

- Implementado envio de um arquivo por mensagem na caixa de entrada, com legenda opcional, limite de 8 MiB, valida??o do destinat?rio e do nome de arquivo e registro do anexo no hist?rico.
- Backend envia pela rota WAHA `POST /api/sendFile` em Base64; a documentacao do provedor descreve esse formato: https://waha.devlike.pro/docs/how-to/send-messages/.
- Cobertos payloads v?lidos, MIME inv?lido e rejei??o de destino/nome inv?lidos nos testes unit?rios. A entrega a um telefone real requer credenciais WAHA e sess?o pareada.


## Atualizacao - transferencia entre contas

- Financeiro > Contas agora tem uma acao para transferir saldo entre duas contas manuais, com descricao, data e valor.
- A API valida as duas contas no workspace, rejeita a mesma conta, valor com mais de duas casas decimais e saldo insuficiente. Bloqueia as contas em ordem estavel e grava os dois saldos, os lancamentos pareados e o evento de auditoria em uma transacao.
- As duas pontas da transferencia nao podem ser editadas/removidas separadamente. Ao arquivar uma conta, as movimentacoes que a referenciam pelas duas pontas sao arquivadas juntas.
- Testes unitarios cobrem calculo em centavos, valor invalido, saldo insuficiente e overflow. Build/lint e validacao de banco isolado ainda devem ser executados quando houver um banco de teste disponivel.
- Limite explicito: estas sao contas manuais; a operacao nao consulta nem movimenta dinheiro no banco real.


## Atualizacao 2026-10-01 - acesso basico da equipe

- Convite de uso unico (48 horas), ativacao de senha, reemissao, suspensao e autorizacao server-side por papel owner/admin/member.
- O owner gerencia contas na aba Equipe. O convite precisa ser compartilhado manualmente; envio por e-mail ainda nao esta ligado.
- Membros veem Meu Dia, Agenda, Tarefas, Caixa de entrada, Aprovacoes, Projetos, Arquivos e Tickets. A interface esconde criar projeto e o atalho de perfil nao abre Configuracoes para esse papel.
- A API permite criar arquivos por membros para suportar upload; os testes de autorizacao e suite completa serao repetidos nesta rodada.
- Pendente: aplicar migracao 0007 no ambiente com banco, executar fluxo autenticado e avaliar permissoes mais finas por registro/acao.


### Resultado E2E do acesso de equipe - 2026-10-01

As migracoes 0000-0007 foram aplicadas em PostgreSQL temporario isolado. Login owner, criacao de convite, ativacao unica, rotas permitidas/negadas, replay rejeitado e suspensao que invalida a sessao foram validados com sucesso. A migracao continua pendente no banco de uso; o produto geral segue em execucao.


## Validacao desta rodada - preferencias e legibilidade - 2026-10-01

- Preferencias de exibicao compacta, tarefas concluidas, confirmacao de exclusao e pagina inicial agora sao carregadas do workspace e aplicadas no app. Membros podem ler somente este subconjunto seguro; gravacao continua restrita a papeis autorizados.
- Confirmacao de exclusao aplica-se a eventos e registros de arquivos.
- Aumentei a tipografia da tela de configuracoes e do menu, com ajustes para viewport estreito.
- Verificado: lint, build Vite, build TypeScript da API, 89 testes da API, 2 testes financeiros e `git diff --check` passaram.
- Ainda falta validar a interacao autenticada no navegador para esta tela. Integracoes externas dependem de credenciais e autorizacao de cada provedor.


## Atualizacao - captura e conversao de leads - 2026-10-01

- Formulario de lead agora registra origem, proxima acao, responsavel, previsao de fechamento, observacoes e contato normalizado.
- Leads recebem campos de origem reais em vez de sempre serem gravados como "Manual". Alteracoes e exclusoes do pipeline/lista usam ID estavel, evitando atingir registros com nomes repetidos.
- Conversao em cliente evita duplicatas por e-mail, telefone ou nome normalizado e carrega origem e observacoes do lead.
- Lint, build Vite, build da API, 89 testes API, 2 testes financeiros e diff-check passaram antes da correcao pequena de chave duplicada no objeto de lead; lint/build serao repetidos agora.


## Atualizacao - drill-down financeiro da ficha do cliente - 2026-10-01

- A lista de cobrancas/assinaturas aberta a partir da ficha agora preserva o escopo pelo ID do cliente e mostra uma acao para retornar a todos os clientes. Registros antigos sem ID usam correspondencia exata pelo nome apenas quando nao ha vinculos explicitos, reduzindo mistura de clientes homonimos.
- Criacao de cobranca ou assinatura pela ficha limpa dados residuais do formulario antes de aplicar o cliente e o servico selecionados.
- Tres testes unitarios cobrem ID, fallback legado exato e nomes parcialmente iguais. Build/lint, 89 testes API e diff-check passaram nesta rodada.


## Atualizacao - atribuicao da caixa de entrada - 2026-10-01

- Conversas WhatsApp podem ser atribuidas a integrantes ativos do workspace; a atribuicao e persistida no registro e aparece ao reabrir a conversa. Novas conversas podem ser criadas com responsavel definido.
- O endpoint `/api/workspace/assignees` retorna apenas ID, nome, e-mail e papel de usuarios ativos da organizacao; membros tem somente permissao GET. A caixa persiste a conversa via PATCH, ja permitido para membros no escopo inbox.
- Build/lint do frontend, build e suite da API (89 testes) passaram. A interface Gmail segue leitura/resposta por OAuth; atribuicao de Gmail e Hostinger IMAP/SMTP seguem pendentes.


## Atualizacao - ciclo de atendimento da caixa - 2026-10-01

- Conversas WhatsApp agora tem estado aberto/resolvido, com acao para resolver ou reabrir e filtros de abertas/resolvidas alem de todas/nao lidas. O estado e salvo no registro do workspace.
- Busca e filtros foram isolados em funcao testavel; quatro casos cobrem estado e busca combinados.
- Validacao: lint e build Vite, 4 testes de filtros/drill-down/financeiro, 89 testes API e `git diff --check` passaram. Build TypeScript da API passou na rodada imediatamente anterior, junto ao novo endpoint de equipe.
- O Gmail ainda nao possui status interno nem atribuicao persistida por thread; isso requer um registro local de metadados indexado por thread Gmail.


## Atualizacao - atribuicao e estado das threads Gmail - 2026-10-01

- Atribuicao e estados aberto/resolvido de Gmail agora sao guardados como metadados do workspace por ID da thread; os dados sincronizados pelo Gmail continuam sendo a fonte para mensagens, leitura e resposta. A tela combina thread e metadados ao atualizar.
- Uma mensagem nova reabre automaticamente uma thread Gmail resolvida. Mensagem WhatsApp recebida tambem reabre atendimento resolvido.
- Validacao: lint, build Vite, build TypeScript API, 11 testes de filtros/metadata/drill-down/fluxo de caixa, 89 testes da API e diff-check passaram. O uso real depende da conta Gmail autorizada e sessao WAHA ativa.


## Atualizacao - suporte na ficha do cliente - 2026-10-01

- A ficha agora apresenta tickets como registros do workspace (codigo, titulo, status e data), corrigindo o uso anterior como array que deixava os campos vazios. O relacionamento prefere clientId e impede vazamento entre clientes homonimos.
- Acao Novo ticket abre a fila com o cliente selecionado; a criacao exige um cliente cadastrado e persiste seu ID.
- Validado com lint, build Vite, dois testes de apresentacao/vinculo de ticket, 89 testes API e diff-check.


## Atualizacao - acesso verificado do portal - 2026-10-01

- Links novos do portal exigem verificacao por codigo de uso unico enviado ao e-mail cadastrado. O cliente pode identificar-se por e-mail, telefone, CPF ou CNPJ; o codigo expira em 10 minutos, tem limite de tentativas e e consumido uma vez. O token de sessao expira em 8 horas.
- Mensagens e aprovacoes tambem exigem a sessao verificada. Links existentes continuam funcionando segundo as regras legadas ate serem revogados/renovados.
- O app so inicia o envio quando Resend estiver configurado e habilitado. Falta validar entrega real com credenciais e dominio do workspace.
- Validado: build e suite da API (92 testes), lint e build Vite, 13 testes frontend de fluxo/relacionamento e `git diff --check`. Nao foi possivel validar o fluxo autenticado no navegador sem API e banco executando.


## Atualizacao - abertura de tarefa pelo Meu Dia - 2026-10-01

- Abrir uma tarefa no painel agora navega para Tarefas e abre a ficha da tarefa selecionada depois que os registros terminam de carregar. Antes, o atalho levava apenas para a lista geral.
- Validado: lint, build Vite e `git diff --check`. O fluxo autenticado no navegador segue pendente de um ambiente local com API e banco ativos.


## Atualizacao - atalho para cobrancas vencidas - 2026-10-01

- O alerta de cobrancas vencidas no Meu Dia agora abre CobranÃ§as jÃ¡ filtrada para pedidos pendentes cujo vencimento passou; a tela oferece retorno a todas as cobranÃ§as.
- O filtro ignora pagamentos quitados e sem data de vencimento. Coberto por teste unitario.
- Validado: lint, build Vite, oito testes focados em filtros/vinculos financeiros e `git diff --check`.


## Atualizacao - classificacao de lancamentos vencidos - 2026-10-01

- Receitas e despesas pendentes com vencimento anterior a hoje agora aparecem como atrasadas na tabela e nos indicadores financeiros. A classificacao e calculada na leitura e nao altera o registro armazenado; baixas manuais continuam sob acao do operador.
- Validado: lint, build Vite, quatro testes de fluxo/filtros financeiros e `git diff --check`.


## Atualizacao - filtros de receitas e despesas - 2026-10-01

- As telas de receitas e despesas agora filtram por categoria e por este mes, mes passado ou ano atual, usando o vencimento quando informado e a data do lancamento como alternativa. A tabela e os indicadores gerais continuam refletindo todos os registros; o filtro afeta somente a lista.
- Validado: lint, build Vite, quatro testes de calendario/fluxo financeiro e `git diff --check`.


## Atualizacao - filtros de status das tabelas - 2026-10-01

- Tabelas do workspace agora oferecem todos os status realmente presentes nos registros, sem cortar a lista depois do terceiro. Busca e status funcionam em conjunto; o controle com icone limpa os filtros e indica quando esta indisponivel.
- Validado: lint, build Vite, seis testes financeiros/tabela e `git diff --check`.


## Atualizacao - exportacao de receitas e despesas - 2026-10-01

- Receitas e despesas podem ser exportadas em CSV considerando os filtros atuais de categoria e periodo. O arquivo usa separador compativel com planilhas brasileiras, BOM UTF-8, aspas escapadas e neutralizacao de celulas que poderiam ser interpretadas como formulas.
- Validado: lint, build Vite, cinco testes financeiros (incluindo neutralizacao de formula CSV) e `git diff --check`.


## Atualizacao - filtros de cobrancas - 2026-10-01

- CobranÃ§as agora podem ser filtradas por status Mercado Pago e vencimento (vencidas, proximos sete dias ou sem vencimento), combinados com busca por cliente/descricao. O atalho de cobrancas vencidas do Meu Dia aplica o filtro correspondente.
- Validado: lint, build Vite, dois testes do filtro de cobrancas e `git diff --check`.
- Limite de validacao desta maquina: o servico PostgreSQL local esta iniciado, mas recusou as credenciais de desenvolvimento documentadas; nao ha `.env` local e o comando Docker nao esta instalado. Assim, fluxo autenticado com API e banco nao foi executado nesta maquina.


## Atualizacao - SLA definido para tickets - 2026-10-01

- Ao abrir um ticket, a equipe pode escolher um prazo de 4, 8, 24 ou 48 horas, ou deixar sem prazo. O vencimento e gravado no ticket; a fila mostra tempo restante/vencido e conta tickets ativos fora do SLA. Tickets resolvidos aparecem como finalizados.
- O prazo escolhido e explicito e nao muda automaticamente quando a prioridade e alterada; notificacoes/escalonamento automaticos continuam pendentes.
- Validado: lint, build Vite, dois testes de calculo/classificacao de SLA e `git diff --check`.

## Atualizacao - movimentacao de oportunidades no pipeline - 2026-10-01

- Cartoes de oportunidade podem ser arrastados entre etapas; a mudanca usa o ID estavel do lead e a mesma persistencia da acao existente. O atalho por botao continua disponivel.
- Validado: lint, build Vite, teste unitario de movimentacao por ID e `git diff --check`.

## Atualizacao - correcao do acesso ao Financeiro - 2026-10-01

- O login do Financeiro nao preenche mais um e-mail fixo da agencia; cada pessoa informa sua propria conta autorizada.
- Atualizei o resumo de estado: caixa Gmail tem metadados de atribuicao/estado; portal inclui verificacao por codigo; receitas/despesas oferecem filtros e exportacao; equipe tem convite, ativacao, suspensao e regras por papel. Permissoes granulares e validacao ponta a ponta continuam em aberto.

## Atualizacao - emissao sequencial de parcelas - 2026-10-01

- O total parcelado agora e dividido em centavos, distribuindo o resto entre as primeiras parcelas para que a soma feche exatamente com o total contratado.
- A ficha do cliente mostra quantas parcelas foram emitidas e oferece a proxima em ordem, com numero/total na descricao. Apos criar a cobranca no Mercado Pago, o Nexo avanca o contador no cadastro do cliente; se essa atualizacao falhar, avisa para conferir a cobranca antes de tentar de novo.
- Validacao: lint, build Vite, dois testes de divisao/validacao e `git diff --check`. O teste transacional com conta Mercado Pago depende das credenciais do workspace.


## Atualizacao - operacao da fila n8n - 2026-10-01

- A tela de automacoes lista as ultimas 50 entregas por workflow, evento, tentativas, estado e falha, sem retornar payload de cliente. O historico continua disponivel quando a API externa n8n esta fora do ar.
- Entregas esgotadas podem ser reprocessadas quando o payload ainda existe; descarte manual apaga o payload. Falhas encerradas pela fila preservam o payload para permitir reprocessamento. Acoes sao limitadas ao workspace e registradas na atividade.
- Validado: build TypeScript API, 93 testes API, lint/build Vite e `git diff --check`. Operacao real depende da conexao n8n do workspace.


## Atualizacao - permissoes por modulo para equipe - 2026-10-01

- O proprietario pode configurar leitura e edicao por conta em nove modulos: CRM, entrega, atendimento, financeiro, sites, automacoes, integracoes, configuracoes e relatorios. A navegacao oculta modulos sem leitura; o backend verifica os direitos salvos em cada requisicao.
- A conta proprietaria e a gestao de equipe nao podem ser liberadas por essas permissoes. Controles de credenciais/conexao dos provedores continuam protegidos. Contas sem configuracao explicita preservam as regras antigas por papel; reemissao de convite limpa overrides antigos.
- Migracao incremental 0008 adiciona o campo de permissoes. Permissoes por registro ainda nao estao implementadas.
- Validado: build TypeScript, 96 testes API, lint, build Vite e `git diff --check`. Fluxo autenticado com a migracao no banco de uso ainda precisa de ambiente API/banco habilitado.

## Atualizacao - escopo por cliente e projeto - 2026-10-01

- O proprietario pode limitar uma conta da equipe a todos os registros ou a clientes/projetos selecionados. Listas, consultas por ID para edicao/exclusao e aceite de proposta verificam o mesmo escopo; recursos de configuracao compartilhada continuam compartilhados.
- Clientes e projetos vinculados por ID; nomes iguais nao concedem acesso. Em escopo selecionado, a criacao de clientes fica bloqueada e novos registros vinculados precisam apontar para um cliente/projeto atribuido.
- Validado: 98 testes API, lint e build Vite; `git diff --check`. Build TypeScript da API validado apos ajustar os tipos de permissao JWT. Teste autenticado com banco permanece pendente porque o PostgreSQL local rejeita as credenciais documentadas e nao existe configuracao local da API.

## Atualizacao - prevencao de leads duplicados - 2026-10-01

- A API impede cadastrar uma oportunidade quando ja existe lead ativo com o mesmo e-mail ou telefone, comparando e-mail sem diferenciar maiusculas e normalizando telefone brasileiro com/sem +55. O conflito inclui o ID existente.
- Validacao unitaria cobre telefone, e-mail e ausencia de identificadores. SuÃ­te API: 101 testes aprovados; build TypeScript, lint e build Vite aprovados.
- Ao receber conflito de duplicidade, o formulario fecha e a lista pesquisa o e-mail/telefone para localizar o lead existente.
- A verificacao e a insercao rodam sob bloqueio transacional por workspace para impedir duplicidade em envios simultaneos.

## Atualizacao - piso de legibilidade da interface - 2026-10-01

- Elevei para 12 px as 883 declaracoes de fonte entre 7 e 11 px em 24 folhas de estilo, incluindo navegacao, notificacoes, CRM, financeiro, atendimento, configuracoes e portal. Nao restaram declaracoes explicitas abaixo de 12 px no CSS do app.
- Lint e build Vite passaram. A pagina de login abriu no Playwright; a validacao autenticada das telas segue indisponivel porque `/api/auth/me` nao conecta ao backend local (ECONNREFUSED), entao a revisao visual completa em 390/768/1440 px ainda esta pendente.

## Atualizacao - filtros de periodo no pipeline - 2026-10-01

- O controle de periodo do CRM/Pipeline agora filtra oportunidades por criacao em janelas moveis de 7, 30 ou 90 dias; oferece tambem todos os periodos e registros sem data.
- Cartoes, contadores, totais e metricas usam o conjunto filtrado. Datas fora da janela e datas futuras nao aparecem nos periodos limitados.
- Validado com dois testes unitarios e lint/build Vite. Validacao visual interna requer API e login ativos.

## Atualizacao - criacao contextual de oportunidades - 2026-10-01

- Os botoes "Oportunidade" e "Adicionar oportunidade" do CRM/Pipeline abrem o formulario real de lead. Ao iniciar pela coluna, o novo lead recebe a etapa daquela coluna; colunas Fechado/Perdido nao oferecem criacao de oportunidades para evitar conversoes sem o fluxo de cliente.
- Lint, build Vite, testes do filtro de periodo e `git diff --check` passaram.

## Atualizacao - conversao atomica de oportunidade em cliente - 2026-10-01

- Marcar uma oportunidade como ganha agora usa `POST /api/workspace/leads/:id/convert`, compartilhado pelo Pipeline, CRM e lista de Leads. A API bloqueia o lead, verifica cliente existente por e-mail/telefone, cria ou reutiliza o cliente, grava `convertedClientId`, fecha o lead e registra atividade na mesma transacao.
- A operacao e idempotente; repeticoes reutilizam o cliente vinculado. Contas com escopo selecionado podem vincular clientes ja atribuidos, mas nao criar um cliente fora do escopo.
- Validado: build TypeScript API, 103 testes API (incluindo dois testes de mapeamento lead-cliente), lint/build Vite e `git diff --check`. Fluxo transacional autenticado ainda aguarda API e PostgreSQL locais utilizaveis.

## Atualizacao - movimentacoes recentes ordenadas no financeiro - 2026-10-01

- A atividade recente do painel financeiro agora mistura receitas e despesas e ordena os oito itens pela data mais nova antes de limitar a lista; registros sem data aparecem depois dos datados.
- Removi o menu de acoes sem operacao nessa tabela somente de resumo, evitando oferecer um controle que nao alterava ou abria o registro.
- Validado com sete testes de fluxo de caixa/atividade, lint, build Vite e `git diff --check`.

## Atualizacao - escopo da equipe nas cobrancas Mercado Pago - 2026-10-01

- Listas e contagens de cobrancas/assinaturas agora filtram por cliente atribuido; tambem incluem clientes ligados aos projetos explicitamente atribuidos. Criar cobranca/assinatura requer cliente dentro do escopo, e alterar uma assinatura fora do escopo responde como nao encontrada.
- O endpoint legado `/api/clients` trabalha com outra tabela sem vinculo canonico; contas com escopo selecionado nao podem acessa-lo. O cadastro CRM `workspace/clients` permanece disponivel com filtro por ID.
- Validado com build API, 105 testes API (incluindo escopo financeiro e bloqueio do endpoint legado) e `git diff --check`. Fluxos autenticados seguem pendentes de banco local funcional.

## Atualizacao - notificacoes respeitam permissoes da equipe - 2026-10-01

- A central agora filtra eventos pelo acesso de leitura ao modulo correspondente antes de montar titulo e detalhes. Com escopo por registro, limita notificacoes de clientes/projetos, recursos vinculados e cobrancas aos registros atribuidos; eventos da tabela de clientes legada sao omitidos para escopos selecionados.
- Validado: build TypeScript API, 106 testes API e `git diff --check`. O comportamento autenticado requer banco local e contas de equipe configuradas.


## Atualizacao - controle explicito de exclusoes da equipe - 2026-10-01

- Permissoes por modulo agora separam leitura, edicao e exclusao. A matriz do backend nao interpreta DELETE como edicao; exclusao requer direito especifico, leitura habilitada e o controle continua sem poder liberar gestao de contas ou credenciais dos provedores.
- A politica legada por papel continua ativa em contas sem override. Ao configurar um membro, exclusao inicia desativada nos modulos; o proprietario pode habilita-la explicitamente.
- Validado: build TypeScript, 96 testes API (incluindo bloqueio/liberacao de DELETE), lint, build Vite e diff-check.

## Atualizacao - escopo de acesso na caixa Gmail - 2026-10-01

- A lista, leitura e resposta de threads Gmail agora verificam se todos os participantes pertencem a clientes atribuidos a conta da equipe ou a propria conta conectada. Conversas em grupo com participantes externos nao atribuidos sao ocultadas.
- O envio de novas mensagens e respostas tambem exige destinatario ligado a cliente atribuido. Escopo total mantÃ©m o acesso existente.
- Validado: build TypeScript API, 107 testes API e `git diff --check`. A verificacao com Gmail real depende de OAuth configurado; o teste autenticado tambem aguarda PostgreSQL local funcional.

## Atualizacao - vinculo de clientes em receitas e despesas - 2026-10-01

- Receitas e despesas manuais agora podem apontar para o cliente canÃ´nico do workspace; o cliente tambÃ©m Ã© prÃ©-preenchido ao abrir um novo lanÃ§amento pela ficha.
- A lista financeira permite filtrar por cliente ou por lanÃ§amentos sem vÃ­nculo. As linhas mostram o cliente associado, e o vÃ­nculo usa ID, sem depender de nomes iguais.
- Validado: teste focado de fluxo financeiro (6), lint, build Vite, build TypeScript API, 107 testes API e `git diff --check`. NÃ£o houve escrita em banco; o fluxo autenticado permanece dependente do PostgreSQL local.

## Atualizacao - recorrencia funcional de tarefas - 2026-10-01

- A criacao e edicao de tarefas oferecem repeticao diaria, semanal ou mensal. Ao concluir uma tarefa recorrente, o Nexo cria a proxima ocorrencia com o mesmo cliente, projeto, responsavel e prioridade; reinicia checklist/comentarios e preserva o dia-base nas recorrencias mensais.
- A tarefa concluida e salva antes da nova ocorrencia, para uma falha ao criar a proxima nao desfazer a conclusao. Se a criacao falhar, a interface informa como tentar novamente.
- Validado: 4 testes da recorrencia, 6 testes financeiros focados, lint, build Vite e `git diff --check`. O comportamento persistido foi coberto por testes puros de regra; execucao autenticada depende de API e banco locais.

## Atualizacao - abertura contextual do cliente pela caixa de entrada - 2026-10-01

- O atalho da conversa agora procura o cadastro por e-mail ou telefone exatos, incluindo contatos vinculados. Quando encontra um unico cliente, abre diretamente a ficha; em caso de ambiguidade ou ausencia de vinculo, abre a carteira filtrada para busca manual.
- A navegacao comercial recebe e consome o contexto de cliente e aguarda a carga das listas antes de decidir que o registro nao esta disponivel.
- Validado: 3 testes de correspondencia de cliente, lint, build Vite e `git diff --check`. O clique autenticado segue sem verificacao visual porque a API/banco local nao estao ativos.

- Atualizacao: a ficha do cliente agora exibe receitas e despesas vinculadas, com atalhos para abrir as listas filtradas pelo cliente ou iniciar lancamento preselecionado. Falha ao carregar uma fonte financeira e mostrada separadamente; demais dados continuam visiveis. A caixa de entrada so apresenta cliente como nao encontrado depois de concluir a carga dos registros. Validado com 11 testes focados, lint, build Vite e git diff --check.

- Revisao de qualidade visual: corrigi texto com acentuacao corrompida em CRM, financeiro e servicos (incluindo labels, confirmacoes e simbolos). Revalidei lint, build de producao e 41 testes do frontend; sem caracteres de substituicao nos tres modulos.

- Parcelamento pela ficha do cliente: cobranÃ§as pagas com cartÃ£o agora tambÃ©m avanÃ§am o contador da parcela do serviÃ§o, assim como Pix/boleto; a atualizaÃ§Ã£o confere o Ã­ndice esperado para evitar duplicar uma parcela jÃ¡ registrada. Falhas no salvamento do contador sÃ£o mostradas como aviso apÃ³s a cobranÃ§a. Adicionados testes do avanÃ§o idempotente e da preservaÃ§Ã£o dos demais serviÃ§os. Validado com 43 testes do frontend, 107 testes da API, lint e build de producao.

- Validacao Playwright em 390 x 844: pagina publicada de login cabe na tela, campos e botao ficam visiveis e tocaveis, sem rolagem lateral. O endpoint /api/auth/me respondeu 401 sem sessao, portanto nenhuma tela interna autenticada foi auditada nesta rodada. Captura em output/playwright/login-mobile.png.

- Aba Arquivos: o controle Recentes agora ordena por data de atualizacao/criacao; pode alternar para Nome A-Z. Datas brasileiras sem horario sao interpretadas no calendario local e itens sem data ficam por ultimo, preservando a ordem entre si. Editar metadados atualiza a data usada na ordenacao. Validado com 3 testes novos de ordenacao, 46 testes frontend, 107 API, lint/build e diff-check.

## Atualizacao - backup restauravel do workspace - 2026-10-01

- Configuracoes agora oferece exportacao do backup completo pelo servidor e restauracao transacional. Inclui registros operacionais, clientes antigos e atuais, cobrancas/assinaturas Mercado Pago e preferencias; restaura por ID, atualiza correspondencias, cria ausentes e mantem registros que nao estao no arquivo.
- Somente a conta proprietaria pode exportar/restaurar. O formato valida organizacao, versao, IDs, tamanho e chaves seguras. Senhas, tokens/credenciais, sessoes WhatsApp, desafios do portal, filas de automacao e eventos de auditoria nao sao exportados; conteudo binario do Google Drive permanece no Drive. A restauracao nao dispara integracoes.
- A restauracao exige o mesmo ID de workspace e mergeia os dados; arquivos de outro workspace ou de outro produto exigem uma migracao separada. O frontend informa estes limites e pede confirmacao antes da escrita.
- Validado com build TypeScript da API, 112 testes API (incluindo autorizacao, redacao de segredos, formato e IDs duplicados), 46 testes frontend, lint, build Vite e diff-check. A execucao da rota autenticada contra PostgreSQL ainda depende da senha local, ausente neste ambiente.

- Ajuste de seguranca na restauracao: lancamentos vencidos pendentes recebem uma marca de supressao de aviso antigo na mesma transacao, para o worker nao reenfileirar notificacoes referentes ao periodo anterior ao backup. Lancamentos com vencimento futuro continuam sujeitos as automacoes normais quando vencerem.

## Atualizacao - ambiente real de uso local e modo escuro - 2026-10-01

- Criado ambiente PostgreSQL isolado em 127.0.0.1:55432 e conta de teste local. Nao usa banco publicado, credenciais externas ou dados reais. A API local e o Vite ficam disponiveis em localhost:3001 e localhost:5173.
- Configuracoes ganhou modo escuro persistente; a preferencia aplica-se ao workspace, muda na hora e sincroniza ao salvar. Validado visualmente em desktop e 390 px, sem rolagem horizontal.
- Validacao autenticada no navegador: login, lista e cadastro de cliente, ficha do cliente, secao Financeiro dentro da ficha e acao contextual de gerar cobranca com cliente e e-mail pre-preenchidos.
- Corrigido carregamento independente das cobrancas/clientes quando Mercado Pago esta indisponivel; a tela continua mostrando os registros e avisa que a emissao requer configurar o provedor. A emissao real segue bloqueada enquanto nao houver credenciais validas.
- Validacao atual: 48 testes frontend e 112 testes API passaram; lint, builds frontend/API e diff-check passaram. Testes de pagamento real, e-mail, WhatsApp, Drive e outros provedores exigem contas/credenciais conectadas e nao foram simulados como integracao operacional.
- Correcao da persistencia do tema: a leitura server-side agora retorna `darkMode`; recarga autenticada confirmou que a preferencia continua ativa. A ficha de clientes e cobrancas foram revistas no tema escuro em desktop e celular. O banco local de teste ficou configurado e nao contem dados reais.

## ValidaÃ§Ã£o rÃ¡pida (2026-10-01)
- SessÃ£o autenticada de teste percorreu 33 itens da navegaÃ§Ã£o: todas as telas apresentaram rota e tÃ­tulo, sem redirecionar ao login.
- Caixa de entrada revisada no modo escuro e ajustada para manter os painÃ©is, histÃ³rico e composiÃ§Ã£o de mensagem legÃ­veis.
- Projetos e tarefas relacionados ao cliente fictÃ­cio foram salvos com `client_id` e `project_id` no banco isolado.
- Frontend: `npm run build` e `npm run lint` passaram. API: `npm --prefix api run build` passou e os 112 testes passaram.
- `git diff --check` passou; apenas avisos de conversÃ£o de CRLF do Git nos arquivos modificados.
- WhatsApp/entrada e automaÃ§Ãµes mostram indisponibilidade quando WAHA/n8n nÃ£o tÃªm credenciais. A conexÃ£o real exige configurar as contas e chaves do provedor.
- Uma navegaÃ§Ã£o automatizada rÃ¡pida disparou o limite global de requisiÃ§Ãµes do ambiente local; nÃ£o reproduzir essa cadÃªncia em uso normal. Manter pausas normais entre mÃ³dulos.


## Revalidacao do fluxo cliente e cobranca - 2026-10-01
- No navegador autenticado, abri a ficha do cliente de teste e confirmei a aba Financeiro, com atalhos locais de receitas, despesas e cobrancas.
- Nova cobranca abriu o modulo correto, filtrado para o cliente, e preencheu o ID, nome e e-mail do cadastro. A emissao continua condicionada a configurar Mercado Pago.
- Corrigi a concordancia do estado vazio financeiro e o resumo de quantidade na tabela (intervalo e singular/plural). Corrigi mensagens portuguesas na API sem alterar os dados de teste.
- Revalidados: 112 testes API, build TypeScript da API, lint e build do frontend.

## Auditoria visual e ciclo financeiro no navegador - 2026-10-01

- No dashboard autenticado, a auditoria visual em 1440 px encontrou o assistente de primeiros passos ainda branco e com texto quase invisÃ­vel no tema escuro. Corrigi o fundo, cartÃµes, texto, progresso e estados concluÃ­dos em `src/dark-mode.css`; a nova captura desktop confirma contraste legÃ­vel. Em 390 px, o assistente empilha as etapas sem rolagem horizontal.
- Carteira de clientes revisada no modo escuro a 390 px: cartÃµes, filtros e busca permanecem legÃ­veis, sem painÃ©is brancos nem overflow horizontal.
- Ciclo autenticado de receita executado no banco isolado: criaÃ§Ã£o com cliente vinculado e vencimento, ediÃ§Ã£o, filtro por cliente, exportaÃ§Ã£o CSV e baixa manual confirmados na interface/API. O lanÃ§amento fictÃ­cio de R$ 1,23 foi removido ao final.
- As checagens apÃ³s as alteraÃ§Ãµes do portal passaram: lint, build do frontend, 53 testes frontend, build da API, 112 testes da API e `git diff --check`.
- O plano continua aberto. RecorrÃªncia de lanÃ§amentos manuais ainda nÃ£o estÃ¡ disponÃ­vel neste formulÃ¡rio; a recorrÃªncia de serviÃ§os do cliente Ã© tratada pelo cadastro de serviÃ§os/cobranÃ§a planejada. Pagamentos, e-mail, WhatsApp, Google e automaÃ§Ãµes remotas precisam de credenciais vÃ¡lidas e testes controlados com os provedores.

## Atualizacao - recorrencia financeira manual - 2026-10-01

- Receitas e despesas agora aceitam series semanais, mensais, trimestrais e anuais com 2 a 60 lancamentos. A criacao ocorre em transacao; repeticoes com o mesmo identificador nao duplicam a serie. Edicao e exclusao de um item afetam apenas aquele lancamento.
- Datas mensais ancoram no dia original e ajustam fim de mes sem deriva; vencimentos mantem o deslocamento em relacao a data do lancamento.
- Validado no navegador autenticado: serie mensal de 3 receitas (31/out, 30/nov, 31/dez), vencimentos em 5/nov, 5/dez e 5/jan, valores e sequencia corretos. Os tres registros ficticios foram removidos; zero restos.
- Verificacoes: 115 testes API, 53 testes frontend, lint, builds de API e Vite e diff-check passaram.

## Atualizacao - cadastro de clientes e catalogo - 2026-10-01

- O formulario de cliente agora exibe inicialmente 8 servicos para reduzir a rolagem; a busca continua consultando o catalogo completo e o botao abre/fecha os 88 itens atuais. Itens marcados ficam visiveis ao recolher a lista.
- Validado no navegador: PF, PJ e PF+PJ alternam os campos/documentos; busca localizou servico fora dos primeiros oito; seletor de cobranca exibiu campos condicionais. Nao salvei cliente durante o teste.
- Tema escuro revisado em screenshot desktop e mobile; viewport 390 px sem rolagem horizontal. Lint, 53 testes frontend, build Vite e diff-check passaram.

## Atualizacao - proposta iniciada pela ficha do cliente - 2026-10-01

- Corrigida a acao "Criar proposta" na ficha: agora abre o formulario e preseleciona cliente, e-mail e titulo editavel. O formulario nao envia nem salva ate a pessoa concluir a acao.
- Confirmado no navegador autenticado que o cliente de teste e seu e-mail aparecem selecionados; cancelei o formulario sem gravar proposta.
- Validacao local: lint, 53 testes frontend, build Vite e diff-check passaram.

## Atualizacao - atendimento iniciado pela ficha do cliente - 2026-10-01

- A acao de atendimento agora leva o cliente ate a caixa de entrada. Se ja existe conversa WhatsApp ligada por ID, e-mail ou telefone, ela e selecionada; se nao existe, o formulario de nova conversa abre com contato, empresa, telefone e e-mail preenchidos.
- Nenhuma mensagem e enviada automaticamente. Criei uma conversa ficticia no workspace isolado para confirmar a selecao da conversa existente, removi-a depois e confirmei zero registros de teste restantes. Tambem validei o formulario pre-preenchido sem salvar.
- Em 390 px, o formulario cabe na tela sem rolagem horizontal; dados de contato permanecem legiveis. Integracao WAHA segue sem sessao conectada, portanto envio real nao foi testado.
- Verificacoes finais: 53 testes frontend, 115 testes API, lint, build do Vite, build TypeScript da API e diff-check passaram.

## Validacao - projeto criado pela ficha do cliente - 2026-10-01

- Na sessao autenticada, usei a acao da ficha para criar um projeto vinculado ao cliente de teste. A interface confirmou sucesso; a API confirmou o `clientId`, nome, tipo e prazo, e a aba Projetos da ficha exibiu o registro.
- Apaguei o projeto de auditoria pela API isolada (HTTP 204) e confirmei que nao resta registro com aquele identificador. Nenhum dado real foi alterado.
- O teste confirma o fluxo ficha do cliente -> novo projeto -> associacao -> exibicao. A lista aberta pode precisar ser atualizada para refletir a remocao feita fora da tela.

## Smoke test para uso local - 2026-10-01

- Frontend local respondeu HTTP 200; a API em `/api/health` respondeu `status: ok` e banco conectado. A sessao autenticada sobreviveu ao reload e `/app/clientes` renderizou sem erro novo de console.
- Qualidade do codigo validada nesta rodada: lint frontend, build Vite, build TypeScript da API e 115 testes API passaram.
- Resultado nao libera integracoes externas: WhatsApp, Gmail, Google, pagamentos e automacoes so ficam operacionais depois de configurar credenciais e autorizar cada conta. O plano do produto segue aberto.

## Validacao - tickets e acao na ficha do cliente - 2026-10-01

- No navegador com a conta de teste, criei ticket ficticio pela fila: API respondeu 201; cliente `Cliente Teste Cadastro Completo`, prioridade Alta, status Aberto e SLA de 24 horas apareceram no registro/tabela. Exclui o ticket de auditoria (204).
- Na ficha do mesmo cliente, aba Suporte > Novo ticket levou a `/app/tickets` e abriu o formulario com o cliente correto selecionado. Fechei sem salvar. A navegacao preservou o contexto do cliente.
- Nao enviei notificacoes ou mensagens ao cliente.

## Ciclo do ticket e melhoria de acesso - 2026-10-01

- Ciclo autenticado: criacao de ticket respondeu 201, edicao para prioridade Urgente/status Em andamento respondeu 200 e a fila atualizou os valores. Removi o ticket temporario (204); nao restam registros deste teste.
- A acao da ficha do cliente abre o formulario com o cliente pre-selecionado. A tabela agora mostra um botao direto `Editar <codigo>` por linha, alem de Mais opcoes, para tornar a edicao mais encontravel.
- Validado no navegador apos a mudanca; lint e build Vite passaram.
- Confirmacao de limpeza: apos novo carregamento da fila, o titulo do ticket de auditoria nao apareceu. Suite de 53 testes unitarios do frontend passou junto do lint/build.

## Correcao P0 - conversao de lead em cliente - 2026-10-01

- A auditoria no navegador reproduziu HTTP 400 ao fechar um lead: a tela enviava `stage` no corpo da rota de conversao, mas a API valida e define esse estado internamente. Ajustei o cliente web para retirar `stage` do corpo da requisicao.
- Repeti a mesma conversao pela ficha do lead: API HTTP 200, lead marcado Fechado, cliente criado com e-mail/telefone/empresa/servico/valor e `leadId`, e lead relacionado pelo `convertedClientId`. A automacao criou a tarefa `Primeiro contato` vinculada ao lead.
- Limpei os dados de teste (tarefa, cliente e lead; todos HTTP 204) e confirmei zero correspondencias na API e na tela apos recarregar. Nenhum contato externo foi enviado.
- Validacoes apos a correcao: 53 testes unitarios frontend, lint, build Vite e `git diff --check` passaram. A tela reabriu sem erros novos no console.

## Smoke test - cobranÃ§a contextualizada e conversÃ£o comercial - 2026-10-01

- Ambiente rechecado antes do teste: frontend HTTP 200; API `/api/health` `ok`, banco conectado.
- O fluxo de conversÃ£o de lead foi exercitado em conta autenticada; a primeira tentativa reproduziu HTTP 400, a correÃ§Ã£o no frontend removeu a etapa do payload, e a segunda tentativa concluiu com HTTP 200.
- Lead, cliente gerado e tarefa automÃ¡tica foram apagados ao final; consultas autenticadas retornaram zero registros de teste. A tela foi recarregada sem o lead e sem erros novos de console.
- VerificaÃ§Ãµes apÃ³s a correÃ§Ã£o: 53 testes unitÃ¡rios de frontend, lint, build Vite e `git diff --check` passaram.
- Inclui regressao automatizada: o payload da conversao omite `stage` e preserva os campos editaveis. Suite frontend agora totaliza 55 testes aprovados.

## Correcao P0 - valores decimais no resumo financeiro - 2026-10-01

- Teste autenticado criou receita de teste de R$ 123,45, cliente vinculado e vencimento. A listagem/API mostraram R$ 123,45, mas o resumo do Financeiro exibia R$ 12.345,00 devido a um parser local que removia o ponto decimal de numeros da API.
- Troquei o parser duplicado pelo `parseDisplayAmount`, ja usado no CRM, e inclui regressao automatizada para numero decimal. No navegador, o KPI e a barra Receita realizada passaram a exibir exatamente R$ 123,45.
- Baixei o registro como Recebida para validar o estado realizado (sem movimentar banco/provedor), exclui-o (HTTP 204) e confirmei a tela novamente com zero receitas e sem erros novos no console.
- Verificacoes: 55 testes frontend, lint, build Vite e `git diff --check` passaram.

## Validacao - despesa prevista, baixa e fluxo de caixa - 2026-10-01

- Na conta de teste, criei despesa de R$ 45,67 com vencimento em outubro. Lista, KPI e fluxo mensal indicaram exatamente R$ 45,67 em `Despesa prevista`.
- Registrei a baixa manual: a API salvou status `Paga`; o grafico transferiu R$ 45,67 para `Despesa paga` e zerou a previsao, sem movimentar banco ou provedor externo.
- Exclui o registro temporario (HTTP 204), confirmei zero correspondencias e recarreguei o resumo sem erros de console.

## Correcao e validacao - checkbox e recorrencia de tarefas - 2026-10-01

- O clique no botao Concluir tarefa era interceptado pelo painel do titulo na mesma celula CSS do grid. Ajustei a camada do botao de conclusao (`z-index`) para tornÃ¡-lo clicavel.
- No navegador autenticado, criei tarefa diaria de teste para 01/10/2026, conclui a ocorrÃªncia e confirmei via API status `ConcluÃ­da`; foi criada exatamente uma prÃ³xima ocorrÃªncia em 02/10/2026 com sequÃªncia 2 e o mesmo `recurrenceId`.
- Exclui as duas ocorrÃªncias (HTTP 204 cada), confirmei zero restantes e recarreguei a fila sem erros novos de console.
- VerificaÃ§Ãµes: 55 testes frontend, lint, build Vite e `git diff --check` passaram.

## Correcao - estado de integracao sem credenciais - 2026-10-01

- Na tela Integracoes, o teste de Resend sem `RESEND_API_KEY` mostrava `Reative esta integracao`, apesar do cartao indicar `Nao configurada`. Corrigi a verificacao para aplicar o estado desconectado somente a integracoes configuradas; a API agora retorna `integration_not_configured` e o modal exibe `Integracao ainda incompleta` com a instrucao `Configure RESEND_API_KEY no servico API`.
- O teste do Resend so consultaria dominios e nao envia e-mails. Nao havia credencial no ambiente, portanto nenhum pedido chegou ao provedor; o estado real ficou visivel.
- Verificacoes: 55 testes frontend, lint, build Vite e `git diff --check` passaram.

## Auditoria no navegador - financeiro contextual e portal - 2026-10-01

- Na ficha do cliente de teste, a aba Financeiro manteve a tela `/app/clientes` e exibiu os registros relacionados ao cliente. A aÃ§Ã£o `Nova cobranÃ§a` abriu `/app/cobrancas` com filtro `Financeiro de Cliente Teste Cadastro Completo`; o formulÃ¡rio veio preenchido com o ID, nome e e-mail corretos. NÃ£o salvei a cobranÃ§a. Mercado Pago nÃ£o estÃ¡ configurado, entÃ£o a emissÃ£o real nÃ£o pode ser usada.
- Gerei um link temporÃ¡rio do Portal do cliente. A URL pÃºblica abriu a confirmaÃ§Ã£o de identidade e a consulta sem sessÃ£o respondeu `portal_verification_required`; nenhum dado do cliente foi exibido. A solicitaÃ§Ã£o de cÃ³digo respondeu HTTP 503 porque Resend nÃ£o estÃ¡ configurado/habilitado. Nenhum e-mail foi enviado. Revoguei o link temporÃ¡rio apÃ³s o teste e a aÃ§Ã£o de revogar desapareceu da tela.
- Resultado: as rotas contextuais de cobranÃ§a e a proteÃ§Ã£o do portal funcionam no ambiente local; o acesso de clientes ao portal e a emissÃ£o de cobranÃ§as permanecem bloqueados pelas credenciais/configuraÃ§Ã£o de Resend e Mercado Pago. NÃ£o hÃ¡ mudanÃ§a de cÃ³digo nesta rodada.


## Dark theme browser fixes - 2026-10-01

- Corrigidos contraste e superficies em CRM, Agenda (dia/semana/mes), Horas e Arquivos. Valores do CRM agora mantem moeda BRL correta, incluindo entradas com ponto decimal.
- Validado no navegador em desktop e viewport mobile de 390px; Arquivos, CRM, Agenda e Horas nao apresentam overflow horizontal de pagina.
- Verificacoes finais: frontend lint/build e 55 testes passaram; API build e 115 testes passaram; `git diff --check` passou (somente avisos de conversao de fim de linha).

## Auditoria de tema escuro e contas - 2026-10-01

- A varredura mobile das 37 rotas encontrou largura excedente em Contas; reorganizei as acoes em celular e validei em viewport de 390px e desktop de 1440px.
- Corrigi superficies claras e textos com baixo contraste em Equipe, Automações, Relatórios, Repositórios, Metas, Caixa de entrada, Tickets, Infraestrutura, filtros financeiros e pagamentos.
- Teste funcional de Contas no workspace local: criei saldo inicial de R$ 1.250,00, registrei saida de R$ 45,67, confirmei saldo de R$ 1.204,33 e removi a conta; API confirmou zero contas e zero movimentacoes.
- Nenhuma rota auditada apresentou overflow mobile depois do ajuste. Integracoes sem credenciais continuam informando indisponibilidade de provedor.

## Correcao de resposta HTTP 204 - 2026-10-01

- O arquivamento de cliente chegava ao banco (HTTP 204), mas o frontend exigia JSON e exibia erro, mantendo a ficha aberta. `parseApiResponse` agora reconhece respostas 204 sem corpo como sucesso; inclui teste de regressao.
- Validei arquivamento de cliente PF/PJ de QA na sessao local: o registro foi removido da lista ativa e, apos reload, a ficha fechou sem alertas ou overflow. O historico e os vinculos permanecem no workspace conforme o arquivamento.
- Resultado local: 56 testes frontend, 115 testes API, lint, build Vite e build TypeScript passaram.

## Revisao de permissao e smoke mobile - 2026-10-01

- Atualizei a descricao em Configuracoes > Equipe e acesso: agora corresponde ao editor existente de leitura, edicao, exclusao por modulo e escopo por clientes/projetos. A validacao visual no navegador confirmou o texto e layout sem overflow em viewport de 390 px.
- Ajustei o rodape da ficha do cliente para explicar o requisito real do portal: link ativo e canal de verificacao configurado.
- Smoke test por navegacao normal no navegador autenticado: Financeiro, Tickets, Projetos, Integracoes, Automacoes e Portal abriram com o titulo esperado, sem alertas de modulo e sem rolagem horizontal em viewport de 390 px.
- Uma varredura acelerada por recarregamentos completos excedeu o limite global de requisicoes do servidor local e recebeu HTTP 429; as rotas carregadas apos o limite nao contam como aprovadas. A sessao foi retomada apos a janela do limitador. A validacao normal e suites de regressao passaram: 56 testes frontend, 115 testes API, lint e builds Vite/TypeScript.

## Exportacao comercial utilizavel - 2026-10-01

- O botao Exportar na carteira de clientes, leads, empresas, contatos, propostas e contratos agora baixa CSV real dos registros atualmente filtrados. O arquivo usa delimitador compativel com planilhas brasileiras, BOM UTF-8, aspas escapadas, protecao contra formula em celula e omite campos de token/senha/segredo inclusive dentro de objetos.
- No navegador autenticado, exportei a carteira de teste: download `clientes-nexo-2026-10-01.csv`, cabecalho/duas linhas confirmados e valor/servico preservados; validei BOM nos bytes do arquivo. Nao alterou registros.
- Tres testes novos cobrem estrutura/escape, protecao contra formula e remocao de credenciais. Frontend: 59 testes, lint, build e diff-check passaram.

## Pipeline: acoes reais e validacao de edicao - 2026-10-01

- Os botoes que apenas mostravam avisos foram ligados a operacoes: adicionar na etapa abre o cadastro preselecionado (disponivel ate Negociacao), o menu da oportunidade abre sua edicao e `Abrir visao geral` navega para o CRM. Removi o botao duplicado de adicionar no rodape de cada coluna.
- No navegador autenticado criei uma oportunidade de QA, abri pelo atalho da oportunidade, alterei a chance de fechamento de 50% para 75% e confirmei o valor salvo pela API. Removi o registro temporario (HTTP 204) e confirmei que nao resta na lista ativa.
- Validacao posterior: 59 testes frontend, lint, build Vite; a tela CRM em tema escuro manteve largura 375 px dentro do viewport de 390 px.

## Exportacoes CSV seguras e consistentes - 2026-10-01

- Unifiquei a geracao/download de CSV em CRM, carteira, horas, relatorios e movimentacoes de contas. Campos com ponto e virgula/aspas sao escapados, valores iniciados como formula recebem protecao contra execucao em planilha, o arquivo recebe BOM UTF-8 e campos com credenciais sao omitidos em exportacao de registros.
- No navegador mobile autenticado validei os downloads de Relatorios, Horas e Contas; todos baixaram com nome esperado, sem overflow. Inspecionei bytes: UTF-8 BOM presente. A exportacao de Horas sem registros agora inclui cabecalho e pode ser aberta/utilizada como planilha vazia.
- Quatro testes cobrem dados com delimitadores/aspas, campos aninhados, credenciais e formulas. Resultado: 60 testes frontend, lint, build Vite e diff-check passaram.

## Persistencia e fundo raiz do tema escuro - 2026-10-01

- Encontrei na captura de Configuracoes uma faixa clara ao fim do documento: o fundo do `html` continuava claro, embora `body` e o app estivessem escuros. O tema escuro agora aplica cor tambem ao elemento raiz.
- Teste no navegador com viewport 390 px: desliguei o tema, salvei, recarreguei e confirmei claro persistido; religuei, salvei e recarreguei, confirmando escuro persistido. A conta de teste permaneceu no estado escuro original. Financeiro, Clientes, Caixa de entrada, Projetos e Configuracoes mostraram fundos/texto escuros e sem overflow; captura mobile conferida, sem pixels claros na borda inferior.
- Validacao apos o ajuste: 60 testes frontend, lint, build Vite e diff-check passaram.

## Identidade visual no portal do cliente - 2026-10-01

- O envio de logotipo nas Configuracoes agora valida PNG/JPEG/WebP ate 2 MB, reduz a imagem para WebP ate 28 KB e salva junto das preferencias do workspace. O preview permite trocar/remover; o portal administrativo mostra a marca salva.
- A API publica o logotipo apenas na resposta do portal apos validar a sessao do cliente. A projecao aceita somente data URL WebP base64 limitado; SVG, URLs externas e conteudo malformado sao descartados.
- Validacao manual autenticada: upload de PNG gerado para QA, preview WebP, salvamento, recarga da pagina confirmando persistencia; depois removi e salvei o logotipo temporario. Conta teste e tema escuro preservados.
- Testes: 2 testes frontend para tipo/tamanho; teste API para whitelist de branding. Lint e build frontend passaram; 116 testes API passaram; build TypeScript da API passou. Nao foi possivel validar o portal publico com um login completo porque a verificacao por email depende do provedor Resend configurado.

## Auditoria funcional acelerada do menu e falhas de carregamento - 2026-10-01

- Naveguei pelas 37 opcoes do menu com a conta de teste: cada rota abriu o titulo correspondente, sem erro de React e sem overflow horizontal em 1440 px. A varredura em sequencia muito rapida ultrapassou o limite global local e gerou respostas 429; nao tratei as respostas dessa varredura como prova de dados carregados.
- A medicao confirmou chamadas GET duplicadas entre a inicializacao e os modulos. `apiRequest` agora deduplica chamadas simultaneas e reaproveita respostas GET por 750 ms; qualquer escrita invalida esse cache. Cada consumidor recebe uma copia independente dos dados.
- Reproduzi 429 na carteira por uma falha simulada do navegador. A tela agora mostra o erro e oferece `Tentar novamente` em vez de apresentar uma lista vazia como se nao houvesse clientes. Removida a simulacao e recarregada a pagina: os 2 clientes da conta de teste voltaram, sem erro HTTP, usando somente uma chamada GET de clientes no carregamento.
- Abri a ficha de `Cliente Teste Cadastro Completo`: resumo, dados PF/PJ, contato, servicos e a aba Financeiro exibiram contexto do proprio cliente sem sair de `/app/clientes`. Fechei a ficha sem salvar alteracoes.
- A aba Integracoes mostra 9 provedores nao configurados e cada cartao informa as variaveis necessarias; Mercado Pago foi aberto apenas para leitura. Nenhum segredo foi criado e nenhuma chamada que movimenta dinheiro, envia mensagem ou email foi executada.
- Validacoes: lint, build Vite e 63 testes frontend passaram; API TypeScript e 116 testes API passaram na rodada atual. Tema escuro permaneceu ativado. O plano segue aberto para os fluxos e dependencias externas ainda nao validados.

## Estados de falha compartilhados e onboarding mobile - 2026-10-01

- O carregador compartilhado agora informa falhas de leitura em todas as telas que usam `useWorkspaceRecords`; os nomes de recursos sao apresentados em portugues. A carteira comercial tambem conserva seu aviso local persistente com acao de retentativa.
- Reproduzi 429 na tela Equipe com interceptacao de rede do navegador: apareceu o aviso `Falha ao carregar equipe: Aguarde e tente novamente.`. Removi a interceptacao e recarreguei a tela; Equipe e depois Meu Dia voltaram a abrir sem erro nem escrita de dados.
- No viewport 390x844 e tema escuro, Meu Dia manteve overflow horizontal falso. O assistente mostrou 3/5 etapas a partir dos dados do workspace; `Configurar perfil` abriu Configuracoes > Perfil da agencia. Textos e botoes visiveis tinham fonte minima de 12 px na amostra medida.
- Estado de teste ao encerrar: navegador na rota Meu Dia, dark mode ativo, viewport 390px, sem modal aberto. Nenhum dado de negocio foi alterado nesta rodada.

## Caixa de e-mail Hostinger conectada ao atendimento - 2026-10-01

- Integração por IMAP/SMTP adicionada à caixa de entrada. A senha é criptografada no servidor por workspace; o navegador recebe somente o e-mail conectado. Servidores fixos Hostinger: IMAP TLS `imap.hostinger.com:993` e SMTP TLS `smtp.hostinger.com:465`.
- A caixa lista até 30 mensagens recentes como texto, respeita o escopo de clientes atribuído ao usuário e permite novo envio/resposta com anexos. O seletor de conta mostra somente contas conectadas e habilitadas.
- Validação local: 63 testes frontend, 118 testes API, lint, build Vite e build TypeScript passaram. `npm audit --omit=dev` da API reportou 0 vulnerabilidades de produção. No navegador autenticado, a caixa sem e-mail conectado mostra instrução para configurar Integrações; endpoint retorna HTTP 409 específico sem credenciais, sem tentar conexão externa ou enviar mensagens. Persistem 3 erros de console de WAHA sem configuração, tratados pela interface.
- Não foi possível validar autenticação real, recebimento nem envio da Hostinger porque não há senha de uma caixa postal de teste. Para usar esse canal, configure e teste a caixa em Integrações. O restante do plano global segue aberto; esta entrega não declara o app inteiro pronto.

## Reauditoria funcional e acessibilidade responsiva - 2026-10-01

- Percorri os 37 destinos principais e os submenus de Configurações na conta de teste em navegador. Todos exibiram o título esperado; viewport de 390 px percorreu também 45 itens incluindo os submenus, sem overflow horizontal. Tema escuro confirmado no elemento raiz (`#0b1220`); corpo base 16 px.
- Fluxo de teste PF+PJ: criei um cliente descartável com identificadores `.test`, conferi contato/empresa no drawer, abri Financeiro e confirmei que a URL ficou em `/app/clientes` e que a seção financeira daquele cliente apareceu na ficha. Arquivei o registro de teste e confirmei que saiu da carteira. Nenhuma cobrança foi emitida.
- O caminho Hostinger agora também conserva responsável/status entre sincronizações e marca mensagens como lidas via IMAP; as operações respeitam escopo de clientes atribuído. Testes unitários cobrem merge/isolamento de metadados e reabertura quando chega mensagem nova.
- Validação desta rodada: 65 testes frontend e 118 testes API aprovados; build TypeScript, lint, build Vite e diff-check aprovados. Avisos de console vieram de provedores não configurados (WAHA, Google Calendar, Mercado Pago, n8n) e da chamada esperada da caixa Hostinger desconectada (HTTP 409); telas seguem carregando e apresentam estado de configuração.
- A auditoria global continua em andamento. Fluxos que dependem de provedores precisam ser ativados com credenciais válidas e verificados em tráfego real antes de declarar o app pronto para operação.

## Correção da ficha de cliente PF/PJ - 2026-10-01

- A ficha tratava todos os registros como empresa e mostrava `document` no campo `CNPJ / documento`; em cadastros mistos esse campo era o CPF. Agora o resumo se adapta a PF, PJ ou misto e mantém campos editáveis separados para nome, razão social, CPF, CNPJ, contato, e-mail e telefone. Ao editar PF ou PJ simples, o campo legado `document` continua sincronizado; no cadastro misto ele preserva o CPF sem substituir o CNPJ.
- Reproduzi no navegador com workspace autenticado: cadastrei um cliente misto de QA, alterei o CNPJ, confirmei pela API que CPF permaneceu inalterado e CNPJ/`companyDocument` receberam o novo valor. Arquivei o registro descartável e confirmei que não aparece na lista ativa. No viewport 390 px, a ficha ficou dentro da largura da tela em tema escuro.
- Validação: 65 testes frontend, lint, build Vite e diff-check passaram. O plano global permanece em andamento.

## Valores de serviço na ficha do cliente - 2026-10-01

- A aba Serviços mostrava a condição genérica do catálogo e ignorava `serviceCharges` salvos no cliente; o valor cobrado e a frequência escolhida no cadastro ficavam ocultos. Agora lista primeiro o preço e a regra específicos por serviço (único, número de parcelas, frequência recorrente ou preço a definir) e mantém serviços antigos sem duplicar linhas.
- No navegador autenticado, a ficha de teste `Cliente Teste Cadastro Completo` mostra `Plano Premium · R$ 350,00 · Recorrência Mensal`. A validação em 390 px e tema escuro confirmou drawer de 375 px sem overflow. Três testes cobrem recorrência, cobrança única, parcelas, serviço sem preço e dados legados.
- Validação: 68 testes frontend, lint e build Vite passaram.

## Ações de pagamento por serviço e correção do drawer mobile - 2026-10-01

- A aba Serviços agora oferece a ação correspondente à condição cadastrada: nova assinatura para recorrência, cobrança avulsa para valor único e próxima parcela para parcelamentos. O formulário recebe o cliente, serviço, valor e frequência corretos; parcelamentos dividem o total em centavos, mostram qual parcela vem a seguir e avançam o contador somente após a cobrança ser confirmada.
- O teste revelou que no celular o conteúdo da ficha do cliente era comprimido a altura zero, deixando o painel de atividade por cima dos campos e bloqueando ações. Corrigi o layout responsivo para rolar as abas e o painel em sequência. No navegador a 390 px, a ação de assinatura abriu `/app/assinaturas` com cliente, e-mail, serviço e R$ 350,00 já preenchidos. Fechei o formulário sem criar cobrança nem assinatura.
- Testes incluem valores recorrentes, únicos, parcelados, preço a definir e arredondamento de parcelas. Validação: 68 testes frontend, lint, build Vite e diff-check passaram. Tema escuro e ausência de overflow foram conferidos no mobile.

## Regressão dos atalhos da ficha do cliente - 2026-10-01

- Teste autenticado no navegador com `Cliente Teste Cadastro Completo`: `Criar proposta` abriu `/app/propostas` com ID do cliente cadastrado, nome e e-mail preenchidos; `Criar projeto` abriu o modal dentro da ficha e exibiu o cliente vinculado; `Abrir atendimento` abriu `/app/caixa-de-entrada` com contato, empresa, telefone e e-mail preenchidos; `Configurar portal` abriu `/app/portal-do-cliente` com o cliente selecionado.
- Os formulários foram fechados sem salvar proposta/projeto/conversa e sem gerar link de portal. Não houve escrita de dados. O console mostrou apenas HTTP 503 de `/api/integrations/waha/sessions`, que a interface captura e apresenta como falta de sessão/configuração WAHA.
- Os fluxos contextuais conferidos nesta rodada passaram; o plano global de auditoria permanece aberto.

## Auditoria WCAG de contraste no tema escuro - 2026-10-01

- A medição automatizada no navegador encontrou badges de contagem do Meu Dia com contraste de 3,47:1, o rótulo de segurança das Integrações em 3,10:1, links de receita em 4,06:1, legenda do gráfico/descrições em 4,34:1 e o estado vazio de Automações com fundo quase branco e texto sobreposto, chegando a 1,15:1.
- Ajustei as cores para superfícies e texto escuros: badges vermelho/azul, rótulos secundários financeiros, links de ação, legenda do gráfico, nota de segurança e estado vazio de automações. Nova varredura em viewport desktop e 390 px não encontrou texto com contraste abaixo de 4,5:1 nessas quatro telas; nenhuma teve overflow.
- Validação: 68 testes frontend, lint, build Vite e diff-check passaram. A varredura incluiu textos visíveis (títulos, corpo, botões, links, células e badges) nas telas Meu Dia, Financeiro, Automações e Integrações em tema escuro.

## Correções adicionais de contraste no tema escuro - 2026-10-01

- A varredura ampliada apontou itens abaixo de 4,5:1 em Agenda (dia selecionado), Tarefas (projeto e prioridades), Arquivos (breadcrumb), Contas (link), Equipe (conta/convite), Relatórios (linhas de serviços) e Metas (contador).
- Ajustei texto e fundos desses componentes com cores legíveis e adequadas ao estado, incluindo prioridades sem perder a distinção de severidade.
- Validação após os ajustes: 68 testes frontend, lint, build Vite e `git diff --check` passaram. O diff-check não encontrou erros; apenas avisos do Git sobre conversão LF/CRLF no Windows.
- O plano completo permanece em andamento. Integrações externas ainda exigem credenciais e validação em tráfego real.

## Reauditoria adicional de navegação, contraste e ação financeira - 2026-10-01

- Percorri novamente os 37 destinos pela navegação autenticada. O título do navegador acompanha cada módulo após a correção em `App.jsx`; em 390 px, os 37 destinos renderizaram seus títulos e nenhum apresentou overflow horizontal.
- A varredura automatizada das 37 telas em tema escuro encontrou dois contrastes residuais: o contador de notificações e o breadcrumb de Arquivos. Ambos agora usam texto/fundo com contraste adequado; a repetição nas 37 telas não encontrou texto abaixo de 4,5:1.
- O botão “Novo lançamento” no Financeiro levava a Receitas, mas não abria o formulário, pois faltava `intentId` no contexto. Corrigi o encaminhamento e confirmei no navegador que o formulário de receita abre com Descrição, Cliente, Categoria, Data, Vencimento e Valor. Fechei sem salvar; não houve alteração de registros financeiros.
- A abertura do cadastro de clientes foi conferida sem salvar: o tipo “Pessoa física e jurídica” exibe simultaneamente Nome, CPF, CNPJ e Razão social; formulário cancelado sem persistência.
- A compilação TypeScript da API encontrou narrowing inválido para `false | FetchMessageObject` no retorno IMAP de marcar como lido. Corrigido o teste explícito de ausência e validado novamente: build API e 118 testes passam. Frontend: 68 testes, lint e build Vite passam.
- Integrações que retornam 503/409 seguem sem credenciais/sessões externas neste ambiente (WhatsApp, n8n, Mercado Pago e Google Calendar); essas rotas mostram estado não configurado. O plano global continua aberto.
- A revisão seguinte do preview do Portal encontrou o rótulo “Portal ativo” mesmo sem link emitido. Agora o estado distingue “Prévia do portal” de “Link ativo”, com cores adequadas no tema claro e escuro. A conta de QA mostra a prévia sem gerar/revogar link nem alterar registros.
- Exportação autenticada do backup respondeu 200 para 120 recursos, versão 1; a inspeção de chaves do nível principal não encontrou campos de segredo/credencial. A restauração não foi acionada.
- Revalidei Integrações: os 10 provedores da conta de QA estão sem configuração. O botão Conectar abre instruções de variáveis no servidor; o teste seguro do Mercado Pago não criou cobrança e informou corretamente a variável de token necessária. O atalho de QR direcionou para WhatsApp e mostrou o erro de WAHA ausente.
- A tela WhatsApp combinava “Conectados 0” com “WhatsApp pronto para uso”. O resumo agora mostra “Nenhum número ativo” quando não há sessão em estado `WORKING`; conferido no navegador junto ao erro explícito de WAHA não configurada. Não criei sessão nem enviei mensagem.
- Teste do tema em Configurações: salvei modo claro, recarreguei a página e confirmei `darkMode=false` tanto no servidor quanto no elemento raiz; depois restaurei modo escuro e confirmei `darkMode=true`. Em 390 px, a tela permaneceu escura e sem overflow (390 px de viewport, 375 px de conteúdo).
- Testei o CTA “Configurar perfil” do onboarding: abriu Configurações diretamente na seção Perfil da agência. Nenhum campo do perfil foi editado.

## Auditoria de tipografia e formulários - 2026-10-01

- A medição dos textos visíveis nas 37 telas confirmou o menu lateral em 14 px. Encontrei apenas três textos abaixo de 12 px: unidade do gráfico de Relatórios (8 px), chamada do estado vazio de Metas (11 px) e tecla de atalho de Arquivos (8 px). Ajustei para 12, 13 e 12 px, respectivamente.
- Abri e fechei sem salvar formulários de Meta, Cliente PF/PJ, Receita, Tarefa, Projeto, Lead, Proposta e Despesa; todos os campos de texto/select/textarea visíveis mediram ao menos 12 px (Proposta: 98 controles incluindo linhas dinâmicas). Nenhum registro de negócio foi criado.
- Pós-ajuste em tema escuro a 390 px: os três componentes corrigidos mantiveram a nova tipografia e nenhuma tela teve overflow. A auditoria de tipografia continua cobrindo o plano global por mais componentes e estados.


## Validação E2E de lead para cliente - 2026-10-01

- No workspace autenticado de QA, criei um lead descartável pelo formulário, movi para Fechado e confirmei a conversão pela API: o cliente foi criado com os dados PF/PJ, serviço, contato e vínculo ao lead. Após recarregar, a sessão e os dados persistiram.
- A conversão também criou a tarefa esperada de primeiro contato. Ao terminar, excluí o lead, arquivei o cliente e removi a tarefa gerada. A API confirmou zero correspondências pelo e-mail de QA; a lista retornou aos dois clientes de QA preexistentes. Permaneceram quatro outras tarefas de QA que já existiam.
- Corrigi os rótulos de Origem, Próxima ação, Responsável e Observações no formulário de lead, que apareciam com interrogações. Reabri o formulário no navegador e confirmei os acentos; fechei sem salvar.
- Validação local: lint, build Vite e 68 testes frontend passaram. Integrações reais seguem pendentes de credenciais externas; a conclusão geral do plano continua em aberto.


## Reauditoria autenticada do menu e estado vazio de Leads - 2026-10-01

- Percorri os 37 itens do menu lateral com a conta de QA. Cada clique abriu a rota esperada, atualizou o título da página e apresentou o cabeçalho do módulo.
- A conta não tem integrações externas configuradas. Google Calendar informou autorização pendente (409); WAHA, Mercado Pago e n8n retornaram seus estados de não configuração (503). As respostas incluem orientações; não foi enviado tráfego real.
- A lista vazia de Leads mostrava "Nenhum leads encontrado". Adicionei mensagens vazias com concordância para Leads, Clientes, Empresas, Contatos, Propostas, Contratos e Serviços. No navegador, confirmei "Nenhum lead encontrado" sem registros criados.
- A sessão terminou sem alteração dos dados de QA.


## Preferencia de tema na tela de entrada e reauditoria mobile - 2026-10-01

- A preferencia escura permanecia no armazenamento local quando a sessao expirava, mas a tela de entrada aparecia clara. Agora a tela de acesso aplica a preferencia em `useLayoutEffect`; adicionei superficies e estados escuros para cartao, campos, texto auxiliar, aviso e carregamento.
- Em dois contextos isolados, confirmei a tela real sem autenticacao em viewport 390x844: modo escuro produziu fundo `#0b1220`, cartao `#111b2b` e campo `#0b1422`; modo claro preservou o cartao branco. Ambos sem overflow. O texto auxiliar mede 13 px e o titulo da pagina e `Nexo · Entrar`.
- Repeti a navegacao autenticada nas 37 telas em 390 px, sem recarregar a pagina. A varredura nao encontrou overflow horizontal nem textos visiveis de conteudo entre 8 e 11 px nos elementos folha medidos; a sessao de QA permaneceu ativa.
- Corrigi a acentuacao do texto auxiliar e do aviso de acesso por convite na tela de entrada.


## Horas: vinculo correto do cronometro - 2026-10-01

- O botao iniciava um registro sem tarefa vinculada, apesar do texto da tela, e o indicador em andamento usava o nome fixo de um projeto. Agora a tela oferece selecao de tarefa ativa, impede iniciar sem selecao, mostra a tarefa real e bloqueia troca enquanto o cronometro esta rodando.
- No navegador autenticado, confirmei que o botao sem tarefa nao cria registro; selecionei uma tarefa de QA, iniciei e parei o cronometro e verifiquei na API o `taskId`, estado concluido e duracao. Exclui o registro descartavel e a API confirmou zero horas restantes.
- Em viewport 390x844 e tema escuro: sem overflow, seletor 13 px, rótulo/ajuda 12 px, botao 48 px de altura; campo com fundo escuro legivel.


## Horas: edicao e remocao de lancamentos - 2026-10-01

- Acrescentei acao de edicao por registro para corrigir a tarefa vinculada e a duracao em horas. Cliente/projeto acompanham a tarefa escolhida; a API persiste a duracao em horas e segundos. A exclusao segue a preferencia de confirmacao do workspace.
- E2E com tarefa de QA: criei um registro pelo cronometro, editei para outra tarefa e 1,25 hora e conferi `taskId`, titulo, projeto/cliente, `hours` e `seconds` pela API; depois exclui pela acao da interface e aceitei a confirmacao. A API voltou a zero registros.
- Em tema escuro e viewport 390x844, o registro e o editor permaneceram dentro da largura; os botoes de acao mobile agora medem 44x44 px. Nenhum dado permanente foi mantido.


## Projetos: salvamento, vinculos e responsaveis vazios - 2026-10-01

- O editor salvava prazo e responsaveis a cada caractere, permitindo PATCH concorrente e valores fora de ordem. Agora status, prazo, responsaveis e progresso ficam em rascunho e sao enviados juntos pelo botao "Salvar alteracoes"; falhas sao apresentadas e o rascunho permanece para nova tentativa.
- Criar projeto sem responsavel gravava `team: [""]`; agora a lista remove valores vazios e o cartao nao cria avatar sem nome.
- E2E no workspace QA: criei projeto ligado a cliente com prazo, alterei status/equipe/progresso, confirmei zero PATCH antes de salvar e exatamente um ao salvar; a API recebeu os valores. Adicionei tarefa e comentario e confirmei apos recarregar projeto, tarefa, cliente e comentario persistidos.
- Criei tambem um projeto sem cliente/responsavel e confirmei `clientId` vazio, `team: []` e ausencia de erro. Exclui ambos os projetos descartaveis e a tarefa temporaria; API retornou aos 2 projetos e 4 tarefas que existiam antes. Nenhum dado de QA foi deixado pela rodada.

## Revalidacao rapida para uso - 2026-10-01

- Corrigido texto literal de entidades HTML no rodape do detalhe de projeto. Na tela autenticada local, o rodape e o placeholder de responsaveis aparecem corretamente; pagina `/app/projetos`, sem alertas de erro.
- Validacao local: 68 testes frontend, lint, build Vite, build TypeScript da API, 118 testes API e `git diff --check` passaram.
- Isso valida o codigo local. O plano geral nao esta concluido: ativacao de provedores externos, aplicacao de migracoes no banco de uso e fluxos reais de envio/pagamento ainda dependem de configuracao e verificacao operacional.
## Revisao visual de projetos e arquivos - 2026-10-01

- A revisao do detalhe de Projeto encontrou a etapa com caractere ausente ("Conclu?do"); corrigi para "Concluído" e conferi no seletor do navegador. O rascunho foi fechado sem salvar.
- Corrigi textos de erro da tela Horas e rotulos/explicacao da ficha de Arquivos que tinham caracteres ausentes. A tela Arquivos em tema escuro e viewport 390 px manteve corpo em 16 px e largura do documento em 390 px, sem rolagem horizontal.
- Validacao local apos as correcoes: lint, build Vite, 68 testes frontend e diff-check passaram. O plano geral permanece aberto.
- Reauditoria de textos (2026-10-01): corrigidos caracteres corrompidos em confirmacoes de exclusao no catalogo/CRM e avisos ao abrir atendimento. Lint, build Vite, 68 testes frontend e diff-check passaram apos os ajustes.
## Tarefas: vinculo legado de cliente e recorrencia - 2026-10-01

- Reproduzi no navegador a criacao de tarefa ligada a um projeto antigo que tinha o nome do cliente, mas nao tinha clientId. A tarefa era gravada com client em texto e clientId vazio. O formulario agora resolve o cliente por ID ou por nome unico no workspace, preenche o cliente ao escolher o projeto e evita sugerir projeto de outro cliente; nome duplicado nao e associado por tentativa.
- Corrigi o editor de tarefas: removi a opcao duplicada "Concluida" sem acento, mantendo o estado canonico "Concluida" com acento; rotulos de recorrencia, responsavel, dependencia, descricao e comentarios estao legiveis.
- E2E autenticado: tarefa QA salvou cliente/projeto por ID, prazo, responsavel, prioridade e recorrencia semanal; concluir a tarefa criou ocorrencia 2 para 15/10/2026. Os tres registros descartaveis foram removidos (HTTP 204); API voltou a quatro tarefas e nenhum teste QA ficou armazenado.
- Incluidos testes unitarios para projeto com ID de cliente, nome legado unico, nome ambiguo e projeto sem cliente.
- O mesmo caso foi testado no detalhe do projeto: criar tarefa pelo painel vinculou por ID ao cliente legado correto. Registro temporario removido (HTTP 204); workspace voltou a quatro tarefas sem registros QA.

## Portal do cliente: acesso e tema escuro - 2026-10-01

- Gerei um link temporario apenas para a conta de QA, sem enviar e-mail. O portal publico exigiu codigo de verificacao antes de liberar os dados; em seguida revoguei o link e confirmei que a rota antiga responde `portal_not_found`.
- Corrigi titulo da pagina publica, acentuacao do botao de envio de codigo, estilos de botoes e foco, e cores para modo escuro.
- Em 390x844, validei a tela de acesso em modo escuro: sem overflow horizontal, cartao/campos/textos legiveis e botao primario com contraste 4,6:1 (hover 5,72:1).
- Revalidacao rapida local: frontend 72/72 testes, API 118/118 testes, lint, build frontend, build API e diff-check passaram. Vite respondeu 200 e `/api/health` respondeu 200 com banco conectado.
- A entrega completa continua aberta enquanto faltarem credenciais/configuracao operacional de provedores externos e validacao em ambiente real.

## Caixa de entrada: descoberta de e-mail e mobile - 2026-10-01

- Na auditoria autenticada, o controle E-mail era apenas um icone sem nome acessivel e a descricao da tela citava somente WhatsApp. Agora os dois canais aparecem na descricao; o controle de e-mail tem nome acessivel, tooltip e rotulo visivel no desktop.
- Em 390 px, a barra da caixa de entrada sobrepunha os botoes de canal com “Nova conversa” e o rodape do chat tinha fonte de 6 px. Reorganizei a barra em duas linhas no mobile, mantive os dois canais acionaveis, aumentei o rodape para 12 px e confirmei que controles nao se sobrepoem e a pagina nao tem overflow horizontal.
- Conferi a Caixa de entrada em tema escuro; o painel manteve superficie escura e texto legivel. O fluxo E-mail abriu o formulario correto, informou a necessidade de conectar Gmail ou Hostinger e foi cancelado sem enviar mensagem.
- O formulario agora usa texto neutro de provedor conectado, pois tambem suporta Hostinger. A tela consulta o status WAHA antes de buscar sessoes, evitando chamadas repetidas ao endpoint que retorna 503 quando a integracao nao esta configurada.

## Aprovações: fluxo sem arquivo do Drive - 2026-10-01

- Na conta autenticada de QA, abri o cadastro e encontrei somente a opção vazia “Selecione um arquivo do Google Drive”. O campo é obrigatório; ao preencher título e cliente e tentar salvar, a validação do navegador bloqueou a operação e não houve POST. A API confirmou zero aprovações de QA e zero registros no workspace.
- Para explicar como liberar o fluxo, o formulário agora informa que é necessário conectar o Google Drive em Integrações e enviar o arquivo pela aba Arquivos. O botão “Configurar Google Drive” levou à rota de Integrações em desktop e em 390 px.
- Corrigi a acentuação dos textos de resumo/detalhe de Aprovações. Em 390x844 e tema escuro, o formulário, a orientação e o botão ficaram dentro da tela, sem rolagem horizontal ou vertical interna.
- Não criei link de compartilhamento público nem aprovação de teste: isso exige arquivo real no Drive e confirmação explícita de compartilhamento. O envio de aprovação no portal segue sem validação fim a fim até haver um arquivo de teste apropriado e Google Drive conectado.

## Tickets: descrição, prioridade e arquivamento - 2026-10-01

- O cadastro permitia gravar `detail`, mas não mostrava campo para o usuário preencher. Adicionei descrição obrigatória com espaço para contexto/passos, contraste para tema escuro e rótulo acessível; a prioridade `Media` agora aparece como “Média” sem alterar o valor canônico existente.
- O detalhe do ticket não tinha ação para retirar um chamado de teste ou arquivar um caso encerrado. Adicionei “Arquivar ticket” com confirmação, integração ao arquivamento do workspace e estado visual vermelho compatível com tema escuro.
- E2E autenticado: criei ticket com cliente, descrição, prioridade urgente, SLA de 4 horas e responsável; editei status para “Em andamento” e descrição; conferi API e contador da fila. Arquivei pela ação da interface, confirmei e verifiquei HTTP 200 com zero tickets ativos e nenhuma linha QA.
- Em 390 px, o formulário permaneceu sem overflow; textarea em 13 px, fundo escuro e texto claro. O campo de prioridade mostrou “Média”. Fechei o formulário vazio sem salvar.
- Também repeti criação e arquivamento em 390 px: o rodapé empilhou Arquivar, Cancelar e Salvar sem corte; confirmação arquivou o ticket e a API retornou zero tickets ativos e zero QA.

## Automações: rascunho e conexão n8n - 2026-10-01

- Adicionei “Atender novo chamado” pela interface e conferi na API que o registro ficou `active: false`, `status: draft`, sem `n8nWorkflowId`; o modelo não executou tarefas. “Criar no n8n” respondeu 503 porque URL/chave não estão configuradas, com instrução ao workspace. Nenhum workflow remoto foi criado.
- Excluí o rascunho pela interface e confirmei HTTP 200, zero automações e zero rascunhos QA ativos.
- Corrigi os acentos que faltavam no histórico de entregas, estado sem modelos, rótulo de próxima ação e descrição de retorno pós-publicação. O navegador autenticado mostra os textos corrigidos.
- A criação/publicação de workflows, eventos enviados ao n8n e ações de tarefa continuam sem teste real até configurar n8n no servidor. O plano geral permanece aberto.

## Auditoria de navegacao e CRM - 2026-10-01

- Conta de teste autenticada: varredura das 37 rotas do menu em 1440 px e 390 px, tema escuro ativo. Todas renderizaram titulo e conteudo sem excecao de JavaScript ou overflow horizontal da pagina.
- Dependencias externas no console: Google Calendar respondeu 409 sem autorizacao; WAHA, Mercado Pago e n8n responderam 503 por falta de configuracao. As telas continuaram utilizaveis e indicam conexoes pendentes.
- Integrações no celular: os nove filtros agora quebram em linhas e nao exibem scrollbar horizontal.
- CRM/Leads: criado registro temporario pela interface, editados empresa, e-mail, telefone, origem, etapa, servico, valor, responsavel e proxima acao; recarga confirmou persistencia; exclusao confirmou lista vazia. Registro de teste removido.
- Defeito corrigido: o detalhe de lead agora permite editar os campos comerciais e de contato. O formulario foi validado no celular, com textos acentuados e campos legiveis no tema escuro.
- Verificacao final apos as mudancas: lint, build frontend, 72 testes frontend e diff-check passaram. `git diff --check` exibiu apenas avisos de conversao LF/CRLF preexistentes.

## Auditoria contextual da ficha do cliente - 2026-10-01

- Na conta de teste, a aba Financeiro da ficha mostrou apenas os serviços, cobranças e recorrências vinculados ao cliente selecionado.
- `Nova cobrança` abriu Cobranças com esse cliente preselecionado; `Ver receitas` abriu Receitas já filtrada pelo ID do cliente. Nenhuma cobrança foi enviada; Mercado Pago respondeu que não está configurado.
- Cadastro misto PF+PJ validado pela interface com CPF, CNPJ, razão social, contato, e-mail e telefone. Um serviço mensal e um serviço de três parcelas foram salvos na ficha.
- A ficha mostrou o recorrente de R$ 350/mês, o parcelamento de R$ 1.200 em 3 vezes (0/3 emitidas) e 0 cobranças abertas. A gravação não emitiu cobrança nem assinatura automaticamente.
- Cliente temporário arquivado pela interface e removido da carteira. Nenhum registro de teste ou transação financeira permaneceu ativo.

## Auditoria de modo escuro e preferencias - 2026-10-01

- Alterar o switch de Modo escuro mudou a aparencia na hora; restaurar o valor salvo voltou ao tema escuro.
- A tela de configuracoes marcava Alteracoes nao salvas mesmo quando o usuario restaurava o valor original e acionava beforeunload ao sair. O estado dirty agora compara os valores editados com a ultima configuracao salva; desfazer uma alteracao limpa o estado sem salvar.
- No navegador: alteracao real mostrou pendencia; reversao mostrou Salvo e navegou sem alerta. O tema terminou escuro.

## Legibilidade global do workspace - 2026-10-01

- Auditoria visual confirmou textos compactos entre 9 e 12 px em várias telas. Adicionei tamanho mínimo de 13 px a parágrafos, rótulos, botões, textos auxiliares, células de tabela e campos dentro da área principal; títulos e números de destaque preservam sua escala.
- No navegador autenticado, a tela Meu Dia mostrou controles e textos em 13 px. Em 390 px, a largura do documento foi 375 px, sem overflow horizontal. Lint e build passaram.

## Revalidacao e correcoes de uso - 2026-10-02

- Meu Dia: `Criar novo` agora abre os formulários de Lead e Cobranca em vez de apenas navegar; a cobranca reinicia os filtros e valores de uma cobranca anterior.
- Caixa de entrada: `Criar tarefa de retorno` abre um formulario com prazo (proximo dia util por padrao), responsavel opcional e vínculo com o cliente quando email/telefone identificam um unico registro. Estados normalizados permitem reabrir atendimentos resolvidos. Validado no navegador sem criar tarefa.
- Receitas/Despesas: editar, dar baixa e excluir agora localizam o lancamento pelo ID estavel, nao pelo codigo exibido que pode se repetir.
- Tarefas: conclusao recorrente persiste a ocorrencia concluida e a seguinte juntas; dependencias que criariam ciclos sao recusadas.
- Integracoes/Operacoes: Mercado Pago permite a primeira autorizacao OAuth antes de haver token de vendedor; respostas antigas do QR do WhatsApp sao ignoradas; falhas da lista GitHub mostram recuperacao em vez de parecer lista vazia.
- CRM: chaves estaveis nas listas da ficha do cliente; selecao de recorrencia semanal e intervalo personalizado preservados.
- Relatorios: valores como `1,234` e `1.234` agora sao interpretados como milhares, enquanto `1,23` continua sendo valor decimal brasileiro; separadores mistos seguem usando o ultimo separador como decimal.
- Horas: registros manuais que terminam depois da meia-noite agora sao vinculados ao dia seguinte; o formulario explica a regra e rejeita intervalos invalidos.
- Smoke mobile (390 px): 29 botoes/rotas laterais avaliados sem overflow horizontal; Agenda exigiu aguardar o chunk lazy e depois renderizou sem erro. Modal de retorno mediu 350 px de largura, totalmente dentro da viewport, sem erro no console.
- Segunda passada: propostas aprovadas ou ja convertidas em contrato/projeto nao podem ser apagadas, evitando deixar contratos, projetos e tarefas sem historico de origem.
- Meu Dia: a lista "Agenda de hoje" mostra compromissos por horario, cliente e estado; selecionar um abre o mesmo evento para edicao na Agenda. Sem eventos, oferece criar um com contexto correto.
- Financeiro: filtros de cobrancas vencidas, proximos 7 dias e sem vencimento agora reconhecem `dueDate` legado e tratam datas sem horario como fim do dia local; datas invalidas nao entram nos filtros.
- Sites e Integracoes: validacao de repositorio GitHub impede cadastros que a API recusaria; respostas atrasadas nao substituem o QR da sessao WhatsApp nem o resultado de uma consulta anterior ao GitHub.
- CRM: conversao de lead e bloqueada para revisao quando email e telefone apontam para clientes diferentes, evitando associar o historico ao cliente errado.
- Equipe e Configuracoes: a mesma validacao de proprietario/repositorio do GitHub e aplicada nos controles administrativos. Multa, juros, lembretes e preferencias de pagamento ainda sao configuracoes armazenadas, nao automatizacoes financeiras.
- Validacao integrada atual: 200 testes frontend e 163 testes API passaram; lint, builds frontend/API e `git diff --check` passaram. Restam apenas avisos de conversao LF/CRLF no diff-check. Smoke Playwright confirmou a Agenda diaria em temas claro/escuro, viewport 390 px sem overflow, abrir o evento correto para edicao e zero erros no console.
- Deploy pendente: producao segue na revisao `07782ac8a246ab96805b5f9377d50b9f7df8d5a8`; o workspace local esta em `0d54b7b222f19f1758831ce046fb89e04a6c15bb`, igual ao `main` remoto, mas com alteracoes nao commitadas. Com autenticacao GitHub explicitamente isolada para `focussdevserv`, confirmei que o repositorio Actions nao tem secrets configurados. Sem `COOLIFY_WEBHOOK` e `COOLIFY_TOKEN`, o workflow para antes de implantar. Nenhum login global foi trocado. O plano continua aberto ate os secrets serem configurados de forma segura e o deploy ser validado.


## Continuidade da auditoria por módulo - 2026-10-02

- Automações: a escolha de ações agora acompanha o gatilho selecionado; edição preserva ações legadas sem oferecê-las em novos rascunhos incompatíveis. Cinco testes específicos passaram.
- Portal do cliente: solicitar ajuste exige comentário significativo antes de habilitar o envio; validação também permanece no handler.
- Acesso ao workspace: tokens únicos de convite e recuperação são removidos da barra/histórico assim que a tela os captura, sem remover outros parâmetros. Recuperação por e-mail ainda requer `RESEND_API_KEY` e `RESEND_FROM_EMAIL`; a sessão da API continua com TTL de 8 horas.
- Metas: mantidas metas manuais existentes e adicionada seleção de indicadores conectados a receita recebida, negócios ganhos, projetos entregues e horas registradas. Período semanal/mensal respeita fuso e início de semana do workspace. Falhas e falta de permissão não são exibidas como zero; demonstração local validada visualmente sem salvar novos dados.
- Validação desta rodada: 210 testes frontend + 4 testes novos de métricas executados (todos passaram), 163 testes API, lint, build frontend, build API e diff-check passaram. A tela Metas e o formulário do novo indicador foram conferidos no navegador local.
- Deploy: checagem no GitHub confirmou ausência dos secrets Actions `COOLIFY_WEBHOOK` e `COOLIFY_TOKEN`; a execução mais recente falhou ao aguardar publicação. Produção continua saudável na revisão `07782ac8a246ab96805b5f9377d50b9f7df8d5a8`, anterior ao worktree atual. Código local ainda contém alterações não commitadas; não houve publicação.
- O plano global continua aberto; a próxima etapa é seguir módulo a módulo, executar validação funcional em cada fluxo e só encerrar após revisar o escopo completo e publicar com deploy confirmado.

## Auditoria funcional por frentes - 2026-10-02 (continuação)

- Financeiro: o indicador A receber agora exclui cobranças pagas, canceladas e estornadas, incluindo estados do Mercado Pago e equivalentes localizados.
- Horas: filtros e períodos exportados respeitam o início semanal escolhido nas preferências do workspace, inclusive semanas iniciadas no domingo.
- CRM/ficha do cliente: a aba Histórico reúne notas, eventos, finanças, projetos, tarefas, tickets, aprovações, contratos e arquivos, em ordem cronológica; registros sem data confiável não são inventados.
- Sites/Monitoramento: cadastro separa nome de exibição e URL/domínio real; edição de ativos antigos preserva o endereço monitorado.
- Relatórios: falha de uma fonte só bloqueia CSV da aba que efetivamente depende dela; as outras abas continuam exportáveis.
- Sessão do workspace: login principal oferece "Manter conectado por 30 dias" (marcado por padrão); sem marcar, a sessão dura até 8 horas. Cookie continua HttpOnly/SameSite=Strict/Secure em produção. Sessões persistentes renovam a validade após autenticação quando restam 15 dias; convite e redefinição de senha também iniciam sessão persistente. Logout limpa o cookie; redefinição invalida sessões anteriores via sessionVersion.
- Validação integrada depois destas mudanças: 219 testes frontend e 166 API passaram; lint, build Vite, TypeScript da API e diff-check passaram.
- Deploy continua sem publicação: secrets Coolify do GitHub não estão configurados e a produção responde saudável na revisão antiga `07782ac8a246ab96805b5f9377d50b9f7df8d5a8`. O app permanece em auditoria; ainda há frentes do menu sem revisão funcional completa.

## Auditoria funcional por módulo - 2026-10-02 (continuação)

- Meu Dia: os cards de indicadores agora são botões acessíveis por teclado e abrem as áreas correspondentes; “Atrasadas” encaminha para Cobranças com o filtro de vencidas preservado.
- CRM/ficha do cliente: editar dados de uma receita ou despesa pendente não registra mais uma baixa implícita; a data/status de recebimento ou pagamento só é gravada quando o usuário escolhe explicitamente o estado liquidado.
- Caixa de entrada: marcar uma conversa do WhatsApp como lida agora persiste no workspace e não reaparece como não lida na sincronização seguinte.
- Aprovações: decisões pendentes, ações e contagens reconhecem diferenças de caixa, acentuação e espaços nos status.
- Configurações: página inicial pode ser definida para qualquer módulo navegável e é preservada na importação de preferências; o texto de Segurança descreve corretamente os prazos de 30 dias com “Manter conectado” e 8 horas sem essa opção.
- Navegação: retorno do histórico para rota não permitida/desconhecida respeita a guarda de alterações não salvas antes de voltar ao Meu Dia.
- Validação integrada desta rodada: 229 testes frontend e 166 testes API passaram; ESLint, build do frontend, compilação TypeScript da API e `git diff --check` passaram. Restam apenas avisos Git de conversão LF/CRLF.
- Deploy continua pendente: os secrets `COOLIFY_WEBHOOK` e `COOLIFY_TOKEN` não estão configurados no GitHub Actions e a revisão de produção ainda é anterior às alterações locais. O plano segue aberto para revisar as áreas restantes e publicar quando a integração de deploy estiver configurada.

## Auditoria funcional por módulo - 2026-10-02 (nova rodada)

- Financeiro/ficha do cliente: se o Mercado Pago não retornar `expiration_date`, o servidor agora persiste como vencimento o fim do dia selecionado em São Paulo; a ficha formata vencimentos no mesmo fuso, sem avançar a data.
- Equipe e acesso: e-mails de contas legadas são normalizados na renovação de convite, login e recuperação de senha, evitando que diferença de maiúsculas impeça o acesso.
- Integrações: Google exibe recuperação OAuth/reautorização mesmo depois de falha ou escopos incompletos; a ação respeita estados pausados e indisponíveis.
- Arquivos: renomear um arquivo vinculado agora atualiza o arquivo no Google Drive e só então sincroniza o workspace. A API confere vínculo, permissão, ID e limite de requisições; a ficha explica que cliente/projeto são metadados do workspace.
- Texto/interface: corrigi sequências de UTF-8 interpretadas como Windows-1252 em Meu Dia, Comercial, Trabalho e uma mensagem de validação da API; a varredura reversível de `src` e `api` não encontrou ocorrências restantes.
- Validação integrada: 232 testes frontend e 169 API passaram; ESLint e builds Vite/TypeScript passaram. `git diff --check` não reportou erros de whitespace; Git continua avisando conversão LF/CRLF em arquivos do worktree.
- Deploy/autodeploy: consultei o repositório usando a credencial já guardada para `focussdevserv`, sem trocar a conta global. A lista de secrets Actions está vazia. A execução `36971438556` falhou porque `COOLIFY_WEBHOOK` e `COOLIFY_TOKEN` chegaram vazios ao workflow e a revisão de produção não mudou; o domínio/API seguem saudáveis na revisão `07782ac8a246ab96805b5f9377d50b9f7df8d5a8`. Não publiquei código local.
- O plano continua aberto para os módulos restantes e para concluir o deploy quando as credenciais de automação forem configuradas de forma segura.

## Validação transversal e correções por módulo - 2026-10-02 (continuação)

- Agenda: ao receber um link para evento excluído/inexistente, a navegação agora consome o contexto depois de carregar os registros, evitando selecionar acidentalmente algo em uma navegação futura. Adicionado helper puro com 3 testes.
- Assinaturas: o formulário de recorrência já permitia cobrança única/recorrente, cadência semanal ou mensal e data inicial; agora também aceita data final opcional. Datas são serializadas como calendário local de São Paulo e a API já valida que o fim seja posterior ao início.
- Acessibilidade e interface: adicionei link para pular direto ao conteúdo principal e dimensões intrínsecas aos QR/logos que não tinham tamanho declarado, reduzindo saltos de layout.
- Playwright local em modo de demonstração: percorri as 29 opções do menu em desktop e 390 px; todas renderizaram título/conteúdo, sem overflow horizontal de página. Os cartões do Meu Dia e o CRM abriram fluxos contextuais; o formulário de tarefa abriu sem salvar dados. Em 1440 px, os controles permanecem dentro da viewport; a faixa do pipeline CRM é intencionalmente rolável na horizontal.
- Acessibilidade: conferi os controles das 29 telas em busca de botões sem texto, título ou nome acessível; nenhum encontrado. Console do navegador sem erros ou avisos durante a navegação.
- Validação integrada atual: 245 testes frontend e 169 testes API passaram; ESLint, build Vite, compilação TypeScript e `git diff --check` passaram. O diff-check mostra apenas avisos de conversão LF/CRLF no Windows.
- Estado do deploy permanece pendente: o workflow Coolify não tem `COOLIFY_WEBHOOK` nem `COOLIFY_TOKEN`; produção continua na revisão `07782ac8a246ab96805b5f9377d50b9f7df8d5a8`. O plano global segue aberto para continuar revisão funcional dos módulos e fazer deploy só após resolver a configuração externa com segurança.
- Sites/Monitoramento: no modo de demonstração, verificar um ativo e abrir seu histórico agora usam handlers locais persistentes; o resultado informa claramente que é simulado e não consulta a internet. Checagem real continua no backend.
- Validação após esta correção: 248 testes frontend e 169 API passaram; lint, builds frontend/API e diff-check passaram.

## Auditoria de fluxos acionáveis - 2026-10-02 (continuação)

- CRM/ficha: a associação reconhece `clientRecordId`; conflitos explícitos de ID não recorrem a nomes homônimos. A precedência de `workspaceClientId` sobre IDs legados foi mantida após um teste integrado da API apontar conflito; front e API passaram juntos.
- Tickets: status em caixa/acentuação e aliases legados são normalizados; status desconhecidos continuam visíveis na edição, e salvar sem mudança não cria atividade de histórico falsa.
- Arquivos: MIME/extensão vencem categoria visual antiga conflitante; DOCX/Google Docs entram no filtro Documentos, SVG segue imagem e ZIP permanece arquivo. Dados de exemplo agora correspondem às extensões. Playwright confirmou o filtro e excluiu ZIP dos resultados de Documentos.
- Relatórios: gráfico de receita não é escondido quando falha uma fonte alheia aos dados do gráfico. Playwright percorreu quatro abas e confirmou exportação CSV `relatorio-month-financeiro.csv`.
- Monitoramento e Meu Dia: a checagem local simulada foi exercitada e seu histórico apareceu com marca de simulação; textos visíveis sem acentuação em Monitoramento e Meu Dia foram corrigidos.
- Execução de tarefa: em demonstração local, tarefa semanal vinculada ao cliente/projeto foi criada e localizada na lista; depois foi excluída e conferi que o registro não permaneceu. Metas: formulário aberto e cancelado sem salvar.
- Validação integral após as alterações: 253 testes frontend e 169 API passaram; ESLint, build Vite, compilação TypeScript e `git diff --check` passaram. A produção continua sem publicação enquanto os secrets de Coolify do GitHub Actions não forem configurados.
- Revisão final da relação de cliente: o teste integrado da API mostrou que `workspaceClientId` precisa prevalecer sobre `clientId` legado quando coexistem. Ajustei a ordem sem permitir fallback por nome em conflito; os testes frontend/API correspondentes passaram em conjunto.
- Smoke Playwright final: as 29 rotas do menu renderizaram título e conteúdo em 1440 px e 390 px, sem overflow; navegação, filtros de arquivos, abas e exportação de Relatórios foram exercitados. Console: zero erros e zero warnings; os testes de gravação foram feitos somente no modo local e limpos antes de encerrar.

## Auditoria funcional por módulo - 2026-10-02 (continuação)

- Assinaturas: a API agora aceita as datas ISO com fuso de São Paulo que o formulário envia; formatos inválidos continuam rejeitados.
- Agenda/Calendar: editar participantes valida os endereços antes de salvar; e-mails inválidos deixam de ser descartados silenciosamente durante a sincronização.
- CRM/ficha do cliente: editar receita/despesa já paga preserva a data histórica da baixa e só registra timestamp ao liquidar uma pendência explicitamente.
- Privacidade e identidade do produto: a política não diz mais que Gmail/Drive talvez não existam; explica que dependem de autorização e que o Drive acessa somente arquivos autorizados. Exportações comerciais levam o nome Focusshub.
- Validação transversal desta rodada: 255 testes frontend e 170 API passaram; ESLint, build Vite, compilação TypeScript da API e `git diff --check` passaram. Permanecem avisos esperados de conversão LF/CRLF do Git no Windows.
- Nenhum deploy foi feito. A automação Coolify do GitHub Actions segue sem `COOLIFY_WEBHOOK` e `COOLIFY_TOKEN`; produção continua sem receber as alterações locais.
- Metas/Relatórios: metas de horas recorrem a segundos/duração quando os campos de horas e minutos estão vazios; zero explícito continua valendo como zero.
- Portal/Aprovações: status com espaços externos agora são normalizados igual na tela e na atualização atômica da API, evitando botão habilitado seguido de erro 409.
- Validação após estas correções: 256 testes frontend e 171 API passaram; ESLint, builds Vite/TypeScript e `git diff --check` passaram.
- Login/recuperação: revalidei captura e limpeza dos tokens de convite/reset, recuperação do e-mail e autenticação após redefinição; 5 testes focados e ESLint passaram, sem falha reproduzível nesta revisão.
- Sites/Monitoramento: falha agendada de DNS/URL agora atualiza o ativo para offline, registra o horário da tentativa e limpa medições/SSL antigos, sem apagar seus demais metadados. 4 testes focados e build da API passaram.
- Clicksign/n8n: revisei notificações de assinatura, envelopes, webhooks, criação/ativação de workflows e idempotência; não encontrei falha reproduzível nova e não alterei arquivos nesta frente.

## Continuação da conclusão funcional e visual - 2026-10-02

- Login, convite e recuperação: layout responsivo com painel de identidade Focusshub no desktop e formulário compacto com marca no mobile. Paleta preta/lima/branca, sem o brilho radial anterior; tema claro/escuro conferido em screenshots locais.
- CRM/pipeline: editor de oportunidade aguarda confirmação da persistência e mantém o rascunho aberto quando o salvamento falha; evita envios simultâneos.
- Financeiro: formulário originado pela ficha aguarda a resolução do cliente selecionado e não salva vínculo nulo enquanto a lista carrega ou se o ID for inválido.
- Arquivos/Drive: ficha relaciona cliente e projeto com registros reais, salva IDs e bloqueia projeto pertencente a outro cliente; registros legados por nome continuam reconhecidos.
- Inspeção Playwright do login: 1440 px e 390 px, claro/escuro; sem overflow horizontal. Uma falha de console é a resposta ausente da API no ambiente local, pois somente o servidor Vite foi iniciado para a inspeção visual.
- Validação integral: 264 testes frontend e 171 API passaram; ESLint, builds Vite e TypeScript da API e `git diff --check` passaram.
- Deploy permanece pendente. O repositório ainda tem alterações locais não publicadas e não possui segredo Coolify configurado localmente nem no GitHub Actions; produção continua na revisão anterior registrada acima.

## Revisão cruzada por agentes - 2026-10-02

- Meu Dia: a aba “Todas” passa a incluir tarefas concluídas mesmo com a preferência global de ocultá-las; essa preferência não substitui o filtro escolhido na página. Testes de regressão e ESLint passaram.
- Financeiro/ledger: saldo inicial de contas agora é validado na API em centavos, aceitando zero e valores negativos válidos e rejeitando precisão excessiva ou overflow que fariam movimentos futuros falhar.
- Tickets: no instante exato do vencimento, o ticket já é contado como vencido e recebe o estado “Vencido agora”. Testes cobrem estado, rótulo e contador.
- Sites e domínios: editar ativo legado sem URL não transforma o nome de exibição em endereço monitorado; domínio sem esquema é normalizado para HTTPS e URLs incompatíveis com o monitor são bloqueadas.
- Validação integrada depois desta rodada: 269 testes frontend e 172 API passaram; ESLint, build Vite, compilação TypeScript da API e `git diff --check` passaram. Permanecem somente avisos de conversão LF/CRLF do Git no Windows.
- Nenhum commit ou deploy foi feito. O bloqueio de publicação permanece: secrets `COOLIFY_WEBHOOK` e `COOLIFY_TOKEN` ausentes no GitHub Actions e no ambiente local; produção ainda está na revisão anterior registrada neste plano.
- Equipe/Atendimento: membros com permissão de suporte agora podem ler, marcar como lida e enviar mensagens pela caixa Hostinger conectada. Configuração e remoção da integração ficaram restritas à pessoa proprietária; testes também cobrem o bloqueio para administradores.
- Revalidação da API após este ajuste: 173 testes passaram, build TypeScript da API passou e `git diff --check` passou (avisos LF/CRLF esperados do Windows).
- Portal do cliente: a validação de comentário para pedidos de ajuste agora também é aplicada na API pública, não apenas na tela; envios diretos sem pelo menos 3 caracteres são recusados. Teste focal 4/4.
- Suíte completa após a correção: 269 testes frontend e 174 API passaram; ESLint, builds Vite/TypeScript e `git diff --check` passaram. Segue sem deploy por falta de credenciais Coolify nos secrets do repositório.
- CRM/ficha do cliente: datas de lançamento em formato civil `YYYY-MM-DD` não são mais convertidas para o dia anterior ao montar o histórico no fuso `America/Sao_Paulo`; timestamps completos mantêm data e hora. 17 testes focados, ESLint e diff-check passaram.
- Cobranças/Assinaturas: vencimentos e próximas cobranças agora são exibidos no fuso `America/Sao_Paulo`, em vez do fuso do navegador, evitando avanço de um dia em dispositivos em fusos adiantados. 10 testes focados passaram.
- Validação integrada depois dessas correções: 273 testes frontend, 174 testes API, ESLint, builds Vite/TypeScript e `git diff --check` passaram; deploy continua pendente pelos 0 secrets de Actions e ausência de credenciais Coolify locais.
- Revisão de serviços do repositório: deploy usa Docker Compose/Coolify via GitHub Actions e dependências npm; não há configuração de Vercel, Wrangler/Cloudflare, Supabase ou Railway. `git pull`/`push` usam a SSH deploy key isolada do repositório e foram verificados.
- Permissões Google Drive: membros com `support.read` podem listar os arquivos; editar metadados exige `support.read` e `support.write`; overrides continuam aplicados e ações de OAuth/compartilhamento permanecem restritas. 12 testes de autorização passaram.
- UI guidelines: `lang="pt-BR"`, link para conteúdo principal, imagens com dimensões e texto alternativo, suporte a movimento reduzido, `color-scheme` por tema e foco visível; nenhuma regra `transition: all` ou `outline: none` sem substituição foi encontrada. Em mobile (390 px do Playwright / 375 px úteis), Integrações renderizou sem overflow e CTAs ocuparam a largura do cartão.
- Tema mobile: a meta `theme-color` acompanha os fundos reais (#f5f6f2 claro, #111412 escuro); Playwright confirmou a troca do meta e do color-scheme em cada alternância.
- Validação completa mais recente: 273 testes frontend e 175 API passaram; ESLint, build Vite, build TypeScript da API e `git diff --check` passaram. Playwright em Integrações: console 0 erros e 0 warnings.
- Autenticação de deploy revalidada sem mudar conta global: `git ls-remote origin HEAD` e `git push --dry-run origin HEAD:refs/heads/main` funcionam com `core.sshCommand` local e a chave `id_ed25519_nexo_workspace`; SSH confirmou a deploy key de `focussdevserv/nexo-workspace`. A leitura feita com a conta GitHub isolada `focussdevserv` confirmou 0 secrets de Actions. Não há variáveis Coolify de processo/usuário/máquina, arquivo `.env` local ou janela Coolify aberta; resta configurar credenciais de deploy antes de publicar.

- Retificação da validação integrada mais recente: foram **273 testes frontend e 175 testes API** (não 174); lint, build do frontend, build TypeScript da API e diff-check passaram. Auditoria segue em execução por módulos, sem deploy por ausência dos secrets Coolify no GitHub Actions.

- Agenda: corrigida a apresentação de compromissos editados para dia inteiro; a grade agora respeita o indicador allDay, mesmo com horários antigos no registro. Testes focados 6/6 e lint passaram.
- Mensagens do Financeiro: removida codificação corrompida (máximo) nas respostas de validação de saldo da API.
- Revisão adicional de recorrência financeira: não foi encontrada falha reproduzível; cálculo mensal preserva o dia âncora e valida datas/limites.

- Tickets: as ações de linha agora localizam o chamado pelo ID do registro, evitando falha ou seleção errada quando códigos se repetem; fallback mantém compatibilidade com dados antigos. 11 testes focados passaram.
- Arquivos/Drive: documentos nativos sem tamanho informado deixam de aparecer como 0 MB; tamanho explicitamente igual a zero continua válido. 2 testes focados passaram.

- Validação integrada após correções de Agenda, Tickets e Drive: 280 testes frontend e 175 testes API passaram; ESLint, build Vite, build TypeScript da API e diff-check passaram. Deploy segue pendente por falta das credenciais Coolify no GitHub Actions.

- CRM/ficha de contato: remoção agora funciona também para contatos legados sem ID; registros com ID seguem usando correspondência exata. Contatos não encontrados continuam sendo recusados. 23 testes focados do CRM passaram.

- Smoke visual local do CRM mobile em 375 px: sem overflow horizontal da página (375/375 px), console 0 erros/0 avisos; navegação testada com dados fictícios locais.

- CRM/Contratos: o salvamento agora persiste o texto editado; depois de enviado a Clicksign, o documento fica bloqueado para edicao. 7 testes focados passaram.

- WhatsApp/Atendimento: botoes de vinculo, QR e controle de sessao agora ficam apenas para owner, conforme as regras da API; admins continuam vendo sessao e atendendo conversas conectadas sem receber 403 em loop. Teste focado 1/1 passou.
- Metas: negocios ganhos agora contam pela data de conversao/fechamento, depois atualizacao e, para registros legados, criacao. Regressoes focadas cobrem conversoes recentes e antigas; 25 testes de metas/relatorios/navegacao passaram.

- Validacao mais recente incluindo todas as correcoes desta rodada: 286 testes frontend e 175 testes API passaram; ESLint, build Vite, build TypeScript da API e git diff --check passaram.

- Cobranças/Assinaturas: o campo de data final agora impede selecionar o mesmo dia de início, evitando o erro no envio; o limite mínimo segue corretamente para o próximo dia mesmo na virada do mês/ano. Testes focados 4/4 passaram.

- Meu Dia: o indicador de projetos ativos agora conta estados ativos reconhecidos e ignora projetos aguardando cliente, a fazer, arquivados ou com status desconhecido; aliases legados normalizados continuam válidos. 10 testes da dashboard passaram.

- Validacao integrada da rodada ate Cobranças/Assinaturas e Meu Dia: 289 testes frontend e 175 testes API passaram; ESLint, build Vite, build TypeScript da API e diff-check passaram.

- Caixa de entrada: busca agora encontra conversas por e-mail e telefone; telefones são comparados também sem pontuação e exigem ao menos quatro dígitos. Testes focados 4/4 passaram.

- Projetos: tarefas legadas sem projectId deixam de ser duplicadas entre projetos homonimos; nome so vincula quando a correspondencia e unica ou o cliente resolve a ambiguidade. 7 testes focados passaram.

- Horas: o editor usa a duracao em segundos gravada, em vez de arredondar horas e alterar o tempo ao salvar sem mudanca. Entradas curtas e timestamps continuam consistentes. 13 testes focados passaram.

- Validacao integrada mais recente, incluindo Caixa de entrada, Projetos e Horas: 295 testes frontend e 175 testes API passaram; ESLint, Vite, build TypeScript da API e git diff --check passaram.

- Tarefas: dependencias agora reconhecem a tarefa anterior como concluida se qualquer campo de estado valido (status ou state) registrar conclusao; corrige registros legados inconsistentes. Testes focados 14/14 passaram.

- Configuracoes: importar preferencias agora pede confirmacao se havia edicoes nao salvas; cancelar mantem o estado, e o seletor de arquivo e liberado para tentar outro arquivo. Testes focados 5/5 passaram.

- Aprovações/Portal: a decisao agora bloqueia e relê a aprovação dentro da transação, revalidando status e cliente antes de gravar. Evita corrida que sobrescrevia metadados recentes ou aceitava vínculo alterado; API: 177 testes passaram.

- Catálogo de Serviços: parser de preços agora trata corretamente separadores brasileiros de milhar/centavos; um serviço de R$ 2.500,00 passa a preencher contratos e cálculos de média/margem sem virar NaN. 9 testes focados passaram.

- Notificacoes: clicar em avisos de tarefas, eventos e clientes agora abre o registro correspondente, nao apenas a tela do modulo; inclui alerta do browser e tipo legado client. Testes focados 5/5 passaram.

- Conta/Equipe: suspensao e reemissao de convite invalidam cookies antigos; aceitar convite assina sessao com a versao persistida, inclusive apos revogacoes legadas. Regressao especifica; API 178/178 e build passaram.

- Validacao integrada apos Catalogo, Notificacoes, Configuracoes, Aprovações e revogacao de sessao: 301 testes frontend e 178 testes API passaram; lint, build Vite, TypeScript API e diff-check passaram.

- Sites/Monitoramento: checagens manuais agora mantem estado ocupado independente por ativo; concluir a consulta de um nao reabilita prematuramente outro nem permite duplicar chamada. 6 testes focados passaram.

- Leads/Conversao: converter lead ganho que ja corresponde a cliente existente agora vincula o servico vendido sem apagar servicos anteriores ou duplicar itens; normaliza nome/IDs e mantem idempotencia. Testes focados 8/8 e build API passaram.

- Financeiro/Contas: excluir movimentacao avulsa agora recalcula saldo em centavos e arquiva movimento/saldo na mesma transacao; evita ledger divergente. Transferencias pareadas nao aceitam exclusao unilateral. API 181/181 e build passaram.

- Validacao integrada mais recente: 302 testes frontend e 181 testes API passaram; ESLint, build Vite, build TypeScript da API e git diff --check passaram.

- Automacoes/n8n: deduplicacao da tarefa de proposta aceita agora distingue tarefa da automacao do checklist padrao do projeto; replay continua idempotente sem perder o acompanhamento prometido. 12 testes n8n/entrega e build API passaram.

- Google Drive/upload: endpoint agora valida suporte.write antes de enviar ao provedor e, com taskId, exige permissao de escrita/escopo da tarefa. Bloqueia anexo fora do escopo. API 182/182 passou.

- Relatorios/Financeiro: data de pagamento efetivo agora usa a aprovacao do provedor e permanece estavel entre refreshes/webhooks; registros legados usam paidAt persistido ou updatedAt anterior. Relatorios usam paidAt. API 188/188, relatorios 16/16 e builds passaram.

- Validacao integrada final desta rodada: 303 testes frontend e 188 testes API passaram; ESLint, build Vite, build TypeScript da API e git diff --check passaram.

- Checagem de producao apos as alteracoes: health respondeu status ok e banco conectado; revisao ainda 07782ac8a246ab96805b5f9377d50b9f7df8d5a8, anterior ao worktree. Deploy segue bloqueado pelos secrets Coolify ausentes.

- Meu Dia: filtros de tarefas agora priorizam qualquer campo que indique conclus?o, evitando que registros legados com status conflitantes apare?am como pendentes. Arquivos/Drive: membros com escopo selecionado precisam escolher cliente ou projeto autorizado antes do envio ou v?nculo, e o registro persiste esse v?nculo; evita upload remoto ?rf?o.
- Auditoria visual local: 29 rotas do menu renderizaram em viewport de 375 px, nos temas claro e escuro, sem overflow horizontal; console sem erros e sem avisos.
- Valida??o integrada desta rodada: 306 testes frontend e 188 API passaram; ESLint, build Vite, build TypeScript da API e git diff --check passaram. Deploy ainda n?o foi executado: os secrets COOLIFY_WEBHOOK e COOLIFY_TOKEN continuam ausentes no GitHub Actions.

- CRM/ficha financeira: cobran?as com status de provedor `paid`, `cancelled` ou `canceled` agora deixam de ser contadas como abertas; os normalizadores compartilhados tratam tamb?m r?tulos locais. Testes focados 15/15.
- Login/recupera??o: os modos de recuperar senha acompanham voltar/avan?ar do navegador e removem tokens sens?veis ao retornar ao login. Testes de helper/navega??o 6/6.
- Sites/Monitoramento: excluir um ativo agora remove as agendas de checagem vinculadas (IDs num?ricos e texto), antes de remover o ativo; evita agenda ?rf? no worker. Testes 6/6.
- Textos de interface: corrigidos acentos substitu?dos por `?` em mensagens de Atendimento, Monitoramento, Arquivos e Configura??es.
- Valida??o integrada: 308 testes frontend e 188 API passaram; ESLint, build Vite, build TypeScript da API e git diff --check passaram. Deploy ainda indispon?vel pelos secrets Coolify ausentes.

- Atendimento/WhatsApp: ao trocar de conversa, a resposta agora usa primeiro a sess?o ativa vinculada ao contato; sess?o pausada n?o preserva indevidamente o n?mero selecionado na conversa anterior. Testes focados 21/21.
- Portal do cliente: mensagens compostas apenas por espa?os s?o bloqueadas e o conte?do enviado ? aparado; evita chamadas que a API recusaria. Testes focados 7/7.
- Metas: receita recebida usa `paidAt`/`paymentDetails.paidAt` para cobran?as e `settledAt` para receitas manuais antes de `updatedAt`/`date`; testes de Metas/Relat?rios 23/23.
- Marca: mensagens de erro e e-mails voltados ao usu?rio da API agora identificam o app como Focusshub; nomes de protocolo e cabe?alhos internos permanecem compat?veis.
- Valida??o integrada atual: 313 testes frontend e 188 API passaram; ESLint, build Vite, build TypeScript da API e `git diff --check` passaram. Segue sem deploy pelos secrets Coolify ausentes no GitHub Actions.
- Validacao Focusshub atual: 963 testes frontend e 349 API passaram; lint, Vite build, API TypeScript build e validacao de 36 telas passaram. Chrome headless local conferiu 37 destinos de menu e a rota publica de captura.
- CRM/captura publica: eventos lead.created agora entram no outbox n8n na mesma transacao do lead e da tarefa; o worker inicia depois do commit. A API nao confirma um lead sem persistir tambem a automacao aplicavel.
- Limite desta validacao: a rota de intake foi revisada por testes de contrato estaticos e helpers, sem banco real. O erro reportado em Contatos na sessao real nao foi reproduzido no ambiente local. Deploy continua bloqueado pela indisponibilidade do acesso/secrets Coolify descrita acima.
