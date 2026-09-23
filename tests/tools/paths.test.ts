import path from "node:path";
import { describe, expect, it } from "vitest";
import { PathEscapeError, resolveSafePath } from "../../src/tools/paths.js";

describe("resolveSafePath", () => {
  const workdir = "/project/root";

  it("resolves a simple relative path inside the workdir", () => {
    expect(resolveSafePath(workdir, "src/index.ts")).toBe(path.resolve(workdir, "src/index.ts"));
  });

  it("resolves the workdir itself", () => {
    expect(resolveSafePath(workdir, ".")).toBe(path.resolve(workdir));
  });

  it("rejects a path that climbs above the workdir", () => {
    expect(() => resolveSafePath(workdir, "../outside.txt")).toThrow(PathEscapeError);
  });

  it("rejects a path that climbs above the workdir through nested segments", () => {
    expect(() => resolveSafePath(workdir, "src/../../outside.txt")).toThrow(PathEscapeError);
  });

  it("rejects an absolute path outside the workdir", () => {
    expect(() => resolveSafePath(workdir, "/etc/passwd")).toThrow(PathEscapeError);
  });

  it("allows an absolute path that happens to be inside the workdir", () => {
    const target = path.resolve(workdir, "nested/file.txt");
    expect(resolveSafePath(workdir, target)).toBe(target);
  });
});
