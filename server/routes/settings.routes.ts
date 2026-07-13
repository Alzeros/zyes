import type { FastifyInstance } from 'fastify';
import * as store from '../services/store.service.js';

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/settings/view — global view settings (allViewMode + cardSize + siteName)
  fastify.get('/view', async () => {
    const settings = store.getSettings();
    return { ok: true, data: settings };
  });

  // PUT /api/settings/view — update any subset of { allViewMode, cardSize, siteName }.
  // Each field is validated; an invalid value rejects the whole request.
  fastify.put('/view', async (request, reply) => {
    const body = request.body as {
      allViewMode?: string;
      cardSize?: string;
      siteName?: unknown;
    };

    if (body.allViewMode !== undefined && body.allViewMode !== 'compact' && body.allViewMode !== 'detail') {
      return reply.status(400).send({ ok: false, error: 'Invalid allViewMode', code: 'INVALID_MODE' });
    }
    if (body.cardSize !== undefined && body.cardSize !== 'xs' && body.cardSize !== 'sm' && body.cardSize !== 'md' && body.cardSize !== 'lg') {
      return reply.status(400).send({ ok: false, error: 'Invalid cardSize', code: 'INVALID_MODE' });
    }
    let siteName: string | undefined;
    if (body.siteName !== undefined) {
      if (typeof body.siteName !== 'string') {
        return reply.status(400).send({ ok: false, error: 'Invalid siteName', code: 'INVALID_MODE' });
      }
      siteName = body.siteName;
    }

    const settings = store.updateSettings({
      allViewMode: body.allViewMode as 'compact' | 'detail' | undefined,
      cardSize: body.cardSize as 'xs' | 'sm' | 'md' | 'lg' | undefined,
      siteName,
    });
    return { ok: true, data: settings };
  });
}
