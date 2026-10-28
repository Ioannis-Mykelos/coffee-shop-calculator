import { mongoWorkspaceStore } from '@/lib/server/db';
import { allow } from '@/lib/server/rate-limit';
import { noStore, requireUser } from '@/lib/server/session';
import { cleanWorkspace, LIMITS } from '@/lib/workspace';

// The signed-in owner's figures (lib/workspace.ts), kept in their account.

/** GET → { workspace, version }: workspace is null until the first save. */
export async function GET() {
  const user = await requireUser();
  if ('response' in user) return user.response;
  return Response.json(await mongoWorkspaceStore.read(user.userId), { headers: noStore });
}

/**
 * PUT { workspace, version } → { version }: saves over the version the browser loaded or last saved. 409 with the
 * saved { workspace, version } when another device saved in between, so the browser can show what's there now.
 * The browser saves a second after typing stops, so 120 saves a minute is far above real use.
 */
export async function PUT(req: Request) {
  const user = await requireUser();
  if ('response' in user) return user.response;
  if (!(await allow(`save:${user.userId}`, 120, 60_000))) {
    return Response.json({ error: 'Saving too often. Wait a moment.' }, { status: 429, headers: noStore });
  }
  const raw = await req.text();
  if (raw.length > LIMITS.bytes) return Response.json({ error: 'Too much data to save.' }, { status: 413, headers: noStore });
  let body: { workspace?: unknown; version?: unknown } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {}
  const workspace = cleanWorkspace(body?.workspace);
  const version = body?.version;
  if (!workspace || typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return Response.json({ error: "That isn't a workspace." }, { status: 400, headers: noStore });
  }

  const saved = await mongoWorkspaceStore.write(user.userId, workspace, version);
  if (saved !== null) return Response.json({ version: saved }, { headers: noStore });
  return Response.json(await mongoWorkspaceStore.read(user.userId), { status: 409, headers: noStore });
}
