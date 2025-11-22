#!/usr/bin/env bun
/**
 * Production build script using Bun.build with Effect for error handling.
 *
 * Processes HTML entrypoints, bundles assets with Tailwind CSS,
 * and outputs minified production builds with sourcemaps.
 */

import plugin from "bun-plugin-tailwind";
import path from "path";
import { Effect, Console } from "effect";
import { FileSystem } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { CleanError, BuildError } from "./src/lib/errors";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🏗️  Bun Build Script

Usage: bun run build.ts [options]

Common Options:
  --outdir <path>          Output directory (default: "dist")
  --minify                 Enable minification (or --minify.whitespace, --minify.syntax, etc)
  --sourcemap <type>      Sourcemap type: none|linked|inline|external
  --target <target>        Build target: browser|bun|node
  --format <format>        Output format: esm|cjs|iife
  --splitting              Enable code splitting
  --packages <type>        Package handling: bundle|external
  --public-path <path>     Public path for assets
  --env <mode>             Environment handling: inline|disable|prefix*
  --conditions <list>      Package.json export conditions (comma separated)
  --external <list>        External packages (comma separated)
  --banner <text>          Add banner text to output
  --footer <text>          Add footer text to output
  --define <obj>           Define global constants (e.g. --define.VERSION=1.0.0)
  --help, -h               Show this help message

Example:
  bun run build.ts --outdir=dist --minify --sourcemap=linked --external=react,react-dom
`);
  process.exit(0);
}

// CLI argument parsing utilities

/** Converts kebab-case to camelCase for CLI flags */
const toCamelCase = (str: string): string => str.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());

/** Parses string values into appropriate JS types (bool, number, array) */
const parseValue = (value: string): string | number | boolean | string[] => {
  if (value === "true") return true;
  if (value === "false") return false;

  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

  // Comma-separated values become arrays
  if (value.includes(",")) return value.split(",").map((v) => v.trim());

  return value;
};

/**
 * Parses CLI arguments into a config object for Bun.build.
 * Supports: --flag, --no-flag, --key=value, --key value, --parent.child=value
 */
function parseArgs(): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (!arg.startsWith("--")) continue;

    // Handle --no-flag syntax for boolean false
    if (arg.startsWith("--no-")) {
      const key = toCamelCase(arg.slice(5));
      config[key] = false;
      continue;
    }

    // Handle standalone flags (--flag without value)
    if (!arg.includes("=") && (i === args.length - 1 || args[i + 1]?.startsWith("--"))) {
      const key = toCamelCase(arg.slice(2));
      config[key] = true;
      continue;
    }

    let key: string;
    let value: string;

    // Handle --key=value or --key value syntax
    if (arg.includes("=")) {
      [key, value] = arg.slice(2).split("=", 2) as [string, string];
    } else {
      key = arg.slice(2);
      value = args[++i] ?? "";
    }

    key = toCamelCase(key);

    // Handle nested keys (--minify.whitespace=true)
    if (key.includes(".")) {
      const [parentKey, childKey] = key.split(".");
      if (parentKey && childKey) {
        const existing = config[parentKey];
        config[parentKey] = typeof existing === "object" && existing !== null ? existing : {};
        (config[parentKey] as Record<string, unknown>)[childKey] = parseValue(value);
      }
    } else {
      config[key] = parseValue(value);
    }
  }

  return config;
}

/** Formats bytes into human-readable size (B, KB, MB, GB) */
const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * Main build program using Effect for structured error handling.
 * Cleans output directory, finds entrypoints, runs Bun.build, and reports results.
 */
const buildProgram = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;

  yield* Console.log("\n🚀 Starting build process...\n");

  const cliConfig = parseArgs();
  const outdir = typeof cliConfig.outdir === "string" ? cliConfig.outdir : path.join(process.cwd(), "dist");

  // Clean previous build
  const exists = yield* fs.exists(outdir);
  if (exists) {
    yield* Console.log(`🗑️ Cleaning previous build at ${outdir}`);
    yield* fs.remove(outdir, { recursive: true }).pipe(
      Effect.mapError((error) => new CleanError({
        message: `Failed to clean directory: ${outdir}`,
        cause: { directory: outdir, originalError: error }
      }))
    );
  }

  const start = performance.now();

  // Find entrypoints
  const entrypoints = [...new Bun.Glob("**.html").scanSync("src")]
    .map((a: string) => path.resolve("src", a))
    .filter((dir: string) => !dir.includes("node_modules"));

  yield* Console.log(`📄 Found ${entrypoints.length} HTML ${entrypoints.length === 1 ? "file" : "files"} to process\n`);

  // Run build
  const result = yield* Effect.tryPromise({
    try: () => Bun.build({
      entrypoints,
      outdir,
      plugins: [plugin],
      minify: true,
      target: "browser",
      sourcemap: "linked",
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
      },
      ...cliConfig,
    }),
    catch: (error) => new BuildError({
      message: `Build failed`,
      cause: {
        originalError: error,
        entrypoints,
        outdir,
        config: cliConfig
      }
    })
  });

  const end = performance.now();

  // Display results
  const outputTable = result.outputs.map((output) => ({
    File: path.relative(process.cwd(), output.path),
    Type: output.kind,
    Size: formatFileSize(output.size),
  }));

  // Use Effect Console for consistency
  yield* Console.log("\nBuild Output:");
  yield* Effect.sync(() => console.table(outputTable));
  const buildTime = (end - start).toFixed(2);

  yield* Console.log(`\n✅ Build completed in ${buildTime}ms\n`);

  return result;
});

// Run build with BunRuntime for proper signal handling
// Provides BunContext layer for FileSystem access
BunRuntime.runMain(
  buildProgram.pipe(
    Effect.provide(BunContext.layer),
    // Type-safe error handling by error tag
    Effect.catchTag("CleanError", (error) =>
      Console.error(`\n❌ Clean failed: ${error.message}\n`).pipe(
        Effect.andThen(Effect.fail(error))
      )
    ),
    Effect.catchTag("BuildError", (error) =>
      Console.error(`\n❌ Build failed: ${error.message}\n`).pipe(
        Effect.andThen(Effect.fail(error))
      )
    )
  )
);
