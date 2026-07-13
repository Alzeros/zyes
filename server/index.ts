import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { loadConfig, getDataDir } from './config.js';
import { hashPassword, verifyToken } from './services/auth.service.js';
import { DEFAULT_SEARCH_ENGINES } from './services/store.service.js';
import { staticPlugin } from './plugins/static.js';
import { authRoutes } from './routes/auth.routes.js';
import { bookmarkRoutes } from './routes/bookmark.routes.js';
import { categoryRoutes } from './routes/category.routes.js';
import { searchRoutes } from './routes/search.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { iconRoutes } from './routes/icon.routes.js';
import { dataRoutes } from './routes/data.routes.js';

// Auto-initialize if config doesn't exist
async function autoInit() {
  const dataDir = getDataDir();
  const configPath = resolve(dataDir, 'config.json');
  if (existsSync(configPath)) return;

  const password = process.env.ZYES_PASSWORD || 'admin';
  const port = process.env.ZYES_PORT ? parseInt(process.env.ZYES_PORT, 10) : 3847;

  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const passwordHash = await hashPassword(password);
  const jwtSecret = randomBytes(64).toString('hex');
  writeFileSync(configPath, JSON.stringify({
    passwordHash, jwtSecret, jwtExpiry: '24h', port, host: '0.0.0.0',
  }, null, 2), 'utf-8');

  console.log('\n  ============================================');
  console.log('  zyes auto-initialized');
  console.log(`  Default password: ${password}`);
  console.log('  Change it by editing server/data/config.json');
  console.log('  Or delete config.json and set ZYES_PASSWORD env var');
  console.log('  ============================================\n');

  // Seed default data
  const dataPath = resolve(dataDir, 'data.json');
  if (!existsSync(dataPath)) {
    writeFileSync(dataPath, JSON.stringify({
      categories: [],
      bookmarks: [],
      searchEngines: DEFAULT_SEARCH_ENGINES,
    }, null, 2), 'utf-8');
  }
}

let config = loadConfig();
const isDev = process.env.NODE_ENV !== 'production';

// Public API paths that don't require auth
const PUBLIC_PATHS = ['/api/auth/login'];
const PUBLIC_GET = ['/api/search/engines'];

function isPublic(method: string, url: string): boolean {
  if (PUBLIC_PATHS.some((p) => url === p)) return true;
  if (method === 'GET' && PUBLIC_GET.some((p) => url.startsWith(p))) return true;
  if (!url.startsWith('/api/')) return true;
  return false;
}

const fastify = Fastify({
  logger: {
    level: isDev ? 'info' : 'warn',
    transport: isDev ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } : undefined,
  },
});

// Add auth hook at root level (before route registration). Accepts the JWT
// from EITHER the Authorization: Bearer header (regular API client) OR a `t`
// query param — the <img>-driven icon proxy at /api/icon can't set headers, so
// the frontend appends ?t=<jwt> there. Public paths skip auth entirely.
fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
  // Strip query string before public-path matching so /api/auth/login?t=... still
  // counts as public (login itself needs no token).
  const pathOnly = request.url.split('?')[0];
  if (isPublic(request.method, pathOnly)) return;

  const authHeader = request.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const queryToken = (request.query as { t?: string } | undefined)?.t?.trim() || '';
  const token = headerToken || queryToken;

  if (!token) {
    reply.status(401).send({ ok: false, error: 'Unauthorized', code: 'NO_TOKEN' });
    return;
  }

  const payload = verifyToken(token, config.jwtSecret);

  if (!payload) {
    reply.status(401).send({ ok: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    return;
  }

  (request as any).user = payload;
});

async function start() {
  // Security plugins
  await fastify.register(cors, { origin: true });
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  // API routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(bookmarkRoutes, { prefix: '/api/bookmarks' });
  await fastify.register(categoryRoutes, { prefix: '/api/categories' });
  await fastify.register(searchRoutes, { prefix: '/api/search' });
  await fastify.register(settingsRoutes, { prefix: '/api/settings' });
  await fastify.register(iconRoutes, { prefix: '/api/icon' });
  await fastify.register(dataRoutes, { prefix: '/api/data' });

  // Static file serving (production)
  await fastify.register(staticPlugin);

  try {
    await fastify.listen({ port: config.port, host: config.host });
    console.log(`\n  zyes server running at http://${config.host}:${config.port}\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

async function bootstrap() {
  await autoInit();
  config = loadConfig();
  await start();
}

bootstrap();
