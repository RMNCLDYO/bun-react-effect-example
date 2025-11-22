/**
 * Server entry point with Effect-based API route handlers.
 *
 * Uses Bun.serve for HTTP routing and Effect for type-safe error handling
 * with resource management via acquireRelease pattern.
 */

import { serve } from "bun";
import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect } from "effect";
import index from "./index.html";
import { ValidationError } from "./lib/errors";

// Response types for type-safe API handlers
// These ensure consistent response shapes across all endpoints
interface HelloResponse {
  message: string;
  method: string;
}

interface HelloByNameResponse {
  message: string;
}

// API handler implementations
// Each returns an Effect with explicit success/error types

/** Returns a greeting with the HTTP method used */
const getHello = (method: string): Effect.Effect<HelloResponse> =>
  Effect.succeed({
    message: "Hello, world!",
    method,
  });

/**
 * Returns a personalized greeting or ValidationError if name is empty.
 * Demonstrates Effect's typed error channel for validation failures.
 */
const getHelloByName = (
  name: string
): Effect.Effect<HelloByNameResponse, ValidationError> =>
  Effect.gen(function* () {
    if (!name || name.trim() === "") {
      return yield* new ValidationError({
        message: "Name parameter is required",
        cause: { endpoint: "/api/hello/:name", value: name }
      });
    }
    return { message: `Hello, ${name}!` };
  });

// Route handlers that convert Effect results to HTTP Response objects

const handleHelloGet = Effect.gen(function* () {
  const result = yield* getHello("GET");
  return Response.json(result);
});

const handleHelloPut = Effect.gen(function* () {
  const result = yield* getHello("PUT");
  return Response.json(result);
});

/**
 * Handles /api/hello/:name with error recovery.
 * Uses catchTag for type-safe error handling by error tag.
 */
const handleHelloByName = (name: string) =>
  getHelloByName(name).pipe(
    Effect.map((data) => Response.json(data, { status: 200 })),
    Effect.catchTag("ValidationError", (error) =>
      Effect.succeed(Response.json({ error: error.message }, { status: 400 }))
    )
  );

/**
 * Server creation using Effect's acquireRelease pattern.
 * Ensures proper resource lifecycle management for the HTTP server.
 */
const createServer = Effect.acquireRelease(
  Effect.sync(() =>
    serve({
      routes: {
        // Fallback: serve index.html for all unmatched routes (SPA support)
        "/*": index,

        // API routes with method-specific handlers
        "/api/hello": {
          GET: () => Effect.runPromise(handleHelloGet),
          PUT: () => Effect.runPromise(handleHelloPut),
        },

        // Dynamic route with path parameter
        "/api/hello/:name": (req) =>
          Effect.runPromise(handleHelloByName(req.params.name)),
      },

      development: process.env.NODE_ENV !== "production" && {
        hmr: true,     // Browser hot reloading
        console: true, // Echo browser console to server
      },
    })
  ),
  (server) =>
    Effect.sync(() => {
      // Cleanup would go here if Bun supported server.close()
      // For now, this is handled by BunRuntime.runMain
    })
);

/**
 * Main program entry point.
 * Uses Effect.scoped to manage server lifecycle within resource scope.
 */
const main = Effect.scoped(
  Effect.gen(function* () {
    const server = yield* createServer;
    yield* Console.log(`Server running at ${server.url}`);

    // Keep server running indefinitely until interrupted
    yield* Effect.never;
  })
);

// Run with BunRuntime for proper signal handling (SIGINT/SIGTERM)
BunRuntime.runMain(main);
