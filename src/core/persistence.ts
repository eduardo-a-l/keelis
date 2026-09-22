import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MissionState } from "./mission.js";

const STATE_DIR = ".keelis";

function statePath(missionId: string): string {
  return path.join(STATE_DIR, `${missionId}.json`);
}

export async function saveMissionState(state: MissionState): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(statePath(state.mission.id), JSON.stringify(state, null, 2), "utf8");
}

export async function loadMissionState(missionId: string): Promise<MissionState> {
  const raw = await readFile(statePath(missionId), "utf8");
  return JSON.parse(raw) as MissionState;
}

export async function missionExists(missionId: string): Promise<boolean> {
  try {
    await readFile(statePath(missionId), "utf8");
    return true;
  } catch {
    return false;
  }
}
