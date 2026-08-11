import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // "server-only" throws unless resolved under the "react-server" export
      // condition, which Next's bundler sets automatically but Vitest (plain
      // Node) doesn't. Point it at the package's own no-op stub instead of
      // its default index.js so files that `import "server-only"` (reports.ts,
      // marketingReadiness.ts, content-resolution.ts, csrf.ts) are importable
      // under test.
      "server-only": path.resolve(import.meta.dirname, "./node_modules/server-only/empty.js"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Dummy value only — importing src/lib/prisma.ts constructs a PrismaPg
    // client eagerly at module load (throws if unset), even in test files
    // that mock prisma calls and never actually connect. Never a real DB URL.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
});
