import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("lässt bis zum Limit durch und blockt danach", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("ip", 3, 60_000, t).ok).toBe(true);
    const blocked = rateLimit("ip", 3, 60_000, t + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(59);
  });

  it("setzt das Fenster nach Ablauf zurück", () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) rateLimit("ip", 3, 60_000, t);
    expect(rateLimit("ip", 3, 60_000, t + 60_000).ok).toBe(true);
  });

  it("zählt Schlüssel getrennt", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 60_000, t);
    expect(rateLimit("a", 3, 60_000, t).ok).toBe(false);
    expect(rateLimit("b", 3, 60_000, t).ok).toBe(true);
  });
});
