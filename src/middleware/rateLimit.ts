/**
 * Simple in-memory per-external-id rate limiter.
 * Allows at most `maxRequests` within `windowMs`.
 */
export class InMemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const prior = this.hits.get(key) ?? [];
    const recent = prior.filter((t) => t > windowStart);

    if (recent.length >= this.maxRequests) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

/** ~20 inbound messages per minute per sender */
export const inboundRateLimiter = new InMemoryRateLimiter(20, 60_000);
