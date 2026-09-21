export type TaskStatus =
  "QUEUED" | "READY" | "RUNNING" | "BLOCKED" | "WAITING" | "FAILED" | "COMPLETED" | "CANCELLED";

export type TaskOrigin = "user" | "planner" | "agent";

export interface Task {
  id: string;
  missionId: string;
  title: string;
  description: string;
  status: TaskStatus;
  dependsOn: string[];
  createdBy: TaskOrigin;
  spawnedFrom?: string;
  spawnReason?: string;
  createdAt: string;
  updatedAt: string;
}

const TERMINAL_STATUSES: TaskStatus[] = ["COMPLETED", "CANCELLED"];

export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  const allowed: Record<TaskStatus, TaskStatus[]> = {
    QUEUED: ["READY", "CANCELLED"],
    READY: ["RUNNING", "BLOCKED", "CANCELLED"],
    RUNNING: ["WAITING", "COMPLETED", "FAILED", "BLOCKED"],
    BLOCKED: ["READY", "CANCELLED"],
    WAITING: ["RUNNING", "FAILED"],
    FAILED: ["READY", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: []
  };

  return allowed[from].includes(to);
}

export function isReady(task: Task, completedIds: Set<string>): boolean {
  if (task.status !== "QUEUED" && task.status !== "BLOCKED") {
    return false;
  }

  return task.dependsOn.every((id) => completedIds.has(id));
}
