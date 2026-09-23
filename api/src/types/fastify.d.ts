import '@fastify/jwt';
import 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; organizationId: string; role: 'owner' | 'admin' | 'member' };
    user: { sub: string; organizationId: string; role: 'owner' | 'admin' | 'member' };
  }
}
