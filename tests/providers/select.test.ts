import { describe, expect, it } from "vitest";
import { selectProviderChoice } from "../../src/providers/select.js";

describe("selectProviderChoice", () => {
  it("honors an explicit KEELIS_PROVIDER=gemini", () => {
    expect(selectProviderChoice({ KEELIS_PROVIDER: "gemini", ANTHROPIC_API_KEY: "x" })).toBe(
      "gemini"
    );
  });

  it("honors an explicit KEELIS_PROVIDER=anthropic", () => {
    expect(selectProviderChoice({ KEELIS_PROVIDER: "anthropic", GEMINI_API_KEY: "x" })).toBe(
      "anthropic"
    );
  });

  it("is case-insensitive", () => {
    expect(selectProviderChoice({ KEELIS_PROVIDER: "GEMINI" })).toBe("gemini");
  });

  it("falls back to gemini when only a Gemini key is set", () => {
    expect(selectProviderChoice({ GEMINI_API_KEY: "x" })).toBe("gemini");
  });

  it("defaults to anthropic when both or neither key is set", () => {
    expect(selectProviderChoice({})).toBe("anthropic");
    expect(selectProviderChoice({ ANTHROPIC_API_KEY: "x", GEMINI_API_KEY: "y" })).toBe("anthropic");
  });
});
