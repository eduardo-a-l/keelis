import { describe, expect, it } from "vitest";
import { SimpleReviewer } from "../../src/core/review.js";
import type { Task } from "../../src/core/task.js";
import type {
  CompletionRequest,
  CompletionResult,
  Provider
} from "../../src/providers/provider.js";

function makeTask(): Task {
  const now = new Date().toISOString();
  return {
    id: "t1",
    missionId: "m1",
    title: "write tests",
    description: "add unit tests for the parser",
    status: "RUNNING",
    dependsOn: [],
    createdBy: "planner",
    createdAt: now,
    updatedAt: now
  };
}

class FakeProvider implements Provider {
  name = "fake";
  constructor(private readonly text: string) {}

  async complete(_request: CompletionRequest): Promise<CompletionResult> {
    return { text: this.text };
  }
}

describe("SimpleReviewer", () => {
  it("parses a plain JSON approval", async () => {
    const reviewer = new SimpleReviewer(
      new FakeProvider('{"approved": true, "feedback": "tests cover the parser"}')
    );
    const result = await reviewer.review(makeTask(), "added tests");
    expect(result).toEqual({ approved: true, feedback: "tests cover the parser" });
  });

  it("strips markdown fences before parsing", async () => {
    const reviewer = new SimpleReviewer(
      new FakeProvider('```json\n{"approved": false, "feedback": "no tests added"}\n```')
    );
    const result = await reviewer.review(makeTask(), "did nothing");
    expect(result).toEqual({ approved: false, feedback: "no tests added" });
  });

  it("throws when the response has no boolean approved field", async () => {
    const reviewer = new SimpleReviewer(new FakeProvider('{"feedback": "unclear"}'));
    await expect(reviewer.review(makeTask(), "summary")).rejects.toThrow();
  });
});
