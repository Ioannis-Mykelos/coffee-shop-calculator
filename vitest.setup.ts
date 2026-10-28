import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// `server-only` throws outside a React Server Component bundle; the server modules are tested directly.
vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
