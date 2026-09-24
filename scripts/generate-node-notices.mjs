import { existsSync, readFileSync, realpathSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const web = join(repo, "apps", "web");
const rootPackage = JSON.parse(readFileSync(join(web, "package.json"), "utf8"));
const outputIndex = process.argv.indexOf("--output");
const output = outputIndex === -1 ? null : process.argv[outputIndex + 1];
if (outputIndex !== -1 && !output) throw new Error("--output needs a filename");

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
  for (const dependency of Object.keys(manifest.optionalDependencies ?? {})) visit(dependency, directory, true);
}
for (const name of Object.keys(rootPackage.dependencies)) visit(name, web);

function licenseFiles(directory, manifest) {
  const names = readdirSync(directory).filter((name) => /^(?:licen[cs]e|copying|notice|ofl)(?:\.|$)|^third.party.notices?(?:\.|$)/i.test(name));
  const files = names.map((name) => [name, readFileSync(join(directory, name), "utf8")]);
  if (files.length) return files;

  // These published npm packages declare a license but omit its file.
  // Their parent projects contain the applicable license text.
  if (manifest.name === "@next/env" || manifest.name.startsWith("@next/swc-")) {
    const next = packageDirectory("next", web);
    if (!next) throw new Error("Next.js license fallback is unavailable");
    return [["Next.js license.md", readFileSync(join(next, "license.md"), "utf8")]];
  }
  if (manifest.name === "client-only") {
    const react = packageDirectory("react", web);
    if (!react) throw new Error("React license fallback is unavailable");
    return [["React LICENSE", readFileSync(join(react, "LICENSE"), "utf8")]];
  }
  if (manifest.name === "size-sensor") {
    return [["ISC notice (package declares ISC; author: hustcc)", `Copyright (c) hustcc

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
`]];
  }
  throw new Error(`No license or notice file for ${manifest.name}@${manifest.version}`);
}

const entries = [...packages].map(([directory, manifest]) => {
  if (!manifest.license) throw new Error(`Missing license metadata for ${manifest.name}@${manifest.version}`);
  const files = licenseFiles(directory, manifest);
  if (manifest.name === "sharp") {
    const readme = readFileSync(join(directory, "README.md"), "utf8");
    const licensing = readme.indexOf("## Licensing");
    if (licensing === -1) throw new Error("Sharp copyright notice is unavailable");
    files.push(["README.md (licensing)", readme.slice(licensing)]);
  }
  if (manifest.name.startsWith("@img/sharp-")) {
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
    ? "Attribution: caniuse-lite by Ben Briggs, https://github.com/browserslist/caniuse-lite. LLMLab does not modify the package data."
    : null;
  return { name: manifest.name, version: manifest.version, license: manifest.license, files, attribution };
}).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const sections = [
  "LLMLab web production dependency notices",
  "Generated from the installed production dependency graph; platform-specific packages vary by build.",
  "The LLMLab source code is licensed separately under the root LICENSE file.",
];
for (const { name, version, license, files, attribution } of entries) {
  sections.push(`\n${"=".repeat(76)}\n${name}@${version} — ${license}\n${"=".repeat(76)}`);
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
