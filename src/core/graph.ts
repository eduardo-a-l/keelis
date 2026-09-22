import { canTransition, isReady, type Task, type TaskStatus } from "./task.js";

export interface SpawnInput {
  id: string;
  title: string;
  description: string;
  reason: string;
}

export class TaskGraph {
  private tasks: Map<string, Task>;

  constructor(tasks: Task[] = []) {
    this.tasks = new Map(tasks.map((task) => [task.id, task]));
  }

  allTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  addTask(task: Task): void {
    this.tasks.set(task.id, task);
  }

  private completedIds(): Set<string> {
    return new Set(
      this.allTasks()
        .filter((task) => task.status === "COMPLETED")
        .map((task) => task.id)
    );
  }

  getReadyTasks(): Task[] {
    const completed = this.completedIds();
    return this.allTasks().filter((task) => isReady(task, completed));
  }

  transition(id: string, to: TaskStatus): Task {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Unknown task: ${id}`);
    }
    if (!canTransition(task.status, to)) {
      throw new Error(`Cannot transition task ${id} from ${task.status} to ${to}`);
    }
    task.status = to;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  spawnTask(parentId: string, input: SpawnInput): Task {
    const parent = this.tasks.get(parentId);
    if (!parent) {
      throw new Error(`Unknown parent task: ${parentId}`);
    }
    if (this.tasks.has(input.id)) {
      throw new Error(`Task ${input.id} already exists`);
    }

    const now = new Date().toISOString();
    const child: Task = {
      id: input.id,
      missionId: parent.missionId,
      title: input.title,
      description: input.description,
      status: "QUEUED",
      dependsOn: [],
      createdBy: "agent",
      spawnedFrom: parentId,
      spawnReason: input.reason,
      createdAt: now,
      updatedAt: now
    };

    this.tasks.set(child.id, child);
    if (!parent.dependsOn.includes(child.id)) {
      parent.dependsOn = [...parent.dependsOn, child.id];
    }
    if (parent.status !== "BLOCKED") {
      this.transition(parentId, "BLOCKED");
    }

    return child;
  }

  isMissionComplete(): boolean {
    return this.allTasks().every(
      (task) => task.status === "COMPLETED" || task.status === "CANCELLED"
    );
  }
}
