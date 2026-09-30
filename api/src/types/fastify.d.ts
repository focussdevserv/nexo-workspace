import '@fastify/jwt';
import 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

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
    payload: { sub: string; organizationId: string; role: 'owner' | 'admin' | 'member'; purpose?: string; nonce?: string };
    user: { sub: string; organizationId: string; role: 'owner' | 'admin' | 'member'; purpose?: string; nonce?: string };
  }
}
