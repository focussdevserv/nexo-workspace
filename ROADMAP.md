# Nexo — plano de construção

## Objetivo

Construir o workspace da agência em módulos pequenos, conectados e utilizáveis. O fluxo principal do produto é:

**Lead → cliente → proposta → contrato → cobrança → projeto → entrega/aprovação → suporte → recorrência.**

O painel deve manter um registro central de clientes, projetos, tarefas e eventos. Integrações enviam e recebem eventos; elas não substituem os dados e regras do Nexo.

## Como vamos trabalhar

Vamos concluir primeiro a camada de interface inteira, percorrendo os módulos de baixo para cima no menu. Nesta primeira fase, formulários, navegação, estados vazios, filtros, confirmações e ações devem funcionar com dados locais e deixar explícito quando uma ação é apenas uma simulação. Depois conectaremos API, banco e integrações reais.

Um módulo só passa para “pronto para produção” quando tiver:

- interface navegável em desktop e celular;
- dados persistidos na API e banco, quando o módulo usar dados;
- estados de carregamento, vazio, erro e sucesso;
- validação e permissões no servidor;
- vínculo com a ficha do cliente e histórico, quando aplicável;
- fluxo de uso conferido no navegador e critérios de aceite registrados.

### Fase atual — Front-end completo

- Todos os itens do menu devem abrir uma tela própria.
- Ações locais devem persistir no navegador durante a construção da interface.
- Não armazenar credenciais secretas no navegador.
- Não apresentar simulações como cobranças, mensagens, assinaturas ou deploys reais.
- Depois de fechar a navegação completa, iniciar fundação técnica e substituir o armazenamento local pela API.

Integrações externas começam em ambiente de teste. Chaves e tokens ficam no servidor, fora do Git e do código do navegador.

## Arquitetura inicial recomendada

- **Interface:** React + Vite, mantendo o protótipo atual.
- **API:** Node.js + TypeScript, organizada por módulos; Fastify é uma opção enxuta para começar.
- **Banco:** PostgreSQL com Drizzle e migrações versionadas. Definir relações antes de conectar os módulos.
- **VPS:** Docker Compose para interface, API, banco e proxy HTTPS. Banco sem porta pública e backups em destino separado.
- **Arquivos:** Google Drive como integração de documentos; guardar no Nexo os metadados e os vínculos.
- **Automações:** n8n para conectar serviços e enviar notificações. O Nexo continua sendo a fonte de verdade para status, permissões e histórico.

Essa arquitetura é uma proposta inicial para validar; decisões de provedor e credenciais serão fechadas quando chegarmos a cada módulo.

## Etapas, na ordem

### 0. Fundação técnica

**Entregar:** estrutura organizada, API, PostgreSQL, migrações, autenticação, usuários, permissões iniciais, registro de atividades, variáveis de ambiente, ambiente local e implantação de teste no VPS.

**Aceite:** entrar e sair do sistema; usuário sem permissão não acessa dados protegidos; dados de teste permanecem após reiniciar os serviços; backup pode ser restaurado; segredos não aparecem no repositório.

### 1. Meu Dia — dashboard

**Estado atual:** tela React navegável com conteúdo demonstrativo. A interface foi aproximada da referência e se adapta a desktop e celular; ainda não usa API ou dados reais.

**Entregar:** conectar os cards, agenda, tarefas, leads, pendências e atividade aos módulos reais. Remover ações que hoje só exibem avisos e implementar seus destinos.

**Aceite:** indicadores vêm da API; cada item abre o módulo ou registro correto; filtros e estados funcionam; dashboard vazio e com erro também têm apresentação clara.

### 2. CRM e perfil completo do cliente

**Entregar:** leads, pipeline, empresas, contatos, conversão lead → cliente e ficha única com serviços, projetos, propostas, contratos, pagamentos, conversas, reuniões, arquivos, tickets e histórico.

**Aceite:** localizar e atualizar um lead; mover pelo pipeline; converter em cliente sem perder histórico; abrir uma ficha e encontrar todos os registros vinculados.

### 3. Catálogo, propostas e contratos

**Entregar:** catálogo de serviços, modelos de proposta e contrato, escopo, preço, prazo, status e envio para assinatura eletrônica. Selecionar e integrar o provedor de assinatura nesta etapa.

**Aceite:** montar uma proposta para um cliente, registrar aceite/recusa e acompanhar a assinatura; documento assinado e eventos ficam associados ao perfil.

### 4. Projetos, tarefas e horas

**Entregar:** projetos, etapas, templates por serviço, tarefas/subtarefas, responsáveis, prazos, anexos, comentários, timer e progresso. A aprovação de proposta/contrato prepara a criação do projeto.

**Aceite:** criar projeto a partir de um template, acompanhar tarefas e prazo, registrar horas e consultar o progresso pela ficha do cliente.

### 5. Agenda e Google Workspace

**Entregar:** agenda interna; sincronização com Google Calendar; criação de link do Meet; registro de e-mails relevantes pelo Gmail; documentos do cliente ligados ao Drive.

**Aceite:** criar/alterar/cancelar reunião e manter o estado sincronizado; mostrar a reunião na ficha e no Meu Dia; abrir arquivos com permissões corretas. Começar com escopos OAuth mínimos.

### 6. Financeiro, cobranças e recorrências

**Entregar:** receitas/despesas básicas, cobranças avulsas, parcelas e mensalidades; integração Mercado Pago em teste; webhooks verificados e idempotentes; notificações de vencimento.

**Aceite:** criar cobrança para cliente, receber confirmação verificada e atualizar o painel; tratar pendente, recusada, vencida, cancelada e estornada; lembrete não é enviado após o pagamento.

### 7. Atendimento e tickets

**Entregar:** caixa de entrada, conversas vinculadas ao cliente, atribuição, histórico, envio de mídia e tickets. Escolher Evolution API ou WAHA antes da integração. Gmail pode ser conectado gradualmente.

**Aceite:** receber mensagem por webhook, associar ao contato, responder pelo canal e registrar a mensagem; encaminhar atendimento para responsável; pausar follow-up quando houver resposta.

### 8. Arquivos, aprovações e portal do cliente

**Entregar:** documentos organizados por cliente/projeto; aprovações de entregáveis; acesso externo do cliente para ver projeto, arquivos, pagamentos, propostas e suporte.

**Aceite:** cliente acessa apenas seus próprios registros; pode aprovar ou pedir ajuste; decisão fica registrada com data e autor.

### 9. Sites e operações técnicas

**Entregar:** inventário de sites, domínios e hospedagens; links de GitHub; sinais de deploy; Sentry; verificações de uptime/SSL e alertas ligados a projetos.

**Aceite:** alerta cria ou atualiza um incidente vinculado ao cliente/site; alertas repetidos são agrupados; recuperação atualiza o incidente.

### 10. Automações, relatórios e assistente

**Entregar:** fluxos n8n para notificações e rotinas aprovadas; métricas comerciais/financeiras; depois, assistente de IA com permissões e confirmação para ações sensíveis.

**Aceite:** automações podem ser auditadas, repetidas sem duplicar ações e pausadas; ações da IA mostram o que será alterado e registram o resultado.

## Fluxos prioritários

1. **Formulário do site → lead no CRM → tarefa de retorno → aviso ao responsável.**
2. **Proposta aceita → contrato → assinatura → projeto baseado em template → cobrança.**
3. **Pagamento confirmado pelo Mercado Pago → atualizar cobrança → cancelar lembretes → notificar equipe.**
4. **Reunião criada → Calendar/Meet → confirmação e lembrete → atividade no histórico do cliente.**
5. **Mensagem recebida → associar conversa ao cliente → atribuir atendente → suspender follow-up agendado.**

## Agentes de apoio

- **Interface e UX:** componentes, navegação, responsividade e critérios de conclusão dos módulos.
- **Backend e dados:** API, banco, autenticação, permissões e implantação no VPS.
- **Integrações e automações:** WhatsApp, Google, Mercado Pago, n8n, GitHub, Sentry e uptime.

Os agentes atuam como revisores especializados por etapa. A implementação e a integração das mudanças ficam coordenadas no workspace principal.
