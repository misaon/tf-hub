import { z } from "zod";

export function describeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return z.prettifyError(error);
  }

  return error instanceof Error ? error.message : String(error);
}
