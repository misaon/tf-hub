import { z } from "zod";

import { ApiRequestError } from "../api/client.ts";
import { collectTruncatedPages, describeTruncatedPage } from "../api/paging.ts";

export interface OperationAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export interface Operation<Shape extends z.ZodRawShape = z.ZodRawShape, TOutput = unknown> {
  name: string;
  description: string;
  input: z.ZodObject<Shape>;
  annotations?: OperationAnnotations | undefined;
  run(input: z.output<z.ZodObject<Shape>>): Promise<TOutput>;
}

export function defineOperation<Shape extends z.ZodRawShape, TOutput>(
  operation: Operation<Shape, TOutput>,
): Operation<Shape, TOutput> {
  return operation;
}

export interface OperationResult<TOutput> {
  data: TOutput;
  notices: string[];
}

function withOwnRecordsHint(error: unknown, shape: z.ZodRawShape, input: object): unknown {
  const readsOtherPeople = "mine" in shape && !("mine" in input && input.mine === true);

  if (!(error instanceof ApiRequestError) || error.status !== 403 || !readsOtherPeople) {
    return error;
  }

  return new ApiRequestError(`${error.message} If you meant your own records, retry with mine=true.`, 403, {
    cause: error,
  });
}

// A response that fails its schema is a server change, not a caller mistake; say so instead of dumping issues.
function withReadableResponseErrors(error: unknown): unknown {
  if (!(error instanceof z.ZodError)) {
    return error;
  }

  return new Error(
    `TF Hub returned data in an unexpected shape, so retrying will not help:\n${z.prettifyError(error)}`,
    { cause: error },
  );
}

export async function runOperation<Shape extends z.ZodRawShape, TOutput>(
  operation: Operation<Shape, TOutput>,
  input: z.output<z.ZodObject<Shape>>,
): Promise<OperationResult<TOutput>> {
  try {
    const { data, truncatedPages } = await collectTruncatedPages(() => operation.run(input));
    const acceptsOffset = "offset" in operation.input.shape;

    return { data, notices: truncatedPages.map((page) => describeTruncatedPage(page, acceptsOffset)) };
  } catch (error) {
    throw withReadableResponseErrors(withOwnRecordsHint(error, operation.input.shape, input));
  }
}
