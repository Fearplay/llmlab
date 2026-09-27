import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const failures = [];
const controls = new Set(["input", "select", "textarea"]);
const helpComponents = new Set(["HelpLabel", "InfoTip"]);
const labeledComponents = new Set(["label", "Field"]);
const sharedControls = new Set(["Field", "Select", "Combobox"]);

function jsxName(node) { return node.tagName?.getText() ?? ""; }
function propertyName(node) { return node.name && "text" in node.name ? node.name.text : ""; }
function objectProperties(node) { return node && ts.isObjectLiteralExpression(node) ? node.properties.filter(ts.isPropertyAssignment) : []; }
function objectProperty(node, name) { return objectProperties(node).find((item) => propertyName(item) === name)?.initializer; }
function nonemptyString(node) { return !!node && ts.isStringLiteralLike(node) && node.text.trim().length > 0; }
function registry(name) {
  const file = path.join(root, "lib", "help-content.ts");
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  let value;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) value = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!value) throw new Error(`Missing help registry ${name}`);
  return objectProperties(value);
}

const keys = new Set(["field.concept"]);
for (const item of registry("help")) {
  const key = propertyName(item);
  keys.add(key);
  for (const locale of ["cs", "en"]) {
    const localized = objectProperty(item.initializer, locale);
    for (const field of ["title", "description", "example"]) {
      if (!nonemptyString(objectProperty(localized, field))) failures.push(`${key}: missing ${locale}.${field}`);
    }
  }
}
for (const item of registry("fieldGuides")) {
  const key = propertyName(item);
  keys.add(key);
  for (const locale of ["cs", "en"]) {
    const localized = objectProperty(item.initializer, locale);
    if (!localized || !ts.isArrayLiteralExpression(localized) || localized.elements.length !== 2 || !localized.elements.every(nonemptyString)) {
      failures.push(`${key}: missing ${locale} description or example`);
    }
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith(".tsx")) inspect(file);
  }
}

function helpKey(node) {
  const attr = node.attributes?.properties.find((item) => ts.isJsxAttribute(item) && item.name.text === "helpKey");
  if (!attr?.initializer) return null;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer) && ts.isStringLiteralLike(attr.initializer.expression)) return attr.initializer.expression.text;
  return "dynamic";
}

function inspect(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const location = (node) => `${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
  function hasHelp(label) {
    let found = false;
    function scan(node) {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && helpComponents.has(jsxName(node)) && helpKey(node)) found = true;
      ts.forEachChild(node, scan);
    }
    ts.forEachChild(label, scan);
    return found;
  }
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const name = jsxName(node);
      if ((helpComponents.has(name) && (name === "HelpLabel" || helpKey(node))) || sharedControls.has(name)) {
        const key = helpKey(node);
        if (!key) failures.push(`${location(node)}: ${name} needs helpKey`);
        else if (key !== "dynamic" && !keys.has(key)) failures.push(`${location(node)}: unknown helpKey ${key}`);
      }
      if (controls.has(name) && path.basename(file) !== "ui.tsx") {
        let owner = node.parent;
        while (owner && !(ts.isJsxElement(owner) && labeledComponents.has(jsxName(owner.openingElement)))) owner = owner.parent;
        if (!owner || !(jsxName(owner.openingElement) === "Field" ? helpKey(owner.openingElement) : hasHelp(owner))) failures.push(`${location(node)}: form control needs a label or Field with keyed HelpLabel/InfoTip`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

walk(path.join(root, "components"));
walk(path.join(root, "app"));
if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Every form control has keyed help with Czech and English content.\n");
}
