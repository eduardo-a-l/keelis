import { spawn } from "node:child_process";

export interface Checkpointer {
  create(label: string): Promise<string>;
  restore(checkpointId: string): Promise<void>;
}

function runGit(workdir: string, args: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd: workdir, shell: false });
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

export class GitCheckpointer implements Checkpointer {
  private repoReady = false;

  constructor(
    private readonly workdir: string,
    private readonly run: (
      workdir: string,
      args: string[]
    ) => Promise<{ code: number | null; output: string }> = runGit
  ) {}

  private async ensureRepo(): Promise<void> {
    if (this.repoReady) {
      return;
    }
    const check = await this.run(this.workdir, ["rev-parse", "--is-inside-work-tree"]);
    if (check.code !== 0) {
      await this.run(this.workdir, ["init"]);
      await this.run(this.workdir, ["config", "user.email", "keelis@local"]);
      await this.run(this.workdir, ["config", "user.name", "Keelis"]);
    }
    this.repoReady = true;
  }

  async create(label: string): Promise<string> {
    await this.ensureRepo();
    await this.run(this.workdir, ["add", "-A"]);
    const commit = await this.run(this.workdir, [
      "commit",
      "--allow-empty",
      "--no-verify",
      "-m",
      `keelis checkpoint: ${label}`
    ]);
    if (commit.code !== 0) {
      throw new Error(`Failed to create checkpoint "${label}": ${commit.output}`);
    }
    const sha = await this.run(this.workdir, ["rev-parse", "HEAD"]);
    if (sha.code !== 0) {
      throw new Error(`Failed to read checkpoint sha: ${sha.output}`);
    }
    return sha.output.trim();
  }

  async restore(checkpointId: string): Promise<void> {
    const reset = await this.run(this.workdir, ["reset", "--hard", checkpointId]);
    if (reset.code !== 0) {
      throw new Error(`Failed to restore checkpoint ${checkpointId}: ${reset.output}`);
    }
    await this.run(this.workdir, ["clean", "-fd"]);
  }
}

export class NullCheckpointer implements Checkpointer {
  async create(): Promise<string> {
    return "";
  }

  async restore(): Promise<void> {
    return;
  }
}
