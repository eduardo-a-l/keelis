import type { ToolCall } from "../tools/types.js";
import type {
  ConverseMessage,
  ConverseRequest,
  ConverseResponse,
  ConverseStopReason,
  ToolCapableProvider
} from "./converse.js";
import type { CompletionRequest, CompletionResult } from "./provider.js";

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicMessageResponse {
  content: AnthropicContentBlock[];
  stop_reason?: string;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

function toAnthropicToolResult(
  message: Extract<ConverseMessage, { role: "tool_result" }>
): AnthropicToolResultBlock {
  if (message.isError === undefined) {
    return { type: "tool_result", tool_use_id: message.toolCallId, content: message.content };
  }
  return {
    type: "tool_result",
    tool_use_id: message.toolCallId,
    content: message.content,
    is_error: message.isError
  };
}

function toAnthropicMessages(messages: ConverseMessage[]): AnthropicMessage[] {
  const result: AnthropicMessage[] = [];
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];
    if (!message) {
      break;
    }

    if (message.role === "user") {
      result.push({ role: "user", content: message.content });
      index += 1;
      continue;
    }

    if (message.role === "assistant") {
      const blocks: AnthropicContentBlock[] = [];
      if (message.content) {
        blocks.push({ type: "text", text: message.content });
      }
      for (const call of message.toolCalls) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
      }
      result.push({ role: "assistant", content: blocks });
      index += 1;
      continue;
    }

    const toolResultBlocks: AnthropicToolResultBlock[] = [];
    while (index < messages.length) {
      const current = messages[index];
      if (!current || current.role !== "tool_result") {
        break;
      }
      toolResultBlocks.push(toAnthropicToolResult(current));
      index += 1;
    }
    result.push({ role: "user", content: toolResultBlocks });
  }

  return result;
}

function toStopReason(reason: string | undefined): ConverseStopReason {
  if (reason === "tool_use") {
    return "tool_use";
  }
  if (reason === "max_tokens") {
    return "max_tokens";
  }
  return "end_turn";
}

export class AnthropicProvider implements ToolCapableProvider {
  name = "anthropic";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "claude-sonnet-4-6";
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01"
    };
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: this.headers(),
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

  async converse(request: ConverseRequest): Promise<ConverseResponse> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.system,
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters
        })),
        messages: toAnthropicMessages(request.messages)
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

    const toolCalls: ToolCall[] = data.content
      .filter((block) => block.type === "tool_use" && block.id && block.name)
      .map((block) => ({
        id: block.id as string,
        name: block.name as string,
        input: block.input ?? {}
      }));

    return { text, toolCalls, stopReason: toStopReason(data.stop_reason) };
  }
}
