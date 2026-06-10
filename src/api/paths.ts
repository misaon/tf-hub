// The Hub gateway prefixes: v2 routes are company-agnostic, v3 routes are scoped to the "tf" company.
export const v2 = (path: string): string => `/tf/hub/v2/${path}`;
export const v3 = (path: string): string => `/tf/hub/v3/tf/${path}`;
