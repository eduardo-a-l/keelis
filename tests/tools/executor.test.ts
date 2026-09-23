import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ToolExecutor } from "../../src/tools/executor.js";
import type { ToolCall } from "../../src/tools/types.js";

function call(name: string, input: Record<string, unknown>): ToolCall {
  return { id: `call-${name}`, name, input };
}

describe("ToolExecutor", () => {
  let workdir: string;

  beforeEach(async () => {
    workdir = await mkdtemp(path.join(os.tmpdir(), "keelis-test-"));
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it("writes and reads a file under AUTO permission with no confirm calls", async () => {
    let confirmCalls = 0;
    const executor = new ToolExecutor({
      workdir,
      permission: "AUTO",
      confirm: async () => {
        confirmCalls += 1;
        return true;
      }
    });

    const writeResult = await executor.execute(
      call("write_file", { path: "a.txt", content: "hello" })
    );
    expect(writeResult.isError).toBeUndefined();
    expect(confirmCalls).toBe(0);

    const readResult = await executor.execute(call("read_file", { path: "a.txt" }));
    expect(readResult.output).toBe("hello");

    const onDisk = await readFile(path.join(workdir, "a.txt"), "utf8");
    expect(onDisk).toBe("hello");
  });

  it("lists a directory", async () => {
    const executor = new ToolExecutor({ workdir, permission: "AUTO", confirm: async () => true });
    await executor.execute(call("write_file", { path: "nested/file.txt", content: "x" }));

    const result = await executor.execute(call("list_directory", { path: "." }));
    expect(result.output).toContain("d nested");
  });

  it("rejects a read outside the working directory", async () => {
    const executor = new ToolExecutor({ workdir, permission: "AUTO", confirm: async () => true });
    const result = await executor.execute(call("read_file", { path: "../outside.txt" }));
    expect(result.isError).toBe(true);
    expect(result.output).toContain("escapes");
  });

  it("asks for approval before writing under SUPERVISED, and honors a denial", async () => {
    const confirmations: string[] = [];
    const executor = new ToolExecutor({
      workdir,
      permission: "SUPERVISED",
      confirm: async (message) => {
        confirmations.push(message);
        return false;
      }
    });

    const result = await executor.execute(call("write_file", { path: "a.txt", content: "hi" }));

    expect(result.isError).toBe(true);
    expect(confirmations).toHaveLength(1);
    await expect(readFile(path.join(workdir, "a.txt"), "utf8")).rejects.toThrow();
  });

  it("does not ask for approval before reading under SUPERVISED", async () => {
    let confirmCalls = 0;
    const executor = new ToolExecutor({
      workdir,
      permission: "SUPERVISED",
      confirm: async () => {
        confirmCalls += 1;
        return true;
      }
    });
    await executor.execute(call("write_file", { path: "a.txt", content: "hi" }));
    confirmCalls = 0;

    await executor.execute(call("read_file", { path: "a.txt" }));
    expect(confirmCalls).toBe(0);
  });

  it("asks for approval before every tool under MANUAL, including reads", async () => {
    let confirmCalls = 0;
    const executor = new ToolExecutor({
      workdir,
      permission: "MANUAL",
      confirm: async () => {
        confirmCalls += 1;
        return true;
      }
    });
    await executor.execute(call("write_file", { path: "a.txt", content: "hi" }));
    confirmCalls = 0;

    await executor.execute(call("read_file", { path: "a.txt" }));
    expect(confirmCalls).toBe(1);
  });

  it("rejects a command that is not on the allow-list", async () => {
    const executor = new ToolExecutor({ workdir, permission: "AUTO", confirm: async () => true });
    const result = await executor.execute(
      call("run_command", { command: "rm", args: ["-rf", "."] })
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("not allowed");
  });

  it("runs an allow-listed command", async () => {
    const executor = new ToolExecutor({
      workdir,
      permission: "AUTO",
      confirm: async () => true,
      allowedCommands: ["node"]
    });
    const result = await executor.execute(
      call("run_command", { command: "node", args: ["-e", "console.log('ok')"] })
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("ok");
  });

  it("returns an error for an unknown tool", async () => {
    const executor = new ToolExecutor({ workdir, permission: "AUTO", confirm: async () => true });
    const result = await executor.execute(call("delete_everything", {}));
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Unknown tool");
  });
});
