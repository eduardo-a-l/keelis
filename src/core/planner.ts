import type { Provider } from "../providers/provider.js";
import { stripFences } from "./jsonResponse.js";
import type { Task } from "./task.js";

export interface PlannedTask {
  id: string;
  title: string;
  description: string;
  dependsOn?: string[];
}

export interface Planner {
  plan(missionId: string, objective: string): Promise<Task[]>;
}

function buildPrompt(objective: string): string {
  return [
    "You are the planning module of an autonomous engineering system.",
    "Break the following objective into a flat, ordered list of concrete tasks.",
    "Respond with JSON only, no prose and no markdown fences: an array of",
    "objects with fields id, title, description, dependsOn (array of task ids).",
    "Use short sequential ids like t1, t2, t3.",
    "",
    `Objective: ${objective}`
  ].join("\n");
}

function isPlannedTask(value: unknown): value is PlannedTask {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<PlannedTask>;
  const hasDependsOn =
    candidate.dependsOn === undefined ||
    (Array.isArray(candidate.dependsOn) &&
      candidate.dependsOn.every((id) => typeof id === "string"));

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.description === "string" &&
    hasDependsOn
  );
}

function parsePlan(text: string): PlannedTask[] {
  const parsed: unknown = JSON.parse(stripFences(text));
  if (!Array.isArray(parsed)) {
    throw new Error("Planner response was not a JSON array");
  }
  if (!parsed.every(isPlannedTask)) {
    throw new Error("Planner response contained a task missing a string id, title, or description");
  }
  return parsed;
}

export class SimplePlanner implements Planner {
  constructor(private readonly provider: Provider) {}

  async plan(missionId: string, objective: string): Promise<Task[]> {
    const result = await this.provider.complete({
      prompt: buildPrompt(objective),
      maxTokens: 2000
    });

    const planned = parsePlan(result.text);
    const now = new Date().toISOString();

    return planned.map((item) => ({
      id: item.id,
      missionId,
      title: item.title,
      description: item.description,
      status: "QUEUED",
      dependsOn: item.dependsOn ?? [],
      createdBy: "planner",
      createdAt: now,
      updatedAt: now
    }));
  }
}
