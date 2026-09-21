export interface AgentContext {
  missionId: string;
  taskId: string;
}

export interface AgentResult {
  success: boolean;
  summary: string;
}

export interface Agent {
  name: string;
  run(context: AgentContext): Promise<AgentResult>;
}
