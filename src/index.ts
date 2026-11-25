#!/usr/bin/env node
import module from "node:module";

// Caches V8 bytecode across runs (Node >= 22.1), which removes most of the bundle's parse time on every start.
module.enableCompileCache?.();

await import("./program.ts");
