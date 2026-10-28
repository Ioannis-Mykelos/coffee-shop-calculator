"use client";

import type { Workspace } from "./workspace";

// Browser side of app/api/workspace: the signed-in owner's figures.

export type LoadAnswer =
  | { ok: true; workspace: Workspace | null; version: number }
  | { ok: false; reason: "unauthorized" | "failed" };

export async function loadWorkspace(): Promise<LoadAnswer> {
  try {
    const res = await fetch("/api/workspace", { cache: "no-store" });
    if (res.status === 401) return { ok: false, reason: "unauthorized" };
    if (!res.ok) return { ok: false, reason: "failed" };
    return { ok: true, ...((await res.json()) as { workspace: Workspace | null; version: number }) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export type SaveAnswer =
  | { ok: true; version: number }
  /** Another device saved first: what's saved now */
  | { ok: false; reason: "conflict"; workspace: Workspace; version: number }
  | { ok: false; reason: "unauthorized" | "failed" };

/** Saves over `version`, the one this browser loaded or last saved. */
export async function saveWorkspace(workspace: Workspace, version: number): Promise<SaveAnswer> {
  try {
    const res = await fetch("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace, version }),
    });
    if (res.ok) return { ok: true, version: ((await res.json()) as { version: number }).version };
    if (res.status === 401) return { ok: false, reason: "unauthorized" };
    if (res.status === 409) {
      const saved = (await res.json()) as { workspace: Workspace | null; version: number };
      if (saved.workspace) return { ok: false, reason: "conflict", workspace: saved.workspace, version: saved.version };
    }
    return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
