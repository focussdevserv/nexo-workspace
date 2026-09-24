const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function contractText(contract = {}) {
  const scope = contract.scope || contract.service || '[DESCREVER O ESCOPO E OS ENTREGÁVEIS]';
  const terms = contract.paymentTerms || '[DEFINIR VALORES, PARCELAS E VENCIMENTOS]';
  const prazo = contract.deadline || '[DEFINIR PRAZO E MARCO INICIAL]';
  return [
    `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DIGITAIS — ${contract.title || '[TÍTULO DO PROJETO]'}`,
    '',
    '1. PARTES',
    'CONTRATADA: [RAZÃO SOCIAL/NOME], CNPJ/CPF [DOCUMENTO], com sede em [ENDEREÇO], e-mail [E-MAIL], neste ato representada por [REPRESENTANTE].',
    `CONTRATANTE: ${contract.client || '[RAZÃO SOCIAL/NOME DO CLIENTE]'}, CNPJ/CPF [DOCUMENTO], com sede/endereço em [ENDEREÇO], e-mail [E-MAIL], neste ato representada por [REPRESENTANTE].`,
    '',
    '2. OBJETO E ESCOPO',
    `A CONTRATADA executará: ${scope}. Itens, quantidades, integrações, conteúdo, limitações e critérios de aceite devem ser detalhados nesta proposta/anexo antes da assinatura.`,
    '',
    '3. PRAZO E DEPENDÊNCIAS',
    `Prazo estimado: ${prazo}. A contagem começa após a assinatura, confirmação da entrada (se prevista) e recebimento dos materiais e acessos necessários. Atrasos do CONTRATANTE podem alterar o cronograma.`,
    '',
    '4. PREÇO E PAGAMENTO',
    `Preço contratado: ${contract.value || '[DEFINIR VALOR]'}. Condições: ${terms}. Serviços adicionais, taxas de terceiros, licenças, mídia, hospedagem e domínios só serão cobrados conforme aprovação expressa.`,
    '',
    '5. APROVAÇÕES E ALTERAÇÕES',
    'O CONTRATANTE fornecerá feedback consolidado nos prazos combinados. O número de rodadas de revisão e o que constitui mudança de escopo devem ser preenchidos na proposta. Alterações fora do escopo dependem de orçamento e prazo aprovados por escrito.',
    '',
    '6. OBRIGAÇÕES DAS PARTES',
    'A CONTRATADA executará os serviços com diligência e manterá o CONTRATANTE informado sobre dependências relevantes. O CONTRATANTE fornecerá informações, materiais, acessos e aprovações, e declara possuir direitos ou autorizações para os materiais que entregar.',
    '',
    '7. DIREITOS SOBRE OS MATERIAIS',
    'A titularidade e a licença de uso de entregáveis, componentes preexistentes, bibliotecas e materiais de terceiros devem ser descritas para este projeto. A transferência ou licença dos entregáveis finais e a entrega de arquivos-fonte ficam condicionadas ao pagamento integral, salvo ajuste escrito diferente.',
    '',
    '8. HOSPEDAGEM, DOMÍNIO E SERVIÇOS DE TERCEIROS',
    'Renovações, limites, responsabilidades e custos de domínio, hospedagem, APIs e plataformas externas devem ser indicados na proposta. Serviços de terceiros estão sujeitos às próprias condições e disponibilidade.',
    '',
    '9. SUPORTE E MANUTENÇÃO',
    'Suporte, manutenção, atualizações e prazos de atendimento só estão incluídos quando descritos expressamente no escopo ou em plano recorrente contratado.',
    '',
    '10. CONFIDENCIALIDADE E DADOS PESSOAIS',
    'As partes usarão informações confidenciais e dados pessoais apenas para executar este contrato, adotarão medidas razoáveis de proteção e tratarão responsabilidades, instruções, retenção e descarte de dados conforme aplicável e conforme anexo de proteção de dados, se necessário.',
    '',
    '11. VIGÊNCIA E ENCERRAMENTO',
    'Vigência e condições para rescisão, aviso prévio, valores de etapas já executadas e transição devem ser preenchidos pelas partes antes da assinatura.',
    '',
    '12. DISPOSIÇÕES FINAIS',
    'Este instrumento e seus anexos representam o acordo das partes sobre o escopo aqui descrito. Alterações devem ser registradas por escrito. Foro: [CIDADE/UF], observadas as regras legais aplicáveis.',
    '',
    '[CIDADE/UF], [DATA].',
    '',
    'CONTRATADA: ______________________________    CONTRATANTE: ______________________________',
    'Nome: [PREENCHER]                              Nome: [PREENCHER]',
    'Documento: [PREENCHER]                         Documento: [PREENCHER]',
    '',
    'TESTEMUNHA 1: _____________________________    TESTEMUNHA 2: _____________________________',
    'Nome/Documento: [PREENCHER]                    Nome/Documento: [PREENCHER]',
    '',
    'MODELO BASE: revise os campos entre colchetes, anexos e cláusulas comerciais para cada contratação. Faça revisão jurídica antes do primeiro uso externo.',
  ].join('\n');
}

export function downloadContract(contract) {
  const content = contractText(contract);
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${escapeHtml(contract.title || 'Contrato')}</title><style>body{font:15px/1.65 Arial,sans-serif;max-width:820px;margin:48px auto;padding:0 28px;color:#182338;white-space:pre-wrap}h1{font-size:23px}</style><body>${escapeHtml(content)}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${String(contract.code || contract.title || 'contrato').replace(/[^a-z0-9_-]+/gi, '-')}.html`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
