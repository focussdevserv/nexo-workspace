const publicLegalPageMetadata = {
  privacy: {
    title: 'Focusshub · Política de Privacidade',
    description: 'Entenda como o Focusshub Workspace trata os dados usados para operar o serviço e suas integrações.',
  },
  terms: {
    title: 'Focusshub · Termos de Uso',
    description: 'Consulte as condições de uso do Focusshub Workspace, incluindo responsabilidades e integrações.',
  },
};

export function getPublicLegalPageMetadata(type) {
  return publicLegalPageMetadata[type === 'privacy' ? 'privacy' : 'terms'];
}
