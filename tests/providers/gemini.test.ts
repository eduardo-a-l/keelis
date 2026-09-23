import { describe, expect, it } from "vitest";
import { toGeminiContents } from "../../src/providers/gemini.js";
import type { ConverseMessage } from "../../src/providers/converse.js";

describe("toGeminiContents", () => {
  it("maps a plain user message", () => {
    const messages: ConverseMessage[] = [{ role: "user", content: "hello" }];
    expect(toGeminiContents(messages)).toEqual([{ role: "user", parts: [{ text: "hello" }] }]);
  });

  it("maps an assistant tool call with a dummy signature when none was provided", () => {
    const messages: ConverseMessage[] = [
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "c1", name: "list_directory", input: { path: "." } }]
      }
    ];

    const result = toGeminiContents(messages);

    expect(result).toEqual([
      {
        role: "model",
        parts: [
          {
            functionCall: { name: "list_directory", args: { path: "." } },
            thoughtSignature: "skip_thought_signature_validator"
          }
        ]
      }
    ]);
  });

  it("threads a real thought signature back verbatim", () => {
    const messages: ConverseMessage[] = [
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "c1",
            name: "read_file",
            input: { path: "a.txt" },
            providerMetadata: "real-signature-abc"
          }
        ]
      }
    ];

    const result = toGeminiContents(messages);

    expect(result[0]?.parts[0]?.thoughtSignature).toBe("real-signature-abc");
  });

  it("resolves the function name for a tool_result by looking up its toolCallId", () => {
    const messages: ConverseMessage[] = [
      { role: "user", content: "do it" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "c1", name: "read_file", input: { path: "a.txt" } }]
      },
      { role: "tool_result", toolCallId: "c1", content: "file contents" }
    ];

    const result = toGeminiContents(messages);

    expect(result[2]).toEqual({
      role: "user",
      parts: [
        {
          functionResponse: {
            name: "read_file",
            response: { content: "file contents", isError: false }
          }
        }
      ]
    });
  });

  it("groups consecutive tool_result messages into a single content entry", () => {
    const messages: ConverseMessage[] = [
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "c1", name: "read_file", input: { path: "a.txt" } },
          { id: "c2", name: "list_directory", input: { path: "." } }
        ]
      },
      { role: "tool_result", toolCallId: "c1", content: "content a" },
      { role: "tool_result", toolCallId: "c2", content: "content b", isError: true }
    ];

    const result = toGeminiContents(messages);

    expect(result).toHaveLength(2);
    expect(result[1]?.parts).toHaveLength(2);
    expect(result[1]?.parts[0]?.functionResponse?.name).toBe("read_file");
    expect(result[1]?.parts[1]?.functionResponse?.response.isError).toBe(true);
  });

  it("falls back to unknown_tool if a tool_result references an unseen call id", () => {
    const messages: ConverseMessage[] = [
      { role: "tool_result", toolCallId: "missing", content: "x" }
    ];

    const result = toGeminiContents(messages);

    expect(result[0]?.parts[0]?.functionResponse?.name).toBe("unknown_tool");
  });
});
