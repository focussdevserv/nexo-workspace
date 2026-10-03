export function inboxDeliveryStatusLabel(status) {
  if (status === 'sending') return 'Enviando…';
  if (status === 'unknown') return 'Envio sem confirmação. Confira o WhatsApp antes de enviar outra mensagem.';
  if (status === 'failed') return 'Não enviado.';
  return '';
}
