import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { hashPassword } from '../server/services/auth.service.js';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.ZYES_DATA_DIR || resolve(__dirname, '../server/data');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');
const DATA_PATH = resolve(DATA_DIR, 'data.json');

async function main() {
  console.log('\n  zyes initialization\n');

  if (existsSync(CONFIG_PATH)) {
    const answer = await ask('config.json already exists. Overwrite? (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      console.log('Aborted.');
      return;
    }
  }

  // Get password
  let password = process.env.ZYES_PASSWORD || '';
  if (!password) {
    password = await ask('Set admin password: ');
    if (!password || password.length < 4) {
      console.error('Password must be at least 4 characters.');
      process.exit(1);
    }
  }

  // Ensure data directory
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Generate JWT secret
  const jwtSecret = randomBytes(64).toString('hex');

  // Hash password
  const passwordHash = await hashPassword(password);

  // Write config
  const config = {
    passwordHash,
    jwtSecret,
    jwtExpiry: '24h',
    port: 3847,
    host: '0.0.0.0',
  };
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`  Config written to ${CONFIG_PATH}`);

  // Seed data file if not exists
  if (!existsSync(DATA_PATH)) {
    const defaultData = {
      categories: [],
      bookmarks: [],
      searchEngines: [
        { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={query}', icon: 'google', isActive: true },
        { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q={query}', icon: 'bing', isActive: true },
        { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}', icon: 'duckduckgo', isActive: true },
        { id: 'baidu', name: 'Baidu', url: 'https://www.baidu.com/s?wd={query}', icon: 'baidu', isActive: true },
        { id: 'github', name: 'GitHub', url: 'https://github.com/search?q={query}', icon: 'github', isActive: true },
        { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q={query}', icon: 'stackoverflow', isActive: true },
        { id: 'npm', name: 'npm', url: 'https://www.npmjs.com/search?q={query}', icon: 'npm', isActive: true },
      ],
    };
    writeFileSync(DATA_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
    console.log(`  Data seeded at ${DATA_PATH}`);
  }

  console.log('\n  Done! Run "npm run dev" to start.\n');
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

main().catch((err) => {
  console.error('Init failed:', err);
  process.exit(1);
});
