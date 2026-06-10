export const sortDirections = ["ASC", "DESC"] as const;

// A type alias (not an interface) keeps option objects assignable to the client's query record.
// oxlint-disable-next-line typescript/consistent-type-definitions
export type Paging = {
  limit: number;
  offset: number;
};
