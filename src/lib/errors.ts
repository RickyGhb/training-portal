/**
 * Thrown deliberately with a message that's safe to show a user, e.g.
 * "That username is already taken." Any other error caught in a server
 * action (Prisma errors, unexpected exceptions) must NOT have its raw
 * `.message` surfaced to the client — that leaks internal implementation
 * details (table/constraint names, driver internals). Catch blocks should
 * check `instanceof UserFacingError` and fall back to a generic message
 * for everything else.
 */
export class UserFacingError extends Error {}
