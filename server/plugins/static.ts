import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

export async function staticPlugin(fastify: FastifyInstance): Promise<void> {
  // In production, client build is at dist/client/ relative to project root
  const clientDir = resolve(process.cwd(), 'dist/client');

  if (!existsSync(clientDir)) {
    fastify.get('/', async () => {
      return { ok: true, message: 'zyes API server running. Frontend not built yet.' };
    });
    return;
  }

  await fastify.register(fastifyStatic, {
    root: clientDir,
    prefix: '/',
    decorateReply: true,
  });

  // SPA fallback: serve index.html for all non-API routes
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.status(404).send({ ok: false, error: 'Not found', code: 'NOT_FOUND' });
      return;
    }
    reply.sendFile('index.html');
  });
}
