// Spawns `prisma studio` with DATABASE_URL/DIRECT_URL taken explicitly from the given
// env file, regardless of what prisma.config.ts's bare `dotenv/config` would otherwise
// load (which is always .env — see the "Staging vs. production" note in CLAUDE.md).
import { spawn } from "child_process";
import { readFileSync } from "fs";

const envFile = process.argv[2];
if (!envFile) {
  console.error("Usage: node scripts/studio.mjs <path-to-env-file>");
  process.exit(1);
}

const parsed = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const child = spawn("npx", ["prisma", "studio"], {
  stdio: "inherit",
  env: { ...process.env, ...parsed },
});

child.on("exit", (code) => process.exit(code ?? 0));
