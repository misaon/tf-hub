#!/usr/bin/env bun
// Builds the standalone binaries a release attaches to GitHub, plus their SHA256SUMS file.
import { consola } from "consola";

import rootPackage from "../package.json" with { type: "json" };

interface PlatformTarget {
  compileTarget: string;
  assetName: string;
}

const targets: PlatformTarget[] = [
  {
    compileTarget: "bun-linux-x64",
    assetName: "tf-hub-linux-x64",
  },
  {
    compileTarget: "bun-linux-arm64",
    assetName: "tf-hub-linux-arm64",
  },
  {
    compileTarget: "bun-darwin-x64",
    assetName: "tf-hub-darwin-x64",
  },
  {
    compileTarget: "bun-darwin-arm64",
    assetName: "tf-hub-darwin-arm64",
  },
  {
    compileTarget: "bun-windows-x64",
    assetName: "tf-hub-windows-x64.exe",
  },
];

async function compile(target: PlatformTarget): Promise<string> {
  const outfile = `artifacts/release/${target.assetName}`;
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
      const bytes = await Bun.file(`artifacts/release/${assetName}`).arrayBuffer();
      const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

      return `${digest}  ${assetName}`;
    }),
  );

  await Bun.write("artifacts/release/SHA256SUMS", `${lines.join("\n")}\n`);
}

await Promise.all(
  targets.map(async (target) => {
    const binaryPath = await compile(target);
    consola.success(`${target.compileTarget} → ${binaryPath}`);
  }),
);

await writeChecksums(targets.map((target) => target.assetName));
consola.success(`Release artifacts ready for v${rootPackage.version}.`);
