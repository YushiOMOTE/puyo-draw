import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve(process.argv[2] || ".");
const version = process.argv[3] || process.env.GITHUB_SHA;

if (!version || !/^[A-Za-z0-9._-]+$/.test(version)) {
  throw new Error("A safe deployment version is required");
}

const localAsset = /(["'])([A-Za-z0-9_./-]+\.(?:js|css))(?:\?v=[^"']*)?\1/g;

async function versionDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await versionDirectory(path);
      continue;
    }

    if (![".html", ".js"].includes(extname(entry.name))) continue;

    const source = await readFile(path, "utf8");
    const versioned = source.replace(
      localAsset,
      (_, quote, asset) => `${quote}${asset}?v=${version}${quote}`,
    );
    if (versioned !== source) await writeFile(path, versioned);
  }
}

await versionDirectory(root);
