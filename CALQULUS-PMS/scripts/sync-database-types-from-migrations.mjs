/**
 * Patch src/integrations/supabase/types.ts with tables and RPCs that exist
 * in supabase/migrations but were missing from the generated Database type.
 *
 * This is what made `.from('…')` / `.rpc('…')` collapse to `never` and
 * let `npm run typecheck` hide thousands of errors behind a vacuous root tsconfig.
 *
 * Re-runnable: replaces the PHASE12 marker blocks.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const typesPath = join(root, "src", "integrations", "supabase", "types.ts");
const migrationsDir = join(root, "supabase", "migrations");

const sqlTypeToTs = (sql) => {
  const t = sql.toLowerCase().replace(/\s+/g, " ").trim();
  if (t.includes("boolean") || t === "bool") return "boolean";
  if (t.startsWith("json")) return "Json";
  if (
    t.startsWith("int") ||
    t.startsWith("smallint") ||
    t.startsWith("bigint") ||
    t.startsWith("numeric") ||
    t.startsWith("decimal") ||
    t.startsWith("double") ||
    t.startsWith("real") ||
    t.startsWith("float") ||
    t.startsWith("money") ||
    t.startsWith("serial")
  ) {
    return "number";
  }
  if (t.includes("[]")) return "string[]";
  return "string";
};

const isConstraintLine = (line) =>
  /^(constraint|primary key|unique|check|foreign key|exclude|like)\b/i.test(line.trim());

const splitTopLevel = (body) => {
  const parts = [];
  let buf = "";
  let depth = 0;
  for (const ch of body) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
};

const tables = new Map();

const ensureTable = (name) => {
  if (!tables.has(name)) tables.set(name, new Map());
  return tables.get(name);
};

const addColumn = (table, name, sqlType, notNull, hasDefault) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) return;
  const cols = ensureTable(table);
  if (cols.has(name)) {
    const prev = cols.get(name);
    cols.set(name, {
      ts: sqlTypeToTs(sqlType) || prev.ts,
      notNull: prev.notNull || notNull,
      hasDefault: prev.hasDefault || hasDefault,
    });
    return;
  }
  cols.set(name, {
    ts: sqlTypeToTs(sqlType),
    notNull,
    hasDefault,
  });
};

const allSql = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
  .join("\n\n");

const stripped = allSql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--[^\n]*/g, "");

const createTableRe =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/gi;

for (const match of stripped.matchAll(createTableRe)) {
  const table = match[1];
  const body = match[2];
  for (const raw of splitTopLevel(body)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || isConstraintLine(line)) continue;
    const colMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+(.+)$/);
    if (!colMatch) continue;
    const col = colMatch[1];
    const rest = colMatch[2];
    const notNull = /\bnot\s+null\b/i.test(rest);
    const hasDefault = /\bdefault\b/i.test(rest) || /\bprimary\s+key\b/i.test(rest) || /\bserial\b/i.test(rest);
    const sqlType = rest
      .replace(/\bnot\s+null\b/gi, "")
      .replace(/\bdefault\b[\s\S]*/i, "")
      .replace(/\bprimary\s+key\b/gi, "")
      .replace(/\breferences\b[\s\S]*/i, "")
      .replace(/\bunique\b/gi, "")
      .replace(/\bcheck\b[\s\S]*/i, "")
      .replace(/\bcollate\b[\s\S]*/i, "")
      .trim();
    addColumn(table, col, sqlType || "text", notNull, hasDefault);
  }
}

const addColRe =
  /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s+([^;]+);/gi;

for (const match of stripped.matchAll(addColRe)) {
  const rest = match[3];
  addColumn(
    match[1],
    match[2],
    rest,
    /\bnot\s+null\b/i.test(rest),
    /\bdefault\b/i.test(rest),
  );
}

const functions = new Map();
const createFnRe =
  /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS\s+([a-zA-Z0-9_[\].\s]+)/gi;

for (const match of stripped.matchAll(createFnRe)) {
  const name = match[1];
  const argsRaw = match[2].trim();
  const returnsSql = match[3].trim();
  const args = {};
  if (argsRaw && !/^void$/i.test(argsRaw)) {
    for (const raw of splitTopLevel(argsRaw)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) continue;
      const parts = line.split(/\s+/);
      let idx = 0;
      if (/^(in|out|inout)$/i.test(parts[0])) idx = 1;
      const argName = parts[idx]?.replace(/^p_/, "p_");
      const argType = parts.slice(idx + 1).join(" ");
      if (argName && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(argName) && !/^(in|out|inout)$/i.test(argName)) {
        args[argName] = sqlTypeToTs(argType || "text");
      }
    }
  }
  functions.set(name, { args, returns: sqlTypeToTs(returnsSql) });
}

const typesSource = readFileSync(typesPath, "utf8");
const stripBlock = (src, begin, end) =>
  src.replace(new RegExp(`\\n      ,\\n      // ${begin}[\\s\\S]*?      // ${end}`, "g"), "");

let next = stripBlock(typesSource, "BEGIN PHASE12_MIGRATION_TABLES", "END PHASE12_MIGRATION_TABLES");
next = stripBlock(next, "BEGIN PHASE12_MIGRATION_FUNCTIONS", "END PHASE12_MIGRATION_FUNCTIONS");

const tablesSection = next.split("    Tables: {")[1]?.split("\n    Views: {")[0] || "";
const fnSection = next.split("    Functions: {")[1]?.split("\n    Enums: {")[0] || "";
const existingTables = new Set(
  [...tablesSection.matchAll(/\n      ([a-z0-9_]+): \{/g)].map((m) => m[1]),
);
const existingFns = new Set(
  [...fnSection.matchAll(/\n      ([a-z0-9_]+): \{/g)].map((m) => m[1]),
);

const emitTable = (name, cols) => {
  const rowLines = [];
  const insertLines = [];
  const updateLines = [];
  for (const [col, meta] of cols) {
    const optionalRow = meta.notNull ? "" : " | null";
    rowLines.push(`          ${col}: ${meta.ts}${optionalRow}`);
    const insertOptional = !meta.notNull || meta.hasDefault;
    insertLines.push(`          ${col}${insertOptional ? "?" : ""}: ${meta.ts}${meta.notNull ? "" : " | null"}`);
    updateLines.push(`          ${col}?: ${meta.ts}${meta.notNull ? "" : " | null"}`);
  }
  if (rowLines.length === 0) {
    return [
      `      ${name}: {`,
      "        Row: Record<string, Json | null>",
      "        Insert: Record<string, Json | null>",
      "        Update: Record<string, Json | null>",
      "        Relationships: []",
      "      }",
    ].join("\n");
  }
  return [
    `      ${name}: {`,
    "        Row: {",
    ...rowLines,
    "        }",
    "        Insert: {",
    ...insertLines,
    "        }",
    "        Update: {",
    ...updateLines,
    "        }",
    "        Relationships: []",
    "      }",
  ].join("\n");
};

const emitFn = (name, spec) => {
  const argKeys = Object.keys(spec.args);
  const argsTs =
    argKeys.length === 0
      ? "never"
      : `{ ${argKeys.map((k) => `${k}?: ${spec.args[k]}`).join("; ")} }`;
  return `      ${name}: { Args: ${argsTs}; Returns: ${spec.returns} }`;
};

const listFilesRecursive = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) return listFilesRecursive(path);
    return stats.isFile() ? [path] : [];
  });

const srcFromNames = new Set();
const srcRpcNames = new Set();
for (const file of listFilesRecursive(join(root, "src"))) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/\.from\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
    srcFromNames.add(match[1]);
  }
  for (const match of text.matchAll(/\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
    srcRpcNames.add(match[1]);
  }
}

for (const name of srcFromNames) {
  if (!tables.has(name) && !existingTables.has(name)) {
    ensureTable(name);
  }
}

const missingTables = [...tables.keys()]
  .filter((name) => !existingTables.has(name))
  .sort();
const missingFns = [...functions.keys()]
  .filter((name) => !existingFns.has(name) && srcRpcNames.has(name))
  .sort();

const tableBlock = [
  "      // BEGIN PHASE12_MIGRATION_TABLES",
  missingTables.map((name) => emitTable(name, tables.get(name))).join(",\n"),
  "      // END PHASE12_MIGRATION_TABLES",
].join("\n");

const fnBlock = [
  "      // BEGIN PHASE12_MIGRATION_FUNCTIONS",
  missingFns.map((name) => emitFn(name, functions.get(name))).join("\n"),
  "      // END PHASE12_MIGRATION_FUNCTIONS",
].join("\n");

if (!next.includes("    }\n    Views: {")) {
  throw new Error("Could not find Tables → Views boundary in types.ts");
}

if (missingTables.length > 0) {
  next = next.replace(
    "    }\n    Views: {",
    `      ,\n${tableBlock}\n    }\n    Views: {`,
  );
}
if (missingFns.length > 0) {
  next = next.replace(
    "    }\n    Enums: {",
    `      ,\n${fnBlock}\n    }\n    Enums: {`,
  );
}

writeFileSync(typesPath, next);
console.log(`Patched ${typesPath}`);
console.log(`- Added tables: ${missingTables.length} (${missingTables.join(", ") || "none"})`);
console.log(`- Added functions: ${missingFns.length} (${missingFns.join(", ") || "none"})`);
