import { z } from 'zod';
import { normalizeLeadEmail, normalizeLeadPhone } from './lead-identity.js';

export const publicLeadPayloadSchema = z.object({
  name: z.string().trim().min(2).max(180),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(180).optional(),
  message: z.string().trim().max(4000).optional(),
  contactConsent: z.literal(true),
  marketingConsent: z.boolean().default(false),
  website: z.string().max(200).optional(),
  startedAt: z.number().int().positive(),
}).strict().refine((data) => Boolean(data.email || isPublicLeadPhoneValid(data.phone)), { message: 'Informe um e-mail válido ou um telefone com ao menos oito dígitos.' });

export function isPublicLeadPhoneValid(value: unknown) {
  const digits = normalizeLeadPhone(value);
  return digits.length >= 8 && digits.length <= 15;
}

export function publicLeadIsSpam(payload: { website?: string; startedAt: number }, now = Date.now()) {
  return Boolean(payload.website) || payload.startedAt > now || now - payload.startedAt < 1500 || now - payload.startedAt > 24 * 60 * 60 * 1000;
}

export function publicLeadTaskData(name: string, leadId: string, message?: string) {
  return { title: `Retornar para ${name}`, description: message || 'Novo lead recebido pelo formulário público.', status: 'Pendente', priority: 'Média', dueDate: new Date().toISOString().slice(0, 10), leadId, source: 'public-lead-form' };
}

export function normalizePublicLeadContact<T extends { email?: string; phone?: string }>(value: T) {
  const phone = normalizeLeadPhone(value.phone);
  return { ...value, email: normalizeLeadEmail(value.email), phone: phone.length >= 8 && phone.length <= 15 ? phone : '' };
}

export function firstActiveLeadStage(value: unknown) {
  const stages = value && typeof value === 'object' && Array.isArray((value as { stages?: unknown }).stages)
    ? (value as { stages: unknown[] }).stages : [];
  return stages.find((stage): stage is string => typeof stage === 'string' && stage.trim() !== '' && stage !== 'Fechado' && stage !== 'Perdido') ?? 'Novo lead';
}
