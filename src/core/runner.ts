import type { Agent } from "../agents/index.js";
import type { Task } from "./task.js";
import type { TaskGraph } from "./graph.js";
import type { Reviewer } from "./review.js";

export interface RunnerEvent {
  type: "started" | "blocked" | "approved" | "rejected" | "cancelled";
  task: Task;
  detail?: string;
}

export interface RunnerOptions {
  agent: Agent;
  reviewer: Reviewer;
  maxAttempts?: number;
  onEvent?: (event: RunnerEvent) => void;
}

export class MissionRunner {
  private readonly maxAttempts: number;

  constructor(
    private readonly graph: TaskGraph,
    private readonly options: RunnerOptions
  ) {
    this.maxAttempts = options.maxAttempts ?? 3;
  }

  async run(): Promise<void> {
    let runnable = this.graph.getRunnableTasks();
    while (runnable.length > 0) {
      for (const task of runnable) {
        await this.step(task.id);
      }
      runnable = this.graph.getRunnableTasks();
    }
  }

  private emit(event: RunnerEvent): void {
    this.options.onEvent?.(event);
  }

  async step(taskId: string): Promise<void> {
    this.graph.transition(taskId, "RUNNING");
    const task = this.graph.getTask(taskId);
    if (!task) {
      return;
    }
    this.emit({ type: "started", task });

    const result = await this.options.agent.run({ task, graph: this.graph });
    const afterRun = this.graph.getTask(taskId);
    if (!afterRun) {
      return;
    }

    if (afterRun.status === "BLOCKED") {
      this.emit({ type: "blocked", task: afterRun, detail: result.summary });
      return;
    }

    const review = await this.options.reviewer.review(afterRun, result.summary);
    const attempts = (afterRun.attempts ?? 0) + 1;
    this.graph.updateTask(taskId, { attempts, lastReviewFeedback: review.feedback });

    if (review.approved) {
      this.graph.transition(taskId, "COMPLETED");
      this.emit({ type: "approved", task: afterRun, detail: review.feedback });
      return;
    }

    this.graph.transition(taskId, "FAILED");

    if (attempts >= this.maxAttempts) {
      this.graph.transition(taskId, "CANCELLED");
      this.emit({ type: "cancelled", task: afterRun, detail: review.feedback });
      return;
    }

    this.graph.transition(taskId, "READY");
    this.emit({ type: "rejected", task: afterRun, detail: review.feedback });
  }
}
