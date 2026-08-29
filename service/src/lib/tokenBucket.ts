/** In-process token bucket — caps outbound QPS regardless of which user triggered the call. */
export class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private lastRefill: number;

  constructor(maxPerSecond: number) {
    this.capacity = Math.max(1, maxPerSecond);
    this.tokens = this.capacity;
    this.refillPerMs = this.capacity / 1000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }

  private tryTake(): boolean {
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  /** Resolves once a token is available. Callers await this before making the outbound call. */
  async acquire(): Promise<void> {
    while (!this.tryTake()) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/** Shared across every outbound Anthropic/Voyage call in the process — not per-user. */
export const llmRateLimiter = new TokenBucket(Number(process.env.AI_MAX_QPS ?? 1));
