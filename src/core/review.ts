import type { Provider } from "../providers/provider.js";
import type { Task } from "./task.js";

export interface ReviewResult {
  approved: boolean;
  feedback: string;
}

export interface Reviewer {
  review(task: Task, resultSummary: string): Promise<ReviewResult>;
}

function buildPrompt(task: Task, resultSummary: string): string {
  return [
    "You are the review module of an autonomous engineering system.",
    "A task was marked as attempted. Judge whether the work summary actually",
    "satisfies the task description. Be skeptical: only approve if the",
    "summary clearly and specifically satisfies the description. Vague or",
    "generic summaries should not be approved.",
    'Respond with JSON only, no prose: { "approved": boolean, "feedback": string }.',
    "",
    `Task title: ${task.title}`,
    `Task description: ${task.description}`,
    `Work summary: ${resultSummary}`
  ].join("\n");
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```json/, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
}

function parseReview(text: string): ReviewResult {
  const parsed = JSON.parse(stripFences(text)) as Partial<ReviewResult>;
  if (typeof parsed.approved !== "boolean") {
    throw new Error("Reviewer response missing boolean 'approved'");
  }
  return { approved: parsed.approved, feedback: parsed.feedback ?? "" };
}

export class SimpleReviewer implements Reviewer {
  constructor(private readonly provider: Provider) {}

  async review(task: Task, resultSummary: string): Promise<ReviewResult> {
    const result = await this.provider.complete({
      prompt: buildPrompt(task, resultSummary),
      maxTokens: 500
    });
    return parseReview(result.text);
  }
}
