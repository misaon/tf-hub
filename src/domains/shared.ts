export const sortDirections = ["ASC", "DESC"] as const;

// A type alias (not an interface) keeps option objects assignable to the client's query record.
// oxlint-disable-next-line typescript/consistent-type-definitions
export type Paging = {
  limit: number;
  offset: number;
};

// Hub list filters treat a boolean query flag as set whenever it is present, so a false flag stays out.
// Sending `withDeleted=false` returns the deleted records too.
export function flagParameter(enabled: boolean | undefined): true | undefined {
  return enabled === true ? true : undefined;
}
