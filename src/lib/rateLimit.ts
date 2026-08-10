import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Fails open (no rate limiting) when Upstash isn't configured, so local dev
// and any environment without these two env vars set keeps working rather
// than breaking login entirely. Set UPSTASH_REDIS_REST_URL/_TOKEN to enable.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Two limiters, both must pass: per-IP catches a single source hammering
// many usernames; per-username catches distributed credential stuffing
// against one account from many IPs.
const ipLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "10 m"), prefix: "ratelimit:login:ip" })
  : null;

const usernameLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(8, "15 m"), prefix: "ratelimit:login:user" })
  : null;

/** Returns true if this login attempt is within limits (or Upstash isn't configured). */
export async function checkLoginRateLimit(ipAddress: string | null, usernameLower: string): Promise<boolean> {
  if (!ipLimiter || !usernameLimiter) return true;

  const [ipResult, usernameResult] = await Promise.all([
    ipAddress ? ipLimiter.limit(ipAddress) : Promise.resolve({ success: true }),
    usernameLimiter.limit(usernameLower),
  ]);

  return ipResult.success && usernameResult.success;
}
