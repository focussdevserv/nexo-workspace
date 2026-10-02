import { z } from 'zod';
import { isSafeWorkspaceData } from './security/workspace-data.js';

const timestamp = z.string().datetime({ offset: true });
const nullableTimestamp = timestamp.nullable();
const uuid = z.string().uuid();
const safeRecord = z.record(z.string(), z.unknown()).refine(isSafeWorkspaceData);
const backupResource = z.enum([
  'leads', 'clients', 'companies', 'contacts', 'proposals', 'services', 'contracts', 'projects', 'tasks', 'events',
  'approvals', 'files', 'hours', 'inbox', 'tickets', 'site-assets', 'monitors', 'expenses', 'revenues',
  'finance-accounts', 'finance-transactions', 'goals', 'team', 'repositories', 'automations', 'settings',
]);

const workspaceRecord = z.object({
  id: uuid,
  resource: backupResource,
  data: safeRecord,
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedAt: nullableTimestamp,
}).strict();

const clientRecord = z.object({
  id: uuid, name: z.string().min(1).max(180), legalName: z.string().max(180).nullable(), contactName: z.string().max(180).nullable(),
  email: z.string().max(254).nullable(), phone: z.string().max(40).nullable(), document: z.string().max(40).nullable(),
  status: z.enum(['active', 'inactive', 'archived']), source: z.string().max(100).nullable(), notes: z.string().max(5000).nullable(), tags: z.array(z.string().max(40)).max(30),
  createdAt: timestamp, updatedAt: timestamp, archivedAt: nullableTimestamp,
}).strict();

const billingOrder = z.object({
  id: uuid, clientId: uuid.nullable(), workspaceClientId: uuid.nullable(), clientName: z.string().min(1).max(180),
  payerEmail: z.string().email().max(254), description: z.string().min(1).max(250), amount: z.number().finite().nonnegative().max(1_000_000), method: z.enum(['pix', 'boleto', 'credit_card', 'debit_card']),
  status: z.string().min(1).max(40), statusDetail: z.string().max(200).nullable(), mpOrderId: z.string().max(200).nullable(),
  mpPaymentId: z.string().nullable(), mercadoPagoAccountId: z.string().max(100).nullable().optional(), paymentDetails: safeRecord, dueAt: nullableTimestamp,
  createdAt: timestamp, updatedAt: timestamp,
}).strict();

const billingSubscription = z.object({
  id: uuid, clientId: uuid.nullable(), workspaceClientId: uuid.nullable(), clientName: z.string().min(1).max(180),
  payerEmail: z.string().email().max(254), description: z.string().min(1).max(250), amount: z.number().finite().nonnegative().max(1_000_000), frequency: z.enum(['days', 'months']),
  frequencyInterval: z.number().int().positive().max(366), status: z.string().min(1).max(40), mpSubscriptionId: z.string().max(200).nullable(), mercadoPagoAccountId: z.string().max(100).nullable().optional(),
  checkoutUrl: z.string().max(2048).nullable(), nextPaymentAt: nullableTimestamp, createdAt: timestamp, updatedAt: timestamp,
}).strict();

export const workspaceBackupSchema = z.object({
  format: z.literal('nexo-workspace-backup'),
  version: z.literal(1),
  organizationId: uuid,
  exportedAt: timestamp,
  excludedRecords: z.number().int().nonnegative(),
  records: z.array(workspaceRecord).max(100_000),
  clients: z.array(clientRecord).max(100_000),
  billingOrders: z.array(billingOrder).max(100_000),
  billingSubscriptions: z.array(billingSubscription).max(100_000),
}).strict().superRefine((backup, context) => {
  for (const [name, rows] of Object.entries({ records: backup.records, clients: backup.clients, billingOrders: backup.billingOrders, billingSubscriptions: backup.billingSubscriptions })) {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      if (seen.has(row.id)) context.addIssue({ code: 'custom', path: [name, index, 'id'], message: 'O backup contém IDs duplicados.' });
      seen.add(row.id);
    });
  }
});

export type WorkspaceBackup = z.infer<typeof workspaceBackupSchema>;

type BackupInput = {
  organizationId: string;
  records: Array<Record<string, any>>;
  clients: Array<Record<string, any>>;
  billingOrders: Array<Record<string, any>>;
  billingSubscriptions: Array<Record<string, any>>;
};

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Builds a tenant-only backup and omits credentials, delivery queues, and audit events. */
export function buildWorkspaceBackup(input: BackupInput): WorkspaceBackup {
  let excludedRecords = 0;
  const records = input.records.flatMap((row) => {
    if (['integration-secrets', 'integration-controls', 'whatsapp-sessions', 'portal-auth-challenges'].includes(row.resource) || !isSafeWorkspaceData(row.data)) {
      excludedRecords += 1;
      return [];
    }
    return [{
      id: row.id,
      resource: row.resource,
      data: row.data,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
      archivedAt: iso(row.archivedAt),
    }];
  });
  const pick = (row: Record<string, any>, fields: string[]) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
  const clients = input.clients.map((row) => ({
    ...pick(row, ['id', 'name', 'legalName', 'contactName', 'email', 'phone', 'document', 'status', 'source', 'notes', 'tags']),
    tags: row.tags || [], createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), archivedAt: iso(row.archivedAt),
  }));
  const billingOrders = input.billingOrders.map((row) => {
    if (!isSafeWorkspaceData(row.paymentDetails)) excludedRecords += 1;
    return {
    ...pick(row, ['id', 'clientId', 'workspaceClientId', 'clientName', 'payerEmail', 'description', 'amount', 'method', 'status', 'statusDetail', 'mpOrderId', 'mpPaymentId', 'mercadoPagoAccountId', 'paymentDetails']),
    paymentDetails: isSafeWorkspaceData(row.paymentDetails) ? row.paymentDetails : {},
    dueAt: iso(row.dueAt), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
    };
  });
  const billingSubscriptions = input.billingSubscriptions.map((row) => ({
    ...pick(row, ['id', 'clientId', 'workspaceClientId', 'clientName', 'payerEmail', 'description', 'amount', 'frequency', 'frequencyInterval', 'status', 'mpSubscriptionId', 'mercadoPagoAccountId', 'checkoutUrl']),
    nextPaymentAt: iso(row.nextPaymentAt), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
  }));
  return workspaceBackupSchema.parse({
    format: 'nexo-workspace-backup', version: 1, organizationId: input.organizationId,
    exportedAt: new Date().toISOString(), excludedRecords, records, clients, billingOrders, billingSubscriptions,
  });
}

export function parseWorkspaceBackup(value: unknown, organizationId: string): WorkspaceBackup {
  let serialized: string;
  try { serialized = JSON.stringify(value) || ''; }
  catch { throw new Error('O arquivo de backup nao e JSON valido.'); }
  if (Buffer.byteLength(serialized, 'utf8') > 25 * 1024 * 1024) throw new Error('O arquivo de backup excede o limite de 25 MB.');
  const backup = workspaceBackupSchema.parse(value);
  if (backup.organizationId !== organizationId) throw new Error('Este backup pertence a outro workspace.');
  return backup;
}
