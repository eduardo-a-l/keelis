import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveSafePath } from "./paths.js";
import type { PermissionLevel, ToolCall, ToolCallResult, ToolDefinition } from "./types.js";

const DEFAULT_ALLOWED_COMMANDS = ["git", "npm", "npx", "node"];
const DEFAULT_COMMAND_TIMEOUT_MS = 30000;

export interface ToolExecutorOptions {
  workdir: string;
  permission: PermissionLevel;
  confirm: (message: string) => Promise<boolean>;
  allowedCommands?: string[];
  commandTimeoutMs?: number;
}

function runCommand(
  workdir: string,
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: workdir, shell: false, timeout: timeoutMs });
    let output = "";

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ code: null, output: `${output}\n${error.message}` });
    });
    child.on("close", (code) => {
      resolve({ code, output });
    });
  });
}

export class ToolExecutor {
  private readonly allowedCommands: Set<string>;
  private readonly commandTimeoutMs: number;

  constructor(private readonly options: ToolExecutorOptions) {
    this.allowedCommands = new Set(options.allowedCommands ?? DEFAULT_ALLOWED_COMMANDS);
    this.commandTimeoutMs = options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  }

  definitions(): ToolDefinition[] {
    return [
      {
        name: "read_file",
        description: "Read the contents of a text file, path relative to the project root.",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"]
        }
      },
      {
        name: "write_file",
        description:
          "Write text content to a file, path relative to the project root. Creates parent directories as needed.",
        parameters: {
          type: "object",
          properties: { path: { type: "string" }, content: { type: "string" } },
          required: ["path", "content"]
        }
      },
      {
        name: "list_directory",
        description: "List files and directories at a path relative to the project root.",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"]
        }
      },
      {
        name: "run_command",
        description: `Run an allow-listed command (${Array.from(this.allowedCommands).join(", ")}) in the project root.`,
        parameters: {
          type: "object",
          properties: {
            command: { type: "string" },
            args: { type: "array", items: { type: "string" } }
          },
          required: ["command"]
        }
      }
    ];
  }

  private requiresApproval(toolName: string): boolean {
    if (this.options.permission === "AUTO") {
      return false;
    }
    if (this.options.permission === "MANUAL") {
      return true;
    }
    return toolName === "write_file" || toolName === "run_command";
  }

  private async approve(toolName: string, description: string): Promise<boolean> {
    if (!this.requiresApproval(toolName)) {
      return true;
    }
    return this.options.confirm(description);
  }

  async execute(call: ToolCall): Promise<ToolCallResult> {
    try {
      switch (call.name) {
        case "read_file":
          return await this.readFile(call);
        case "write_file":
          return await this.writeFile(call);
        case "list_directory":
          return await this.listDirectory(call);
        case "run_command":
          return await this.runCommand(call);
        default:
          return { id: call.id, output: `Unknown tool: ${call.name}`, isError: true };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { id: call.id, output: message, isError: true };
    }
  }

  private async readFile(call: ToolCall): Promise<ToolCallResult> {
    const relativePath = String(call.input.path ?? "");
    const approved = await this.approve("read_file", `Read ${relativePath}?`);
    if (!approved) {
      return { id: call.id, output: `Read of ${relativePath} was not approved.`, isError: true };
    }
    const resolved = resolveSafePath(this.options.workdir, relativePath);
    const content = await readFile(resolved, "utf8");
    return { id: call.id, output: content };
  }

  private async writeFile(call: ToolCall): Promise<ToolCallResult> {
    const relativePath = String(call.input.path ?? "");
    const content = String(call.input.content ?? "");
    const approved = await this.approve("write_file", `Write to ${relativePath}?`);
    if (!approved) {
      return { id: call.id, output: `Write to ${relativePath} was not approved.`, isError: true };
    }
    const resolved = resolveSafePath(this.options.workdir, relativePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, content, "utf8");
    return { id: call.id, output: `Wrote ${content.length} bytes to ${relativePath}` };
  }

  private async listDirectory(call: ToolCall): Promise<ToolCallResult> {
    const relativePath = String(call.input.path ?? ".");
    const approved = await this.approve("list_directory", `List ${relativePath}?`);
    if (!approved) {
      return { id: call.id, output: `Listing ${relativePath} was not approved.`, isError: true };
    }
    const resolved = resolveSafePath(this.options.workdir, relativePath);
    const entries = await readdir(resolved, { withFileTypes: true });
    const listing = entries
      .map((entry) => `${entry.isDirectory() ? "d" : "f"} ${entry.name}`)
      .join("\n");
    return { id: call.id, output: listing };
  }

  private async runCommand(call: ToolCall): Promise<ToolCallResult> {
    const command = String(call.input.command ?? "");
    const args = Array.isArray(call.input.args) ? call.input.args.map(String) : [];

    if (!this.allowedCommands.has(command)) {
      return {
        id: call.id,
        output: `Command not allowed: ${command}. Allowed: ${Array.from(this.allowedCommands).join(", ")}`,
        isError: true
      };
    }

    const approved = await this.approve("run_command", `Run ${command} ${args.join(" ")}?`);
    if (!approved) {
      return { id: call.id, output: `Command ${command} was not approved.`, isError: true };
    }

    const result = await runCommand(this.options.workdir, command, args, this.commandTimeoutMs);
    return { id: call.id, output: result.output, isError: result.code !== 0 };
  }
}
