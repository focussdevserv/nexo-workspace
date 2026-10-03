export function canUseWorkspaceBackup({ isOwner, localDemo }) {
  return isOwner === true && localDemo === false;
}

export function workspaceBackupUnavailableReason({ isOwner, localDemo }) {
  if (!isOwner) return 'Somente a pessoa proprietária pode exportar ou restaurar o backup deste workspace.';
  if (localDemo) return 'Backup do workspace indisponível na demonstração local. Os dados de demonstração ficam isolados neste navegador; nenhum arquivo será tratado como backup real.';
  return '';
}
