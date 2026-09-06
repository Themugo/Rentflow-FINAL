import { stringifyMasked } from "@/features/webhost/lib/secrets";

/**
 * Structured platform logs written by the observability logger
 * (`createLogger(component)`) into `activity_logs` with
 * `entity_type = 'log'`. Each action is `{level}:{component}:{action}`;
 * the LogEntry itself rides in `metadata`. Only these rows are rendered —
 * nothing is fabricated.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export type ParsedLogRow = {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  maskedMetadata: string;
};

const LEVEL_ALIAS: Record<string, LogLevel | null> = {
  debug: "debug",
  info: "info",
  warn: "warn",
  warning: "warn",
  error: "error",
  critical: "critical",
};

export type LogRowInput = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_label: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function tryParseAction(action: string): { level: LogLevel; source: string; message: string } | null {
  // Observability writer: `${level}:${component}:${action}`
  const first = action.indexOf(":");
  const second = first === -1 ? -1 : action.indexOf(":", first + 1);
  if (first <= 0 || second <= first) return null;
  const level = LEVEL_ALIAS[action.slice(0, first).toLowerCase()] ?? null;
  if (!level) return null;
  return {
    level,
    source: action.slice(first + 1, second),
    message: action.slice(second + 1),
  };
}

function metadataString(input: LogRowInput): string {
  // Level/source/message are carried in the action; metadata holds the same
  // LogEntry plus any error. Mask before displaying.
  return stringifyMasked(input.metadata);
}

/** Parse one `entity_type = 'log'` row. Returns null for rows that are not structured logs. */
export function parseLogRow(input: LogRowInput): ParsedLogRow | null {
  const parsed = tryParseAction(input.action);
  if (!parsed) return null;
  const meta = input.metadata ?? {};
  const source = typeof meta.component === "string" && meta.component ? meta.component : parsed.source;
  const message = input.entity_label ?? parsed.message;
  return {
    id: input.id,
    timestamp: input.created_at,
    level: parsed.level,
    source,
    message,
    maskedMetadata: metadataString(input),
  };
}

export function parseLogRows(rows: LogRowInput[]): ParsedLogRow[] {
  return rows.map(parseLogRow).filter((row): row is ParsedLogRow => row !== null);
}

export function levelClass(level: LogLevel): string {
  switch (level) {
    case "critical":
    case "error":
      return "bg-destructive/15 text-destructive";
    case "warn":
      return "bg-warning/15 text-warning-foreground";
    case "info":
      return "bg-primary/10 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}
