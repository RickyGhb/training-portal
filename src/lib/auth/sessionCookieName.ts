// Deliberately dependency-free (no "server-only", no Node builtins) so it
// can be imported from src/proxy.ts, which runs on the Edge runtime and
// can't load session.ts's Node-only crypto/Prisma imports.
export const SESSION_COOKIE_NAME = "tp_session";
