import '@fastify/jwt';
import 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { WorkspacePermissions } from '../security/authorization.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; organizationId: string; role: 'owner' | 'admin' | 'member'; permissions?: WorkspacePermissions | null; purpose?: string; nonce?: string; inviteVersion?: number; sessionVersion?: number; clientRecordId?: string; version?: number; rememberMe?: boolean };
    user: { sub: string; organizationId: string; role: 'owner' | 'admin' | 'member'; permissions?: WorkspacePermissions | null; purpose?: string; nonce?: string; inviteVersion?: number; sessionVersion?: number; clientRecordId?: string; version?: number; rememberMe?: boolean };
  }
}
