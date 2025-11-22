# Bun + React + Effect Example

Full-stack application demonstrating **END-TO-END TYPE SAFETY** with Effect TypeScript, React, and Bun.

> [!IMPORTANT]
> This example showcases zero runtime type errors through Effect's typed error channels, Schema validation, and exhaustive pattern matching.

## Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Bun |
| **Frontend** | React 19, Tailwind CSS v4, shadcn/ui |
| **Backend** | Bun.serve with Effect-based handlers |
| **Validation** | Effect Schema with runtime type checking |
| **Build** | Bun.build with Effect error handling |

## Commands

```bash
bun install    # Install dependencies
bun dev        # Development server with HMR
bun start      # Production server
bun build      # Build for production (supports CLI args)
```

## Structure

```
src/
├── index.ts        # Server entry with typed Effect handlers
├── App.tsx         # React root component
├── APITester.tsx   # API test UI with Schema validation
├── frontend.tsx    # React entry with HMR support
├── lib/
│   ├── errors.ts   # Tagged errors (ValidationError, HttpError, etc.)
│   └── utils.ts    # Utility functions (cn)
└── components/ui/  # shadcn/ui components
build.ts            # Production build with Effect + CLI args
```

## Architecture

```mermaid
graph LR
    A[React Frontend] -->|HTTP Request| B[Bun.serve]
    B -->|Route Handler| C[Effect Handler]
    C -->|Schema Validation| D{Valid?}
    D -->|Yes| E[Effect.succeed]
    D -->|No| F[ValidationError]
    E -->|JSON Response| A
    F -->|catchTag| G[Error Response]
    G -->|JSON Response| A

    style A fill:#61dafb
    style B fill:#fbf0df
    style C fill:#3178c6
    style E fill:#4ade80
    style F fill:#f87171
    style G fill:#fbbf24
```

## Type Safety

> [!NOTE]
> Every value is explicitly typed with zero `any` types or type assertions in the entire codebase.

### Zero Runtime Type Errors

- **No `any` types** - every value explicitly typed
- **No type assertions** - Effect Schema validates at runtime
- **Tagged errors** - `Data.TaggedError` for exhaustive pattern matching
- **Typed error channels** - `Effect.Effect<Success, Error>` with explicit error types

<details>
<summary>Example: Type-safe error handling</summary>

```typescript
const getHelloByName = (name: string): Effect.Effect<HelloByNameResponse, ValidationError> =>
  Effect.gen(function* () {
    if (!name.trim()) {
      return yield* new ValidationError({
        message: "Name parameter is required",
        cause: { endpoint: "/api/hello/:name", value: name }
      });
    }
    return { message: `Hello, ${name}!` };
  });
```

The error type is enforced at compile time. Handlers must use `Effect.catchTag("ValidationError", ...)` to recover.

</details>

### Frontend Validation

- API responses validated with `Schema.Struct` and `Schema.Union`
- `Effect.catchTag` enables type-safe error recovery by error tag
- Form inputs validated before API calls with `Schema.decodeUnknownEither`

### Build System

> [!TIP]
> Run `bun build --help` to see all available CLI options for the Effect-based build script.

- Effect-based build script with tagged error types (`CleanError`, `BuildError`)
- CLI argument parsing with automatic type coercion
- Resource cleanup with `Effect.acquireRelease`
