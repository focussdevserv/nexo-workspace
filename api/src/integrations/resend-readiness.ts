export type ResendReadinessInput = {
  verifiedDomainCount: number;
  senderConfigured: boolean;
  senderMatchesVerifiedDomain: boolean;
};

export function resendOperationalReadiness(input: ResendReadinessInput) {
  const missing: string[] = [];
  if (input.verifiedDomainCount === 0) missing.push('verifique pelo menos um domínio no Resend');
  if (!input.senderConfigured) missing.push('configure RESEND_FROM_EMAIL com um e-mail válido');
  else if (!input.senderMatchesVerifiedDomain) missing.push('use um remetente pertencente a um domínio verificado');
  return {
    status: missing.length === 0 ? 'connected' as const : 'setup_required' as const,
    missing,
  };
}
