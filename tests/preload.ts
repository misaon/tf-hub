import { afterEach, mock } from "bun:test";

import { useInMemoryKeychain } from "./support.ts";

useInMemoryKeychain();

afterEach(() => {
  mock.restore();
  process.exitCode = 0;
});
