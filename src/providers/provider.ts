export interface CompletionRequest {
  prompt: string;
  maxTokens: number;
}

export interface CompletionResult {
  text: string;
}

export interface Provider {
  name: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
