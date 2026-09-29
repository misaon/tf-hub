import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

export interface TruncatedPage {
  path: string;
  returned: number;
  offset: number;
  totalItems: number;
}

const pagedEnvelopeSchema = z.object({
  data: z.array(z.unknown()),
  metadata: z.object({ totalItems: z.number(), offset: z.number().default(0) }),
});

const truncatedPagesOfCurrentOperation = new AsyncLocalStorage<TruncatedPage[]>();

export function recordTruncatedPage(path: string, response: unknown): void {
  const truncatedPages = truncatedPagesOfCurrentOperation.getStore();
  const envelope = pagedEnvelopeSchema.safeParse(response);

  if (!truncatedPages || !envelope.success) {
    return;
  }

  const { data, metadata } = envelope.data;

  if (metadata.offset + data.length >= metadata.totalItems) {
    return;
  }

  truncatedPages.push({ path, returned: data.length, offset: metadata.offset, totalItems: metadata.totalItems });
}

export async function collectTruncatedPages<TOutput>(
  run: () => Promise<TOutput>,
): Promise<{ data: TOutput; truncatedPages: TruncatedPage[] }> {
  const truncatedPages: TruncatedPage[] = [];
  const data = await truncatedPagesOfCurrentOperation.run(truncatedPages, run);

  return { data, truncatedPages };
}

export function describeTruncatedPage(page: TruncatedPage, acceptsOffset: boolean): string {
  const summary = `Returned ${page.returned} of ${page.totalItems} matching records (offset ${page.offset}).`;
  const nextStep = acceptsOffset
    ? ` Narrow the filters or request the next page with offset=${page.offset + page.returned}.`
    : " Narrow the filters to see the rest.";

  return `${summary}${nextStep}`;
}
