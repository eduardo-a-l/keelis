import type { CompletionRequest, CompletionResult, Provider } from "./provider.js";

export interface RetryEvent {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error: unknown;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  delay?: (ms: number) => Promise<void>;
  onRetry?: (event: RetryEvent) => void;
}

const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

function extractStatus(message: string): number | undefined {
  const match = message.match(/\b(\d{3})\b/);
  return match ? Number(match[1]) : undefined;
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const status = extractStatus(error.message);
  return status !== undefined && RETRYABLE_STATUSES.has(status);
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RetryingProvider implements Provider {
  name: string;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly delay: (ms: number) => Promise<void>;
  private readonly onRetry: ((event: RetryEvent) => void) | undefined;

  constructor(
    private readonly inner: Provider,
    options: RetryOptions = {}
  ) {
    this.name = inner.name;
    this.maxAttempts = options.maxAttempts ?? 4;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.delay = options.delay ?? defaultDelay;
    this.onRetry = options.onRetry;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await this.inner.complete(request);
      } catch (error) {
        lastError = error;
        if (attempt === this.maxAttempts || !isRetryable(error)) {
          throw error;
        }
        const delayMs = this.baseDelayMs * 2 ** (attempt - 1);
        this.onRetry?.({ attempt, maxAttempts: this.maxAttempts, delayMs, error });
        await this.delay(delayMs);
      }
    }

    throw lastError;
  }
}
