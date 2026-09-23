import type { ToolCall, ToolDefinition } from "../tools/types.js";
import type { Provider } from "./provider.js";

export type ConverseMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: ToolCall[] }
  | { role: "tool_result"; toolCallId: string; content: string; isError?: boolean };

export interface ConverseRequest {
  system: string;
  messages: ConverseMessage[];
  tools: ToolDefinition[];
  maxTokens: number;
}

export type ConverseStopReason = "tool_use" | "end_turn" | "max_tokens";

export interface ConverseResponse {
  text: string;
  toolCalls: ToolCall[];
  stopReason: ConverseStopReason;
}

export interface ToolCapableProvider extends Provider {
  converse(request: ConverseRequest): Promise<ConverseResponse>;
}

export function isToolCapable(provider: Provider): provider is ToolCapableProvider {
  return typeof (provider as Partial<ToolCapableProvider>).converse === "function";
}
