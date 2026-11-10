import { readFileSync } from "fs";
import { join, resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const lock = Bun.TOML.parse(
  readFileSync(join(root, "src-tauri/Cargo.lock"), "utf-8"),
) as { package: { name: string; version: string }[] };
const dependencies = {
  ...manifest.dependencies,
  ...manifest.devDependencies,
};
const pairs: [string, string][] = [["@tauri-apps/api", "tauri"]];
for (const name of Object.keys(dependencies)) {
  if (name.startsWith("@tauri-apps/plugin-")) {
    pairs.push([name, name.replace("@tauri-apps/", "tauri-")]);
  }
}
if (dependencies["tauri-plugin-macos-permissions-api"]) {
  pairs.push([
    "tauri-plugin-macos-permissions-api",
    "tauri-plugin-macos-permissions",
  ]);
}

let checked = 0;
const failures: string[] = [];
for (const [npmName, crateName] of pairs) {
  const native = lock.package.filter((entry) => entry.name === crateName);
  // An unused JS bridge can exist without a corresponding native plugin.
  if (native.length === 0 && crateName !== "tauri") continue;
  if (native.length !== 1) {
    failures.push(`${crateName}: expected one resolved native version`);
    continue;
  }
  const installed = JSON.parse(
    readFileSync(join(root, "node_modules", npmName, "package.json"), "utf-8"),
  ) as { version: string };
  const minor = (version: string) => version.split(".").slice(0, 2).join(".");
  if (minor(native[0].version) !== minor(installed.version)) {
    failures.push(
      `${crateName} ${native[0].version} does not match ${npmName} ${installed.version}`,
    );
  }
  checked += 1;
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Matched ${checked} installed JS/native Tauri package versions.`);
