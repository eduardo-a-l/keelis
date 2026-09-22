import type { CompletionRequest, CompletionResult, Provider } from "./provider.js";

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessageResponse {
  content: AnthropicContentBlock[];
}

export class AnthropicProvider implements Provider {
  name = "anthropic";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "claude-sonnet-4-6";
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens,
        messages: [{ role: "user", content: request.prompt }]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as AnthropicMessageResponse;
    const text = data.content
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("\n");

    return { text };
  }
}
