import { vi } from "vitest";

// `server-only` is a build-time guard Next.js's bundler special-cases —
// under plain Node/Vitest it just throws unconditionally, which breaks
// any test that imports a server action module transitively pulling in
// a file that imports it (payment adapters, etc.). Treating it as a
// no-op here is safe: the whole point of these tests running under
// Vitest at all is that we're intentionally outside the browser bundle.
vi.mock("server-only", () => ({}));
