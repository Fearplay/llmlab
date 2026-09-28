import { existsSync, readFileSync, realpathSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const web = join(repo, "apps", "web");
const rootPackage = JSON.parse(readFileSync(join(web, "package.json"), "utf8"));
const outputIndex = process.argv.indexOf("--output");
const output = outputIndex === -1 ? null : process.argv[outputIndex + 1];
if (outputIndex !== -1 && !output) throw new Error("--output needs a filename");
const includeDev = process.argv.includes("--include-dev");

function packageDirectory(name, from) {
  for (let current = from; current !== dirname(current); current = dirname(current)) {
    const candidate = join(current, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
  }
  const direct = join(web, "node_modules", name);
  return existsSync(join(direct, "package.json")) ? realpathSync(direct) : null;
}

const packages = new Map();
function visit(name, from, optional = false) {
  const directory = packageDirectory(name, from);
  if (!directory) {
    if (optional) return;
    throw new Error(`Missing production dependency ${name} required by ${from}`);
  }
  if (packages.has(directory)) return;
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  packages.set(directory, manifest);
  for (const dependency of Object.keys(manifest.dependencies ?? {})) visit(dependency, directory);
  for (const dependency of Object.keys(manifest.peerDependencies ?? {})) {
    if (!manifest.peerDependenciesMeta?.[dependency]?.optional) visit(dependency, directory);
  }
  for (const dependency of Object.keys(manifest.optionalDependencies ?? {})) visit(dependency, directory, true);
}
for (const name of Object.keys(rootPackage.dependencies)) visit(name, web);
if (includeDev) for (const name of Object.keys(rootPackage.devDependencies ?? {})) visit(name, web);

// Frameworks ship vendored code (e.g. next/dist/compiled) with separate notices.
// Do not follow symlinks or enter node_modules: dependency packages are visited
// through their installed manifests above.
function bundledLicenseFiles(directory, root = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...bundledLicenseFiles(path, root));
    else if (entry.isFile() && /^(?:licen[cs]es?|copying|copyright|notice|ofl)(?:[._-]|$)|^third[._-]party[._-]notices?(?:[._-]|$)/i.test(entry.name)) {
      files.push([relative(root, path).replaceAll("\\", "/"), readFileSync(path, "utf8")]);
    }
  }
  return files;
}

function licenseFiles(directory, manifest) {
  const files = bundledLicenseFiles(directory);
  if (files.length) return files;

  // These published npm packages declare a license but omit its file.
  // Their parent projects contain the applicable license text.
  if (["@next/env", "eslint-config-next", "@next/eslint-plugin-next"].includes(manifest.name) || manifest.name.startsWith("@next/swc-")) {
    if (manifest.license !== "MIT") throw new Error(`Next.js license metadata changed for ${manifest.name}`);
    const next = packageDirectory("next", web);
    if (!next) throw new Error("Next.js license fallback is unavailable");
    return [["Next.js license.md", readFileSync(join(next, "license.md"), "utf8")]];
  }
  if (manifest.name === "client-only") {
    if (manifest.license !== "MIT") throw new Error("client-only license metadata changed");
    const react = packageDirectory("react", web);
    if (!react) throw new Error("React license fallback is unavailable");
    return [["React LICENSE", readFileSync(join(react, "LICENSE"), "utf8")]];
  }
  const companion = {
    "@humanfs/types@0.15.0": "@humanfs/core",
    "@types/json5@0.0.29": "@types/node",
    "@rolldown/binding-win32-x64-msvc@1.2.8": "rolldown",
  }[`${manifest.name}@${manifest.version}`];
  if (companion) {
    const parent = [...packages].find(([, entry]) => entry.name === companion)?.[0] ?? packageDirectory(companion, web);
    if (!parent) throw new Error(`Missing companion license for ${manifest.name}`);
    const parentManifest = JSON.parse(readFileSync(join(parent, "package.json"), "utf8"));
    if (parentManifest.license !== manifest.license) throw new Error(`Companion license mismatch for ${manifest.name}`);
    return bundledLicenseFiles(parent).map(([name, text]) => [`${companion}/${name} (same upstream project license)`, text]);
  }
  const sources = JSON.parse(readFileSync(join(repo, "licenses", "npm", "sources.json"), "utf8"));
  const archivedName = manifest.name.startsWith("@unrs/resolver-binding-") ? "unrs-resolver" : manifest.name;
  const archive = sources[`${archivedName}@${manifest.version}`];
  if (archive) {
    const contents = readFileSync(join(repo, archive.file), "utf8");
    if (createHash("sha256").update(contents.replaceAll("\r\n", "\n")).digest("hex") !== archive.sha256) throw new Error(`License snapshot checksum mismatch: ${archive.file}`);
    return [[`${archive.file} (upstream: ${archive.source})`, contents]];
  }
  if (manifest.name === "esrecurse" && manifest.version === "4.3.0") {
    const source = readFileSync(join(directory, "esrecurse.js"), "utf8");
    return [["esrecurse.js (original BSD copyright/license header)", source.slice(0, source.indexOf("*/") + 2)]];
  }
  // These exact published versions contain only a license declaration in their
  // README/metadata. Preserve it verbatim and supply the declared standard text.
  // Do not invent copyright years or substitute another project's attribution.
  const declaration = {
    "keyv@4.5.4": ["MIT", "## License"],
    "natural-compare@1.4.0": ["MIT", "Copyright (c) 2012-2015"],
    "stable-hash@0.0.5": ["MIT", "## License"],
    "language-tags@1.0.9": ["MIT", "## Credits and collaboration"],
    "language-subtag-registry@0.3.23": ["CC0-1.0", "## Credits and collaboration"],
    "stackback@0.0.2": ["MIT", null],
    "size-sensor@1.0.3": ["ISC", "# License"],
  }[`${manifest.name}@${manifest.version}`];
  if (declaration) {
    const [license, marker] = declaration;
    if (manifest.license !== license) throw new Error(`License declaration changed for ${manifest.name}`);
    const readme = readFileSync(join(directory, "README.md"), "utf8");
    const offset = marker === null ? 0 : readme.indexOf(marker);
    if (offset === -1) throw new Error(`License declaration missing for ${manifest.name}`);
    const standard = readFileSync(join(repo, "licenses", `${license}.txt`), "utf8").replace(/^Copyright[^\n]*<[^\n]+\r?\n/m, "");
    const result = [["README.md (published credits/license declaration)", readme.slice(offset)], [`${license} standard text (supplement to the published declaration)`, standard]];
    if (manifest.name === "stackback") {
      const source = readFileSync(join(directory, "formatstack.js"), "utf8");
      result.push(["formatstack.js (original V8 BSD copyright/license header)", source.slice(0, source.indexOf("\nfunction "))]);
    }
    return result;
  }
  if (manifest.name.startsWith("@img/sharp-libvips-")) {
    if (manifest.version !== "1.3.3") {
      throw new Error(`Update libvips notices for version ${manifest.version}`);
    }
    return [[
      "sharp-libvips 1.3.3 third-party notices",
      readFileSync(join(repo, "licenses", "sharp-libvips-1.3.3-THIRD-PARTY-NOTICES.md"), "utf8"),
    ]];
  }
  if (manifest.name === "js-tiktoken" && manifest.version === "1.0.21") {
    return [["js-tiktoken MIT license (upstream repository)", readFileSync(join(repo, "licenses", "js-tiktoken-LICENSE"), "utf8")]];
  }
  throw new Error(`No license or notice file for ${manifest.name}@${manifest.version}`);
}

const collectedFiles = new Map();
const failures = [];
for (const [directory, manifest] of packages) {
  try {
    if (!manifest.license) throw new Error(`Missing license metadata for ${manifest.name}@${manifest.version}`);
    collectedFiles.set(directory, licenseFiles(directory, manifest));
  } catch (error) {
    failures.push(error.message);
  }
}
if (failures.length) throw new Error(failures.join("\n"));

const entries = [...packages].map(([directory, manifest]) => {
  const files = collectedFiles.get(directory);
  if (manifest.name === "sharp") {
    const readme = readFileSync(join(directory, "README.md"), "utf8");
    const licensing = readme.indexOf("## Licensing");
    if (licensing === -1) throw new Error("Sharp copyright notice is unavailable");
    files.push(["README.md (licensing)", readme.slice(licensing)]);
  }
  if (manifest.name.startsWith("@img/sharp-") && !manifest.name.startsWith("@img/sharp-libvips-")) {
    const readme = join(directory, "README.md");
    if (existsSync(readme)) files.push(["README.md (binary copyright and licensing)", readFileSync(readme, "utf8")]);
    const next = packageDirectory("next", web);
    const sharp = next && packageDirectory("sharp", next);
    if (!sharp) throw new Error("Sharp dependency is unavailable");
    const sharpManifest = JSON.parse(readFileSync(join(sharp, "package.json"), "utf8"));
    const libvipsVersion = Object.entries(sharpManifest.optionalDependencies ?? {})
      .find(([name]) => name.startsWith("@img/sharp-libvips-"))?.[1];
    if (libvipsVersion !== "1.3.3") throw new Error(`Update libvips notices for version ${libvipsVersion}`);
    files.push(["sharp-libvips 1.3.3 third-party notices", readFileSync(join(repo, "licenses", "sharp-libvips-1.3.3-THIRD-PARTY-NOTICES.md"), "utf8")]);
  }
  if (manifest.license.includes("LGPL-3.0")) {
    files.push(["GNU LGPL 3.0", readFileSync(join(repo, "licenses", "LGPL-3.0.txt"), "utf8")]);
    files.push(["GNU GPL 3.0 (incorporated by LGPL 3.0)", readFileSync(join(repo, "licenses", "GPL-3.0.txt"), "utf8")]);
  }
  const attribution = manifest.name === "caniuse-lite"
    ? "Attribution: caniuse-lite by Ben Briggs, https://github.com/browserslist/caniuse-lite; browser support data from Can I use, Alexis Deveria and contributors, https://caniuse.com/ and https://github.com/Fyrd/caniuse. Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/. LLMLab does not modify the installed package data."
    : null;
  const repository = typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url;
  let source = repository?.replace(/^git\+/, "").replace(/^git:\/\//, "https://").replace(/^github:/, "https://github.com/");
  if (source && /^[\w.-]+\/[\w.-]+$/.test(source)) source = `https://github.com/${source}`;
  const author = typeof manifest.author === "string" ? manifest.author : manifest.author?.name;
  return { name: manifest.name, version: manifest.version, license: manifest.license, files, attribution, source, author };
}).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const sections = [
  `LLMLab web ${includeDev ? "production and development" : "production"} dependency notices`,
  "Generated from the installed dependency graph, including supplied vendored license files; platform-specific packages vary by build.",
  "The LLMLab source code is licensed separately under the root LICENSE file.",
];
for (const { name, version, license, files, attribution, source, author } of entries) {
  sections.push(`\n${"=".repeat(76)}\n${name}@${version} — ${license}\n${"=".repeat(76)}`);
  if (source) sections.push(`Upstream source: ${source}`);
  if (author) sections.push(`Package author: ${author}`);
  if (attribution) sections.push(attribution);
  for (const [filename, contents] of files) {
    sections.push(`\n--- ${filename} ---\n${contents.trimEnd()}\n`);
  }
}
const text = `${sections.join("\n")}\n`;
if (output) {
  writeFileSync(resolve(output), text);
  process.stdout.write(`Wrote ${entries.length} web package notices to ${output}\n`);
} else {
  process.stdout.write(text);
}
