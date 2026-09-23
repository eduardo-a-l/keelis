import { randomUUID } from "node:crypto";
import type { ToolCall } from "../tools/types.js";
import type {
  ConverseMessage,
  ConverseRequest,
  ConverseResponse,
  ConverseStopReason,
  ToolCapableProvider
} from "./converse.js";
import type { CompletionRequest, CompletionResult } from "./provider.js";

export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
}

const DUMMY_THOUGHT_SIGNATURE = "skip_thought_signature_validator";

interface GeminiFunctionCall {
  name?: string;
  args?: Record<string, unknown>;
}

interface GeminiFunctionResponse {
  name: string;
  response: Record<string, unknown>;
}

interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: GeminiFunctionResponse;
  thoughtSignature?: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
}

interface CallInfo {
  name: string;
  signature: string;
}

export function toGeminiContents(messages: ConverseMessage[]): GeminiContent[] {
  const result: GeminiContent[] = [];
  const callInfo = new Map<string, CallInfo>();
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];
    if (!message) {
      break;
    }

    if (message.role === "user") {
      result.push({ role: "user", parts: [{ text: message.content }] });
      index += 1;
      continue;
    }

    if (message.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (message.content) {
        parts.push({ text: message.content });
      }
      for (const call of message.toolCalls) {
        const signature =
          typeof call.providerMetadata === "string"
            ? call.providerMetadata
            : DUMMY_THOUGHT_SIGNATURE;
        callInfo.set(call.id, { name: call.name, signature });
        parts.push({
          functionCall: { name: call.name, args: call.input },
          thoughtSignature: signature
        });
      }
      result.push({ role: "model", parts });
      index += 1;
      continue;
    }

    const parts: GeminiPart[] = [];
    while (index < messages.length) {
      const current = messages[index];
      if (!current || current.role !== "tool_result") {
        break;
      }
      const info = callInfo.get(current.toolCallId);
      parts.push({
        functionResponse: {
          name: info?.name ?? "unknown_tool",
          response: { content: current.content, isError: current.isError ?? false }
        }
      });
      index += 1;
    }
    result.push({ role: "user", parts });
  }

  return result;
}

function toStopReason(toolCalls: ToolCall[], finishReason: string | undefined): ConverseStopReason {
  if (toolCalls.length > 0) {
    return "tool_use";
  }
  if (finishReason === "MAX_TOKENS") {
    return "max_tokens";
  }
  return "end_turn";
}

export class GeminiProvider implements ToolCapableProvider {
  name = "gemini";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: GeminiProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "gemini-3.6-flash";
  }

  private url(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const response = await fetch(this.url(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: { maxOutputTokens: request.maxTokens }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const text = (data.candidates ?? [])
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("");

    return { text };
  }

  async converse(request: ConverseRequest): Promise<ConverseResponse> {
    const response = await fetch(this.url(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: toGeminiContents(request.messages),
        tools: [
          {
            functionDeclarations: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parametersJsonSchema: tool.parameters
            }))
          }
        ],
        generationConfig: { maxOutputTokens: request.maxTokens }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const parts = data.candidates?.[0]?.content?.parts ?? [];

    const text = parts
      .filter((part) => typeof part.text === "string")
      .map((part) => part.text as string)
      .join("");

    const toolCalls: ToolCall[] = parts
      .filter((part) => part.functionCall && typeof part.functionCall.name === "string")
      .map((part) => {
        const functionCall = part.functionCall as GeminiFunctionCall;
        const id = `${functionCall.name}-${randomUUID()}`;
        const base: ToolCall = {
          id,
          name: functionCall.name as string,
          input: functionCall.args ?? {}
        };
        return part.thoughtSignature === undefined
          ? base
          : { ...base, providerMetadata: part.thoughtSignature };
      });

    return {
      text,
      toolCalls,
      stopReason: toStopReason(toolCalls, data.candidates?.[0]?.finishReason)
    };
  }
}
