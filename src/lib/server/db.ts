import 'server-only';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import type { Workspace } from '../workspace';
import type { UserRecord, UserStore } from './accounts';

// One MongoDB client per server process, connected on first use (accounts mode only, see config.ts). In development it
// is kept on globalThis so hot reloads don't open a new connection each time. The indexes are made by the migrations
// (scripts/migrate.mjs), not here, so a cold start doesn't wait for them.

const globalForMongo = globalThis as unknown as { cremaMongo?: Promise<MongoClient> };

export function mongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set: accounts need a database (see README, Accounts).');
  globalForMongo.cremaMongo ??= new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  }).connect();
  return globalForMongo.cremaMongo;
}

/** The database named in MONGODB_URI, e.g. …mongodb.net/crema. */
const db = async () => (await mongoClient()).db();

// Auth.js's adapter shares this collection: Google users are created by the adapter, email users here.
type UserDoc = Omit<UserRecord, 'id'> & { _id: ObjectId };
const users = async () => (await db()).collection<UserDoc>('users');
const toRecord = ({ _id, ...doc }: UserDoc): UserRecord => ({ ...doc, id: _id.toHexString() });
const objectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

export const mongoUserStore: UserStore = {
  async findByEmail(email) {
    const doc = await (await users()).findOne({ email });
    return doc && toRecord(doc);
  },
  async findById(id) {
    const _id = objectId(id);
    const doc = _id && (await (await users()).findOne({ _id }));
    return doc ? toRecord(doc) : null;
  },
  async findByTokenHash(hash) {
    const doc = await (await users()).findOne({ verifyTokenHash: hash });
    return doc && toRecord(doc);
  },
  async findByResetTokenHash(hash) {
    const doc = await (await users()).findOne({ resetTokenHash: hash });
    return doc && toRecord(doc);
  },
  async insert(user) {
    await (await users()).insertOne({ ...user, _id: new ObjectId() });
  },
  async update(id, set, unset = []) {
    const fields = { ...set };
    delete fields.id;
    await (await users()).updateOne(
      { _id: new ObjectId(id) },
      { $set: fields, ...(unset.length && { $unset: Object.fromEntries(unset.map((k) => [k, ''])) }) },
    );
  },
  async remove(id) {
    const _id = objectId(id);
    if (!_id) return;
    const database = await db();
    // The user document goes last: if anything before it fails, the account still exists and can try again.
    // `accounts` and `sessions` are Auth.js's adapter collections (Google sign-in links; sessions aren't used with JWTs).
    await database.collection<WorkspaceDoc>('workspaces').deleteOne({ _id: id });
    await database.collection('accounts').deleteMany({ userId: _id });
    await database.collection('sessions').deleteMany({ userId: _id });
    await (await users()).deleteOne({ _id });
  },
};

/** The accounts with the Monday email switched on. */
export const optedInToWeeklyEmail = async () => (await (await users()).find({ weeklyEmail: true }).toArray()).map(toRecord);

// ---------------------------------------------------------------------------
// Workspaces: one document per owner (its _id is the user id) with everything they've entered. `version` goes up with
// every save, and a save names the version it was made from: one made from an older version (another device saved
// since) is refused, so two devices can't silently overwrite each other.

type WorkspaceDoc = { _id: string; workspace: Workspace; version: number; updatedAt: Date };
const workspaces = async () => (await db()).collection<WorkspaceDoc>('workspaces');

export type SavedWorkspace = { workspace: Workspace | null; version: number };

export interface WorkspaceStore {
  read(userId: string): Promise<SavedWorkspace>;
  /** Saves over `version`: the new version, or null when someone saved a newer one since. */
  write(userId: string, workspace: Workspace, version: number, now?: Date): Promise<number | null>;
}

export const mongoWorkspaceStore: WorkspaceStore = {
  async read(userId) {
    const doc = await (await workspaces()).findOne({ _id: userId });
    return doc ? { workspace: doc.workspace, version: doc.version } : { workspace: null, version: 0 };
  },
  async write(userId, workspace, version, now = new Date()) {
    const collection = await workspaces();
    if (version === 0) {
      // The first save creates the document; if another device created it first, this one is out of date.
      try {
        await collection.insertOne({ _id: userId, workspace, version: 1, updatedAt: now });
        return 1;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) return null;
        throw error;
      }
    }
    const doc = await collection.findOneAndUpdate(
      { _id: userId, version },
      { $set: { workspace, updatedAt: now }, $inc: { version: 1 } },
      { returnDocument: 'after', projection: { version: 1 } },
    );
    return doc?.version ?? null;
  },
};
