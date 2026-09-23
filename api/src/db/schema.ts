import { relations } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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

export const organizationsRelations = relations(organizations, ({ many }) => ({ users: many(users), clients: many(clients) }));
export const usersRelations = relations(users, ({ one }) => ({ organization: one(organizations, { fields: [users.organizationId], references: [organizations.id] }) }));
export const clientsRelations = relations(clients, ({ one }) => ({ organization: one(organizations, { fields: [clients.organizationId], references: [organizations.id] }) }));
