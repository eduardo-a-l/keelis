import path from "node:path";

export class PathEscapeError extends Error {
  constructor(relativePath: string) {
    super(`Path escapes the working directory: ${relativePath}`);
  }
}

export function resolveSafePath(workdir: string, relativePath: string): string {
  const resolvedWorkdir = path.resolve(workdir);
  const resolved = path.resolve(resolvedWorkdir, relativePath);
  const relative = path.relative(resolvedWorkdir, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PathEscapeError(relativePath);
  }

  return resolved;
}
