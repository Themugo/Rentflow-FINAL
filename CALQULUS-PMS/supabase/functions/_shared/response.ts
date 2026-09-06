/**
 * _shared/response.ts
 *
 * Standardized response formatting for CALQULUS PMS edge functions.
 *
 * Provides consistent response structures across all functions,
 * eliminating code duplication and ensuring proper HTTP semantics.
 *
 * Usage:
 *   import { jsonResponse, textResponse, htmlResponse } from "../_shared/response.ts";
 *
 *   return jsonResponse({ data: "value" }, 200);
 *   return textResponse("Plain text response", 200);
 *   return htmlResponse("<html>...</html>", 200);
 */

import { getCorsHeaders } from "./cors.ts";

/**
 * Standard response options.
 */
export interface ResponseOptions {
  status?: number;
  headers?: Record<string, string>;
}

/**
 * Create a JSON response with CORS headers.
 */
export function jsonResponse(
  data: any,
  options: ResponseOptions = {}
): Response {
  const { status = 200, headers = {} } = options;

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(new Request("https://dummy.com")),
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

/**
 * Create a text response with CORS headers.
 */
export function textResponse(
  text: string,
  options: ResponseOptions = {}
): Response {
  const { status = 200, headers = {} } = options;

  return new Response(text, {
    status,
    headers: {
      ...getCorsHeaders(new Request("https://dummy.com")),
      "Content-Type": "text/plain; charset=utf-8",
      ...headers,
    },
  });
}

/**
 * Create an HTML response with CORS headers.
 */
export function htmlResponse(
  html: string,
  options: ResponseOptions = {}
): Response {
  const { status = 200, headers = {} } = options;

  return new Response(html, {
    status,
    headers: {
      ...getCorsHeaders(new Request("https://dummy.com")),
      "Content-Type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

/**
 * Create an empty response with CORS headers.
 */
export function emptyResponse(status: number = 204): Response {
  return new Response(null, {
    status,
    headers: getCorsHeaders(new Request("https://dummy.com")),
  });
}

/**
 * Create a redirect response.
 */
export function redirectResponse(url: string, status: number = 302): Response {
  return new Response(null, {
    status,
    headers: {
      ...getCorsHeaders(new Request("https://dummy.com")),
      "Location": url,
    },
  });
}

/**
 * Create a file download response.
 */
export function fileResponse(
  content: Blob | Uint8Array | string,
  filename: string,
  contentType: string,
  options: ResponseOptions = {}
): Response {
  const { status = 200, headers = {} } = options;

  return new Response(content, {
    status,
    headers: {
      ...getCorsHeaders(new Request("https://dummy.com")),
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...headers,
    },
  });
}

/**
 * Create a streaming response.
 */
export function streamResponse(
  stream: ReadableStream,
  contentType: string,
  options: ResponseOptions = {}
): Response {
  const { status = 200, headers = {} } = options;

  return new Response(stream, {
    status,
    headers: {
      ...getCorsHeaders(new Request("https://dummy.com")),
      "Content-Type": contentType,
      ...headers,
    },
  });
}
