import type { z } from "zod";

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
