export function repositoryRegistrationIssue({ repos = [], owner = '', name = '', loading = false } = {}) {
  if (loading) return 'Aguarde o carregamento dos repositórios antes de salvar.';
  const normalizedOwner = String(owner).trim().toLocaleLowerCase('pt-BR');
  const normalizedName = String(name).trim().toLocaleLowerCase('pt-BR');
  if (!normalizedOwner || !normalizedName) return 'Informe o proprietário ou organização e o nome do repositório.';
  if (normalizedOwner.length > 39) return 'O nome de usuário ou organização pode ter até 39 caracteres.';
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(normalizedOwner)) {
    return 'Informe o usuário ou a organização do GitHub sem URL, barras, espaços ou hífen nas extremidades.';
  }
  if (normalizedName.length > 100) return 'O nome do repositório pode ter até 100 caracteres.';
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?$/.test(normalizedName)) {
    return 'Informe apenas o nome válido do repositório GitHub, sem URL, barras, espaços ou ponto final.';
  }
  const duplicate = repos.some((repo) => String(repo.owner || '').trim().toLocaleLowerCase('pt-BR') === normalizedOwner
    && String(repo.name || '').trim().toLocaleLowerCase('pt-BR') === normalizedName);
  return duplicate ? 'Este repositório já está cadastrado neste workspace.' : '';
}
