import { relations, sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<'owner' | 'admin' | 'member'>().default('owner').notNull(),
  active: boolean('active').default(true).notNull(),
  notificationsReadAt: timestamp('notifications_read_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('users_email_unique').on(table.email), index('users_organization_idx').on(table.organizationId)]);

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  document: text('document'),
  status: text('status').$type<'active' | 'inactive' | 'archived'>().default('active').notNull(),
  source: text('source'),
  notes: text('notes'),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [index('clients_org_updated_idx').on(table.organizationId, table.updatedAt), index('clients_org_status_idx').on(table.organizationId, table.status)]);

export const activityEvents = pgTable('activity_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  action: text('action').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('activity_org_created_idx').on(table.organizationId, table.createdAt)]);

export const billingOrders = pgTable('billing_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  clientName: text('client_name').notNull(),
  payerEmail: text('payer_email').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  method: text('method').notNull(),
  status: text('status').default('pending').notNull(),
  statusDetail: text('status_detail'),
  mpOrderId: text('mp_order_id'),
  mpPaymentId: text('mp_payment_id'),
  paymentDetails: jsonb('payment_details').$type<Record<string, unknown>>().default({}).notNull(),
  dueAt: timestamp('due_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('billing_orders_org_created_idx').on(table.organizationId, table.createdAt),
  index('billing_orders_pending_due_idx').on(table.status, table.dueAt),
  uniqueIndex('billing_orders_mp_order_unique').on(table.mpOrderId),
]);

export const billingOverdueEvents = pgTable('billing_overdue_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  billingOrderId: uuid('billing_order_id').notNull().references(() => billingOrders.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').defaultRandom().notNull(),
  attempts: integer('attempts').default(0).notNull(),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  discardedAt: timestamp('discarded_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('billing_overdue_events_order_unique').on(table.billingOrderId),
  uniqueIndex('billing_overdue_events_event_unique').on(table.eventId),
  index('billing_overdue_events_retry_idx').on(table.deliveredAt, table.discardedAt, table.nextAttemptAt),
]);

export const n8nEventDeliveries = pgTable('n8n_event_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  automationId: uuid('automation_id').notNull(),
  eventId: uuid('event_id').notNull(),
  eventKey: text('event_key').notNull(),
  record: jsonb('record').$type<Record<string, unknown>>().default({}).notNull(),
  attempts: integer('attempts').default(0).notNull(),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  discardedAt: timestamp('discarded_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('n8n_delivery_automation_event_unique').on(table.automationId, table.eventId),
  index('n8n_event_deliveries_retry_idx').on(table.deliveredAt, table.discardedAt, table.nextAttemptAt),
]);

export const billingSubscriptions = pgTable('billing_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  clientName: text('client_name').notNull(),
  payerEmail: text('payer_email').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  frequency: text('frequency').notNull(),
  frequencyInterval: numeric('frequency_interval', { precision: 6, scale: 0, mode: 'number' }).notNull(),
  status: text('status').default('pending').notNull(),
  mpSubscriptionId: text('mp_subscription_id'),
  checkoutUrl: text('checkout_url'),
  nextPaymentAt: timestamp('next_payment_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('billing_subscriptions_org_created_idx').on(table.organizationId, table.createdAt),
  uniqueIndex('billing_subscriptions_mp_id_unique').on(table.mpSubscriptionId),
]);

export const workspaceRecords = pgTable('workspace_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  resource: text('resource').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  index('workspace_records_org_resource_updated_idx').on(table.organizationId, table.resource, table.updatedAt),
  index('workspace_records_org_resource_created_idx').on(table.organizationId, table.resource, table.createdAt),
  uniqueIndex('workspace_task_n8n_event_unique').on(table.organizationId, sql`(${table.data}->>'n8nEventId')`)
    .where(sql`${table.resource} = 'tasks' AND ${table.archivedAt} IS NULL AND ${table.data} ? 'n8nEventId'`),
]);

export const organizationsRelations = relations(organizations, ({ many }) => ({ users: many(users), clients: many(clients) }));
export const usersRelations = relations(users, ({ one }) => ({ organization: one(organizations, { fields: [users.organizationId], references: [organizations.id] }) }));
export const clientsRelations = relations(clients, ({ one }) => ({ organization: one(organizations, { fields: [clients.organizationId], references: [organizations.id] }) }));
