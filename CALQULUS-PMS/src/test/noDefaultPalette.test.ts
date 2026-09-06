import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");
const FORBIDDEN = /\b(?:emerald|indigo|violet|purple|teal|sky)-\d{2,3}\b/;

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, files);
    else if (/\.(tsx|ts|css)$/.test(name)) files.push(path);
  }
  return files;
}

describe("default Tailwind palettes are not used as chrome", () => {
  it("does not ship emerald/indigo/violet/purple/teal/sky shade classes", () => {
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const source = readFileSync(file, "utf8");
      if (FORBIDDEN.test(source)) hits.push(file.replace(`${process.cwd()}/`, ""));
    }
    expect(hits).toEqual([]);
  });
});
