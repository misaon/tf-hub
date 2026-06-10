import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./openapi.json",
  output: "./src/api/generated",
  plugins: [
    {
      name: "zod",
      definitions: true,
      requests: false,
      responses: false,
    },
  ],
});
