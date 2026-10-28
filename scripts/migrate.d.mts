// Types for migrate.mjs, which stays plain JavaScript so Node runs it without a build step.
import type { Db } from 'mongodb';

export interface Migration {
  id: string;
  about: string;
  up(db: Db): Promise<void>;
}

export const MIGRATIONS: Migration[];

/** Runs the migrations `db` hasn't had yet, in order; returns the ids it ran. */
export function migrate(db: Db, migrations?: Migration[], log?: (line: string) => void): Promise<string[]>;
