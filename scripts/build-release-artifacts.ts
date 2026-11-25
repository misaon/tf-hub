#!/usr/bin/env bun
// Builds the standalone binaries a release attaches to GitHub, plus their SHA256SUMS file.
import { consola } from "consola";

import rootPackage from "../package.json" with { type: "json" };
import { binaryAssetName } from "../src/cli/update-notifier.ts";

const releaseDirectory = "artifacts/release";

interface PlatformTarget {
  compileTarget: string;
  assetName: string;
}

const platforms: readonly [platform: NodeJS.Platform, architecture: NodeJS.Architecture][] = [
  ["linux", "x64"],
  ["linux", "arm64"],
  ["darwin", "x64"],
  ["darwin", "arm64"],
  ["win32", "x64"],
];

const targets: PlatformTarget[] = platforms.map(([platform, architecture]) => ({
  compileTarget: `bun-${platform === "win32" ? "windows" : platform}-${architecture}`,
  assetName: binaryAssetName(platform, architecture),
}));

async function compile(target: PlatformTarget): Promise<string> {
  const outfile = `${releaseDirectory}/${target.assetName}`;
  const build = Bun.spawn(
    [
      "bun",
      "build",
      "src/index.ts",
      "--compile",
      "--minify",
      `--target=${target.compileTarget}`,
      `--outfile=${outfile}`,
    ],
    { stdout: "ignore", stderr: "inherit" },
  );

  if ((await build.exited) !== 0) {
    throw new Error(`Compilation for ${target.compileTarget} failed.`);
  }

  return outfile;
}

async function writeChecksums(assetNames: string[]): Promise<void> {
  const lines = await Promise.all(
    assetNames.map(async (assetName) => {
      const bytes = await Bun.file(`${releaseDirectory}/${assetName}`).arrayBuffer();
      const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

      return `${digest}  ${assetName}`;
    }),
  );

  await Bun.write(`${releaseDirectory}/SHA256SUMS`, `${lines.join("\n")}\n`);
}

await Promise.all(
  targets.map(async (target) => {
    const binaryPath = await compile(target);
    consola.success(`${target.compileTarget} → ${binaryPath}`);
  }),
);

await writeChecksums(targets.map((target) => target.assetName));
consola.success(`Release artifacts ready for v${rootPackage.version}.`);
