import { randomUUID } from "node:crypto";
import { SimpleAgent } from "../agents/simpleAgent.js";
import type { Mission, MissionState } from "../core/mission.js";
import { TaskGraph } from "../core/graph.js";
import { SimplePlanner } from "../core/planner.js";
import { loadMissionState, missionExists, saveMissionState } from "../core/persistence.js";
import { SimpleReviewer } from "../core/review.js";
import { MissionRunner, type RunnerEvent } from "../core/runner.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import { GeminiProvider } from "../providers/gemini.js";
import type { Provider } from "../providers/provider.js";
import { selectProviderChoice } from "../providers/select.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function buildProvider(): Provider {
  const choice = selectProviderChoice(process.env);
  if (choice === "gemini") {
    return new GeminiProvider({ apiKey: requireEnv("GEMINI_API_KEY") });
  }
  return new AnthropicProvider({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
}

function logEvent(event: RunnerEvent): void {
  const label = `${event.task.id} [${event.task.title}]`;
  if (event.type === "started") {
    console.log(`Running ${label}`);
  } else if (event.type === "blocked") {
    console.log(`Blocked ${label}: ${event.detail}`);
  } else if (event.type === "approved") {
    console.log(`Completed ${label}`);
  } else if (event.type === "rejected") {
    console.log(`Review rejected ${label}, retrying: ${event.detail}`);
  } else if (event.type === "cancelled") {
    console.log(`Cancelled ${label} after max attempts: ${event.detail}`);
  }
}

function buildRunner(graph: TaskGraph, provider: Provider): MissionRunner {
  return new MissionRunner(graph, {
    agent: new SimpleAgent(provider),
    reviewer: new SimpleReviewer(provider),
    onEvent: logEvent
  });
}

function printSummary(mission: Mission, graph: TaskGraph): void {
  console.log(`Mission ${mission.id} status: ${mission.status}`);
  for (const task of graph.allTasks()) {
    console.log(`  ${task.id} [${task.status}] ${task.title}`);
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

  await buildRunner(graph, provider).run();

  mission.status = graph.isMissionComplete() ? "COMPLETED" : "RUNNING";
  mission.updatedAt = new Date().toISOString();
  await saveMissionState({ mission, tasks: graph.allTasks() });

  printSummary(mission, graph);
}

async function continueMission(missionId: string): Promise<void> {
  if (!(await missionExists(missionId))) {
    throw new Error(`No saved state for mission ${missionId}`);
  }

  const provider = buildProvider();
  const state: MissionState = await loadMissionState(missionId);
  const graph = new TaskGraph(state.tasks);

  await buildRunner(graph, provider).run();

  state.mission.status = graph.isMissionComplete() ? "COMPLETED" : "RUNNING";
  state.mission.updatedAt = new Date().toISOString();
  await saveMissionState({ mission: state.mission, tasks: graph.allTasks() });

  printSummary(state.mission, graph);
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
