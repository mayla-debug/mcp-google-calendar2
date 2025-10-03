import path from "node:path";

/** Directory base dell’app quando gira su Smithery */
export const BASE_DIR = process.cwd();

/** Join relativo alla base */
export function rel(...parts: string[]) {
  return path.join(BASE_DIR, ...parts);
}
