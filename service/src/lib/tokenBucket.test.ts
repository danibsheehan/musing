import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TokenBucket } from "./tokenBucket.js";

describe("TokenBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows immediate acquisition up to capacity", async () => {
    const bucket = new TokenBucket(2);
    await expect(bucket.acquire()).resolves.toBeUndefined();
    await expect(bucket.acquire()).resolves.toBeUndefined();
  });

  it("blocks until tokens refill once capacity is exhausted", async () => {
    const bucket = new TokenBucket(1);
    await bucket.acquire();

    let resolved = false;
    const pending = bucket.acquire().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    await pending;
    expect(resolved).toBe(true);
  });
});
