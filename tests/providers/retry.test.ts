import { describe, expect, it, vi } from "vitest";
import { RetryingProvider } from "../../src/providers/retry.js";
import type {
  CompletionRequest,
  CompletionResult,
  Provider
} from "../../src/providers/provider.js";

class FakeProvider implements Provider {
  name = "fake";
  calls = 0;

  constructor(private readonly behavior: (call: number) => CompletionResult) {}

  async complete(_request: CompletionRequest): Promise<CompletionResult> {
    this.calls += 1;
    return this.behavior(this.calls);
  }
}

class FailingProvider implements Provider {
  name = "failing";
  calls = 0;

  constructor(private readonly errors: Error[]) {}

  async complete(_request: CompletionRequest): Promise<CompletionResult> {
    this.calls += 1;
    const next = this.errors.shift();
    if (next) {
      throw next;
    }
    return { text: "ok" };
  }
}

const instantDelay = async (): Promise<void> => {};

describe("RetryingProvider", () => {
  it("passes through a successful call with no retries", async () => {
    const inner = new FakeProvider(() => ({ text: "hello" }));
    const provider = new RetryingProvider(inner, { delay: instantDelay });

    const result = await provider.complete({ prompt: "p", maxTokens: 10 });

    expect(result.text).toBe("hello");
    expect(inner.calls).toBe(1);
  });

  it("retries a 503 and succeeds once the transient error clears", async () => {
    const inner = new FailingProvider([new Error("Gemini API error 503: unavailable")]);
    const provider = new RetryingProvider(inner, { delay: instantDelay });

    const result = await provider.complete({ prompt: "p", maxTokens: 10 });

    expect(result.text).toBe("ok");
    expect(inner.calls).toBe(2);
  });

  it("does not retry a non-retryable error", async () => {
    const inner = new FailingProvider([new Error("Gemini API error 404: not found")]);
    const provider = new RetryingProvider(inner, { delay: instantDelay });

    await expect(provider.complete({ prompt: "p", maxTokens: 10 })).rejects.toThrow("404");
    expect(inner.calls).toBe(1);
  });

  it("gives up after maxAttempts and throws the last error", async () => {
    const inner = new FailingProvider([
      new Error("error 503: a"),
      new Error("error 503: b"),
      new Error("error 503: c")
    ]);
    const provider = new RetryingProvider(inner, { delay: instantDelay, maxAttempts: 3 });

    await expect(provider.complete({ prompt: "p", maxTokens: 10 })).rejects.toThrow("error 503: c");
    expect(inner.calls).toBe(3);
  });

  it("calls onRetry with backoff details before each retry", async () => {
    const inner = new FailingProvider([new Error("error 429: rate limited")]);
    const onRetry = vi.fn();
    const provider = new RetryingProvider(inner, {
      delay: instantDelay,
      baseDelayMs: 100,
      onRetry
    });

    await provider.complete({ prompt: "p", maxTokens: 10 });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 1, maxAttempts: 4, delayMs: 100 });
  });
});
