/**
 * Tagged error definitions for type-safe error handling with Effect.
 *
 * All errors extend Data.TaggedError for discriminated union matching
 * via Effect.catchTag. Each error includes optional cause for rich context.
 */

import { Data } from "effect";

// Server errors - validation and request processing failures

/** Input validation failure (missing/invalid parameters) */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
  cause?: unknown;
}> {}

// Build errors - build script failures

/** Failed to clean output directory before build */
export class CleanError extends Data.TaggedError("CleanError")<{
  message: string;
  cause?: unknown;
}> {}

/** Bun.build compilation failure */
export class BuildError extends Data.TaggedError("BuildError")<{
  message: string;
  cause?: unknown;
}> {}

// API/Network errors - external service communication failures

/** Network connectivity or DNS resolution failure */
export class NetworkError extends Data.TaggedError("NetworkError")<{
  message: string;
  cause?: unknown;
}> {}

/** HTTP response with non-2xx status code */
export class HttpError extends Data.TaggedError("HttpError")<{
  status: number;
  statusText: string;
  body?: unknown;
  cause?: unknown;
}> {}

/** JSON or schema parsing failure */
export class ParseError extends Data.TaggedError("ParseError")<{
  message: string;
  cause?: unknown;
}> {}

/** Union type for exhaustive pattern matching across all app errors */
export type AppError =
  | ValidationError
  | CleanError
  | BuildError
  | NetworkError
  | HttpError
  | ParseError;
