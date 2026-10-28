import type { Db } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { migrate, MIGRATIONS } from '../../../scripts/migrate.mjs';

/** A database with only the `migrations` collection, enough to see what runs and what's recorded */
function fakeDb(done: string[] = []) {
  const recorded = new Map(done.map((id) => [id, {}]));
  const db = {
    collection: () => ({
      findOne: async ({ _id }: { _id: string }) => recorded.get(_id) ?? null,
      updateOne: async ({ _id }: { _id: string }, update: { $setOnInsert: object }) => void recorded.set(_id, update.$setOnInsert),
    }),
  } as unknown as Db;
  return { db, recorded };
}

const step = (id: string, ran: string[]) => ({ id, about: id, up: async () => void ran.push(id) });

describe('migrate', () => {
  it('runs every migration in order and records each one', async () => {
    const ran: string[] = [];
    const { db, recorded } = fakeDb();
    expect(await migrate(db, [step('a', ran), step('b', ran)], () => {})).toEqual(['a', 'b']);
    expect(ran).toEqual(['a', 'b']);
    expect([...recorded.keys()]).toEqual(['a', 'b']);
  });

  it('skips the migrations the database already had', async () => {
    const ran: string[] = [];
    const { db } = fakeDb(['a']);
    expect(await migrate(db, [step('a', ran), step('b', ran)], () => {})).toEqual(['b']);
    expect(ran).toEqual(['b']);
  });

  it("doesn't record a migration that failed, so the next run tries it again", async () => {
    const { db, recorded } = fakeDb();
    const failing = { id: 'a', about: 'a', up: async () => Promise.reject(new Error('down')) };
    await expect(migrate(db, [failing], () => {})).rejects.toThrow('down');
    expect(recorded.has('a')).toBe(false);
  });

  it('keeps every migration id unique', () => {
    const ids = MIGRATIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
