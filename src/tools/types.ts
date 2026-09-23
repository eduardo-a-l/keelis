export type PermissionLevel = "AUTO" | "SUPERVISED" | "MANUAL";

export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  providerMetadata?: unknown;
}

export interface ToolCallResult {
  id: string;
  output: string;
  isError?: boolean;
}
