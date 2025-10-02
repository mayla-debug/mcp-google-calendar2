// src/paths.ts
import path from "node:path";

/**
 * Directory base in runtime (funziona in CJS e in Docker).
 * In CJS __dirname esiste; altrimenti ripieghiamo su process.cwd()
 */
export const BASE_DIR =
  typeof __dirname !== "undefined" ? __dirname : process.cwd();

export function rel(...parts: string[]) {
  return path.join(BASE_DIR, ...parts);
}
