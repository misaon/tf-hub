import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

// Per the XDG spec, an empty or relative override is invalid and falls back to the default location.
function baseDirectory(variable: "XDG_CONFIG_HOME" | "XDG_CACHE_HOME", fallback: string): string {
  const configured = process.env[variable];

  return configured && isAbsolute(configured) ? configured : join(homedir(), fallback);
}

export function configDirectory(): string {
  return join(baseDirectory("XDG_CONFIG_HOME", ".config"), "tf-hub");
}

export function cacheDirectory(): string {
  return join(baseDirectory("XDG_CACHE_HOME", ".cache"), "tf-hub");
}
