import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Use process.cwd() so paths are always relative to where the server is launched from.
// Works for both dev (tsx server/index.ts) and production (node dist/server/index.js).
// Docker overrides via ZYES_DATA_DIR env var.
const DATA_DIR = process.env.ZYES_DATA_DIR || resolve(process.cwd(), 'server/data');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');

export interface AppConfig {
  passwordHash: string;
  jwtSecret: string;
  jwtExpiry: string;
  port: number;
  host: string;
}

const defaults: AppConfig = {
  passwordHash: '',
  jwtSecret: '',
  jwtExpiry: '24h',
  port: 3847,
  host: '0.0.0.0',
};

export function loadConfig(): AppConfig {
  let fileConfig: Partial<AppConfig> = {};

  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch {
      console.warn('Failed to parse config.json, using defaults');
    }
  }

  const config: AppConfig = { ...defaults, ...fileConfig };

  // Environment variable overrides
  if (process.env.ZYES_PORT) config.port = parseInt(process.env.ZYES_PORT, 10);
  if (process.env.ZYES_HOST) config.host = process.env.ZYES_HOST;
  if (process.env.ZYES_JWT_SECRET) config.jwtSecret = process.env.ZYES_JWT_SECRET;

  return config;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getDataDir(): string {
  return DATA_DIR;
}
