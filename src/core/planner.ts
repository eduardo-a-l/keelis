import type { Provider } from "../providers/provider.js";
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

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```json/, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
}

function parsePlan(text: string): PlannedTask[] {
  const parsed = JSON.parse(stripFences(text));
  if (!Array.isArray(parsed)) {
    throw new Error("Planner response was not a JSON array");
  }
  return parsed as PlannedTask[];
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
