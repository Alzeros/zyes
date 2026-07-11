// One-time / rotation helper for the Cloudflare Workers + D1 deployment.
//
// Reads a password from the ZYES_PASSWORD env var (or prompts on stdin) and
// emits a D1 SQL statement that sets the password_hash row in the `meta`
// table, using the same PBKDF2-SHA256 scheme the Worker verifies with.
//
//   Usage:
//     ZYES_PASSWORD='yourpass' npm run set-password > sql/set-password.sql
//     wrangler d1 execute zyes-db --remote --file=sql/set-password.sql
//
//   Or one-shot:
//     ZYES_PASSWORD='yourpass' npm run set-password -- --execute | bash
//
// (Only emits SQL by default; --execute also prints the surrounding wrangler
// command so you can pipe to bash. We never call wrangler from inside the
// script to keep this dependency-free.)

import { hashPassword } from '../worker/src/auth';

async function main(): Promise<void> {
  let password = process.env.ZYES_PASSWORD;
  const execute = process.argv.includes('--execute');
  if (!password) {
    prompt('Set zyes password: ');
    password = await readLine();
    if (!password) {
      console.error('No password provided (set ZYES_PASSWORD or type one).');
      process.exit(1);
    }
  }

  const hash = await hashPassword(password);
  // Escape single quotes for SQL.
  const sqlHash = hash.replace(/'/g, "''");
  const sql = `INSERT INTO meta (key, value) VALUES ('password_hash', '${sqlHash}') ON CONFLICT(key) DO UPDATE SET value = excluded.value;`;

  if (execute) {
    process.stdout.write(`wrangler d1 execute zyes-db --remote --command "${sql.replace(/"/g, '\\"')}"\n`);
  } else {
    process.stdout.write(sql + '\n');
  }
}

function prompt(msg: string): void {
  process.stderr.write(msg);
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
      if (data.includes('\n')) {
        process.stdin.removeAllListeners('data');
        resolve(data.split('\n')[0].trimEnd());
      }
    });
  });
}

main();
