/**
 * API testing component with Effect-based fetching and Schema validation.
 *
 * Demonstrates type-safe API calls with runtime validation of responses
 * and exhaustive error handling via Effect.catchTag.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Effect, Schema } from "effect";
import { useRef, type FormEvent } from "react";
import { NetworkError, HttpError, ParseError } from "./lib/errors";

// Response schemas for runtime validation of API responses

/** Success response from /api/hello endpoints */
const HelloResponse = Schema.Struct({
  message: Schema.String,
  method: Schema.optional(Schema.String)
});

/** Error response format from API */
const ErrorResponse = Schema.Struct({
  error: Schema.String
});

/** Union of all possible API response shapes */
const ApiResponse = Schema.Union(HelloResponse, ErrorResponse);

type ApiResponseType = Schema.Schema.Type<typeof ApiResponse>;

/**
 * Effect-based API fetcher with typed error channel.
 * Handles network failures, HTTP errors, and response validation.
 */
const fetchApi = (
  endpoint: string,
  method: string
): Effect.Effect<ApiResponseType, NetworkError | HttpError | ParseError, never> =>
  Effect.gen(function* () {
    const url = new URL(endpoint, location.href);

    // Fetch with network error handling
    const response = yield* Effect.tryPromise({
      try: () => fetch(url, { method }),
      catch: (error) => new NetworkError({
        message: `Failed to fetch ${method} ${endpoint}`,
        cause: { originalError: error, endpoint, method }
      })
    });

    // Check HTTP status
    if (!response.ok) {
      return yield* new HttpError({
        status: response.status,
        statusText: response.statusText,
        cause: { endpoint, method, url: url.toString() }
      });
    }

    // Parse JSON response
    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (error) => new ParseError({
        message: `Failed to parse JSON response from ${endpoint}`,
        cause: { originalError: error, endpoint, method }
      })
    });

    // Validate response against schema
    const data = yield* Schema.decodeUnknown(ApiResponse)(json).pipe(
      Effect.mapError((error) => new ParseError({
        message: `Response validation failed for ${endpoint}`,
        cause: { schemaError: String(error), endpoint, method, receivedData: json }
      }))
    );

    return data;
  });

/** Schema for validating form inputs before API call */
const FormDataSchema = Schema.Struct({
  endpoint: Schema.NonEmptyString,
  method: Schema.Literal("GET", "PUT")
});

/** Interactive form for testing API endpoints with method selection */
export function APITester() {
  const responseInputRef = useRef<HTMLTextAreaElement>(null);

  const testEndpoint = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Validate form inputs before making request
    const formResult = Schema.decodeUnknownEither(FormDataSchema)({
      endpoint: formData.get("endpoint"),
      method: formData.get("method")
    });

    if (formResult._tag === "Left") {
      if (responseInputRef.current) {
        responseInputRef.current.value = `Validation Error: Invalid form data`;
      }
      return;
    }

    const { endpoint, method } = formResult.right;

    // Execute API call with exhaustive error handling
    const result = await Effect.runPromise(
      fetchApi(endpoint, method).pipe(
        Effect.map((data) => JSON.stringify(data, null, 2)),
        // Handle each error type with catchTag for type safety
        Effect.catchTag("NetworkError", (error) => Effect.succeed(`Network Error: ${error.message}`)),
        Effect.catchTag("HttpError", (error) => Effect.succeed(`HTTP ${error.status}: ${error.statusText}`)),
        Effect.catchTag("ParseError", (error) => Effect.succeed(`Parse Error: ${error.message}`))
      )
    );

    if (responseInputRef.current) {
      responseInputRef.current.value = result;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={testEndpoint} className="flex items-center gap-2">
        <Label htmlFor="method" className="sr-only">
          Method
        </Label>
        <Select name="method" defaultValue="GET">
          <SelectTrigger className="w-[100px]" id="method">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="endpoint" className="sr-only">
          Endpoint
        </Label>
        <Input id="endpoint" type="text" name="endpoint" defaultValue="/api/hello" placeholder="/api/hello" />
        <Button type="submit" variant="secondary">
          Send
        </Button>
      </form>
      <Label htmlFor="response" className="sr-only">
        Response
      </Label>
      <Textarea
        ref={responseInputRef}
        id="response"
        readOnly
        placeholder="Response will appear here..."
        className="min-h-[140px] font-mono resize-y"
      />
    </div>
  );
}
