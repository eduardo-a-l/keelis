import type { TaskGraph } from "../core/graph.js";
import type { Task } from "../core/task.js";

export interface AgentContext {
  task: Task;
  graph: TaskGraph;
}

export interface AgentResult {
  success: boolean;
  summary: string;
}

export interface Agent {
  name: string;
  run(context: AgentContext): Promise<AgentResult>;
}
