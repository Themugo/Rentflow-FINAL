/** Minimal, privacy-safe operational telemetry for Edge Functions. */
export interface RequestTelemetry { requestId: string; functionName: string; startedAt: number; }

export function getRequestId(req: Request): string {
  const supplied = req.headers.get('x-request-id')?.trim();
  if (supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied)) return supplied;
  return crypto.randomUUID();
}

export function startTelemetry(req: Request, functionName: string): RequestTelemetry {
  const telemetry = { requestId: getRequestId(req), functionName, startedAt: Date.now() };
  console.log(JSON.stringify({ level: 'info', event: 'request.start', request_id: telemetry.requestId, function: functionName }));
  return telemetry;
}

export function finishTelemetry(t: RequestTelemetry, status: number): void {
  console.log(JSON.stringify({ level: status >= 500 ? 'error' : 'info', event: 'request.finish', request_id: t.requestId, function: t.functionName, status, duration_ms: Date.now() - t.startedAt }));
}

export function failTelemetry(t: RequestTelemetry, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: 'error', event: 'request.error', request_id: t.requestId, function: t.functionName, error: message.slice(0, 500), duration_ms: Date.now() - t.startedAt }));
}

export function withRequestId(headers: HeadersInit | undefined, requestId: string): Headers {
  const result = new Headers(headers);
  result.set('X-Request-Id', requestId);
  return result;
}
