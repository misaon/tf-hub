import { z } from "zod";

import { zSortDir } from "../api/generated/zod.gen.ts";
import { plainText } from "../cli/output.ts";

export const sortDirections = zSortDir.options;

// Rich text becomes plain text at the boundary: agents pay for every token and tables cannot show HTML.
export const richTextSchema = z
  .string()
  .nullish()
  .transform((value) => (value === null || value === undefined ? value : plainText(value)));

// A type alias (not an interface) keeps option objects assignable to the client's query record.
// oxlint-disable-next-line typescript/consistent-type-definitions
export type Paging = {
  limit: number;
  offset: number;
};

export function omitKey<Item extends object, Key extends keyof Item>(item: Item, key: Key): Omit<Item, Key> {
  const { [key]: _omitted, ...rest } = item;

  return rest;
}

// Hub list filters treat a boolean query flag as set whenever it is present, so a false flag stays out.
// Sending `withDeleted=false` returns the deleted records too.
export function flagParameter(enabled: boolean | undefined): true | undefined {
  return enabled === true ? true : undefined;
}
