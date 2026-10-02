import { describe, expect, it } from "vitest";
import { SimplePlanner } from "../../src/core/planner.js";
import type {
  CompletionRequest,
  CompletionResult,
  Provider
} from "../../src/providers/provider.js";

class FakeProvider implements Provider {
  name = "fake";
  constructor(private readonly text: string) {}

  async complete(_request: CompletionRequest): Promise<CompletionResult> {
    return { text: this.text };
  }
}

describe("SimplePlanner", () => {
  it("parses a plain JSON array into tasks", async () => {
    const planner = new SimplePlanner(
      new FakeProvider('[{"id": "t1", "title": "set up project", "description": "init repo"}]')
    );
    const tasks = await planner.plan("m1", "build a thing");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: "t1",
      missionId: "m1",
      title: "set up project",
      description: "init repo",
      status: "QUEUED",
      dependsOn: [],
      createdBy: "planner"
    });
  });

  it("strips markdown fences before parsing", async () => {
    const planner = new SimplePlanner(
      new FakeProvider(
        '```json\n[{"id": "t1", "title": "a", "description": "b", "dependsOn": ["t0"]}]\n```'
      )
    );
    const tasks = await planner.plan("m1", "objective");
    expect(tasks[0]?.dependsOn).toEqual(["t0"]);
  });

  it("throws when the response is not a JSON array", async () => {
    const planner = new SimplePlanner(new FakeProvider('{"id": "t1"}'));
    await expect(planner.plan("m1", "objective")).rejects.toThrow(
      "Planner response was not a JSON array"
    );
  });

  it("throws when a task is missing a required string field", async () => {
    const planner = new SimplePlanner(new FakeProvider('[{"id": "t1", "title": "a"}]'));
    await expect(planner.plan("m1", "objective")).rejects.toThrow(
      "missing a string id, title, or description"
    );
  });

  it("throws when dependsOn contains a non-string entry", async () => {
    const planner = new SimplePlanner(
      new FakeProvider('[{"id": "t1", "title": "a", "description": "b", "dependsOn": [1]}]')
    );
    await expect(planner.plan("m1", "objective")).rejects.toThrow();
  });
});
