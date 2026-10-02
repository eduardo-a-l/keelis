import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitCheckpointer } from "../../src/core/checkpoint.js";

describe("GitCheckpointer", () => {
  let workdir: string;

  beforeEach(async () => {
    workdir = await mkdtemp(path.join(tmpdir(), "keelis-checkpoint-"));
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it("initializes a repo and creates a checkpoint even with no changes", async () => {
    const checkpointer = new GitCheckpointer(workdir);
    const checkpointId = await checkpointer.create("initial");
    expect(checkpointId).toMatch(/^[0-9a-f]{40}$/);
  });

  it("restores files to the checkpointed state", async () => {
    const checkpointer = new GitCheckpointer(workdir);
    const filePath = path.join(workdir, "file.txt");
    await writeFile(filePath, "before", "utf8");

    const checkpointId = await checkpointer.create("before edit");
    await writeFile(filePath, "after", "utf8");

    await checkpointer.restore(checkpointId);
    const content = await readFile(filePath, "utf8");
    expect(content).toBe("before");
  });

  it("removes files created after the checkpoint", async () => {
    const checkpointer = new GitCheckpointer(workdir);
    const checkpointId = await checkpointer.create("empty state");
    const newFilePath = path.join(workdir, "new-file.txt");
    await writeFile(newFilePath, "should be removed", "utf8");

    await checkpointer.restore(checkpointId);

    await expect(readFile(newFilePath, "utf8")).rejects.toThrow();
  });

  it("reuses an existing repo instead of reinitializing it", async () => {
    const first = new GitCheckpointer(workdir);
    await first.create("first");

    const second = new GitCheckpointer(workdir);
    const secondId = await second.create("second");
    expect(secondId).toMatch(/^[0-9a-f]{40}$/);
  });
});
