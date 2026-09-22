import { randomUUID } from "node:crypto";
import type { Mission, MissionState } from "../core/mission.js";
import { TaskGraph } from "../core/graph.js";
import { SimplePlanner } from "../core/planner.js";
import { loadMissionState, missionExists, saveMissionState } from "../core/persistence.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import type { Provider } from "../providers/provider.js";

function requireApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return key;
}

function buildProvider(): Provider {
  return new AnthropicProvider({ apiKey: requireApiKey() });
}

async function runReadyTasks(graph: TaskGraph): Promise<void> {
  let ready = graph.getReadyTasks();
  while (ready.length > 0) {
    for (const task of ready) {
      graph.transition(task.id, "RUNNING");
      console.log(`Running task ${task.id}: ${task.title}`);
      graph.transition(task.id, "COMPLETED");
      console.log(`Completed task ${task.id}`);
    }
    ready = graph.getReadyTasks();
  }
}

async function startMission(objective: string): Promise<void> {
  const provider = buildProvider();
  const planner = new SimplePlanner(provider);
  const missionId = randomUUID();
  const now = new Date().toISOString();

  const mission: Mission = {
    id: missionId,
    objective,
    status: "PLANNING",
    createdAt: now,
    updatedAt: now
  };

  const tasks = await planner.plan(missionId, objective);
  const graph = new TaskGraph(tasks);
  mission.status = "RUNNING";
  await saveMissionState({ mission, tasks: graph.allTasks() });

  await runReadyTasks(graph);

  mission.status = graph.isMissionComplete() ? "COMPLETED" : "RUNNING";
  mission.updatedAt = new Date().toISOString();
  await saveMissionState({ mission, tasks: graph.allTasks() });

  console.log(`Mission ${missionId} status: ${mission.status}`);
}

async function continueMission(missionId: string): Promise<void> {
  if (!(await missionExists(missionId))) {
    throw new Error(`No saved state for mission ${missionId}`);
  }

  const state: MissionState = await loadMissionState(missionId);
  const graph = new TaskGraph(state.tasks);

  await runReadyTasks(graph);

  state.mission.status = graph.isMissionComplete() ? "COMPLETED" : "RUNNING";
  state.mission.updatedAt = new Date().toISOString();
  await saveMissionState({ mission: state.mission, tasks: graph.allTasks() });

  console.log(`Mission ${missionId} status: ${state.mission.status}`);
}

function printUsage(): void {
  console.log("keelis v0.1.0");
  console.log("Usage:");
  console.log('  keelis start "<objective>"');
  console.log("  keelis continue <missionId>");
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  if (command === "start") {
    const objective = rest.join(" ");
    if (!objective) {
      console.error('Usage: keelis start "<objective>"');
      process.exitCode = 1;
      return;
    }
    await startMission(objective);
    return;
  }

  if (command === "continue") {
    const missionId = rest[0];
    if (!missionId) {
      console.error("Usage: keelis continue <missionId>");
      process.exitCode = 1;
      return;
    }
    await continueMission(missionId);
    return;
  }

  printUsage();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
