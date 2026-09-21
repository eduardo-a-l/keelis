import type { Task } from "./task.js";

export type MissionStatus = "PLANNING" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED";

export interface Mission {
  id: string;
  objective: string;
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MissionState {
  mission: Mission;
  tasks: Task[];
}
