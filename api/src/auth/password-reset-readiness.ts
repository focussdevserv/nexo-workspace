export function passwordResetDeliveryReadiness(apiKey: string | undefined, from: string | undefined) {
  const configured = Boolean(apiKey?.trim() && from?.trim());
  return configured
    ? { statusCode: 202 as const }
    : {
      statusCode: 503 as const,
      error: 'password_reset_unavailable',
      message: 'A recuperação de senha está indisponível no momento. Contate a pessoa administradora do workspace.',
    };
}
