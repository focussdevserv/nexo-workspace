export function repositoryConnectionState({ loading = false, error = '', status = null } = {}) {
  if (loading) return { label: 'Consultando…', hint: 'verificando conexão com GitHub', available: false };
  if (error) return { label: 'Indisponível', hint: error, available: false };
  if (!status?.configured) return { label: 'Não conectado', hint: 'configure GITHUB_TOKEN no Coolify', available: false };
  if (!status.enabled) return { label: 'Desconectado', hint: 'a integração está desativada', available: false };
  if (status.lastTestStatus === 'connected') return { label: 'Conectado', hint: 'identidade verificada pela API', available: true };
  return { label: 'Token presente', hint: 'teste a conexão no painel de Integrações', available: true };
}
