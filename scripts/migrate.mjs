// Database migrations: the indexes, and any one-off moves of data. Each migration runs once per database, in order;
// the ones done are recorded in the `migrations` collection. Never edit one that has run: add a new one instead.
//
//   npm run db:migrate      against MONGODB_URI (from .env.local)
//
// Netlify runs it before each production build (see netlify.toml), so new code never goes live without its indexes.
// Deploy previews and branch deploys skip it: they must not change the production database before their branch is
// merged. Without MONGODB_URI (local mode, CI) there is nothing to migrate.

import { pathToFileURL } from 'node:url';
import { MongoClient, ServerApiVersion } from 'mongodb';

/** @typedef {import('mongodb').Db} Db */
/** @type {{ id: string; about: string; up: (db: Db) => Promise<void> }[]} */
export const MIGRATIONS = [
  {
    id: '2026-10-28-indexes',
    about: 'Indexes for accounts and sign-in',
    async up(db) {
      // One account per email, and quick lookups of the email links' tokens.
      await db.collection('users').createIndexes([
        { key: { email: 1 }, unique: true },
        { key: { verifyTokenHash: 1 }, sparse: true },
        { key: { resetTokenHash: 1 }, sparse: true },
      ]);
      // Auth.js's adapter finds the account behind a Google sign-in by provider and id, on every Google log in.
      await db.collection('accounts').createIndex({ provider: 1, providerAccountId: 1 }, { unique: true });
      await db.collection('accounts').createIndex({ userId: 1 });
    },
  },
];

/** Runs the migrations `db` hasn't had yet, in order; returns the ids it ran. */
export async function migrate(db, migrations = MIGRATIONS, log = console.log) {
  const done = db.collection('migrations');
  const ran = [];
  for (const m of migrations) {
    if (await done.findOne({ _id: m.id })) continue;
    log(`Migrating: ${m.id} (${m.about})`);
    await m.up(db);
    // An upsert: two builds at once may both run a migration (each is safe to run twice), and neither should fail.
    await done.updateOne({ _id: m.id }, { $setOnInsert: { about: m.about, at: new Date() } }, { upsert: true });
    ran.push(m.id);
  }
  return ran;
}

async function main() {
  if (process.argv.includes('--netlify') && process.env.CONTEXT !== 'production') {
    return console.log(`Migrations skipped: a ${process.env.CONTEXT ?? 'local'} build doesn't change the production database.`);
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) return console.log('Migrations skipped: MONGODB_URI is not set (local mode).');

  // The app's settings (lib/server/db.ts), so the script works wherever the app does.
  const client = await new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } }).connect();
  try {
    const ran = await migrate(client.db());
    console.log(ran.length ? `Migrations done: ${ran.length} ran.` : 'Migrations: the database is up to date.');
  } finally {
    await client.close();
  }
}

// Run from the command line; importing it (the tests do) runs nothing.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error('Migrations failed:', error);
    process.exit(1);
  });
}
