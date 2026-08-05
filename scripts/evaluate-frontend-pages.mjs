#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const root = process.cwd();
const frontendDir = path.join(root, 'frontend/src');
const pagesDir = path.join(frontendDir, 'pages');
const backendDir = path.join(root, 'backend');

const frontendFiles = walk(frontendDir, ['.tsx', '.ts'])
  .filter((file) => !isIgnoredSource(file));
const backendFiles = walk(backendDir, ['.ts'])
  .filter((file) => !isIgnoredSource(file));
const pageFiles = frontendFiles
  .filter((file) => file.startsWith(`${pagesDir}${path.sep}`) && file.endsWith('.tsx'))
  .sort();

const results = [];
const totals = {
  pages: pageFiles.length,
  frontendFiles: frontendFiles.length,
  backendFiles: backendFiles.length,
  functions: 0,
  controls: 0,
  buttons: 0,
};

for (const file of pageFiles) evaluatePage(file);
for (const file of frontendFiles) evaluateFrontendSource(file);
for (const file of backendFiles) evaluateProgrammerSource(file, 'backend');

const errors = results.filter((result) => result.severity === 'ERROR');
const reviews = results.filter((result) => result.severity === 'REVIEW');

console.log('Professional evaluation gate');
console.log(`  Pages checked: ${totals.pages}`);
console.log(`  Frontend source files checked: ${totals.frontendFiles}`);
console.log(`  Backend source files checked: ${totals.backendFiles}`);
console.log(`  Functions inventoried: ${totals.functions}`);
console.log(`  Controls inventoried: ${totals.controls}`);
console.log(`  Buttons inventoried: ${totals.buttons}`);
console.log(`  Errors: ${errors.length}`);
console.log(`  Review notes: ${reviews.length}`);

printGroup('ERROR', errors);
printGroup('REVIEW', reviews.slice(0, 80));
if (reviews.length > 80) console.log(`  ... ${reviews.length - 80} additional review notes hidden`);

if (errors.length > 0) process.exit(1);

function evaluatePage(file) {
  const source = readSource(file);
  const relative = rel(file);

  error(source.includes('export default function'), relative, 1, 'programmer', 'Page is missing a named default component export.');
  error(/<Page\s+title=|<h1\b/.test(source), relative, 1, 'human', 'Page is missing a visible top-level title.');

  const fetchesData = /apiFetch<|fetch\(/.test(source);
  if (fetchesData) {
    error(/loading|stage === ['"]loading['"]|Skeleton|Spinner/.test(source), relative, 1, 'user', 'Data-fetching page has no clear loading state.');
    error(/setError|error &&|Banner tone="critical"|tone="critical"|Could not|Unable to/.test(source), relative, 1, 'user', 'Data-fetching page has no user-visible error state.');
  }

  if (/(IndexTable|<table\b|\.map\()/.test(source) && /apiFetch<|fetch\(/.test(source)) {
    review(/No |empty|EmptyState|not found|No .* yet|nothing|incomplete|meet the .*threshold|No .* found/i.test(source), relative, 1, 'user', 'Data-heavy page should provide an explicit empty state.');
  }

  if (/position:\s*['"]fixed['"]|position:\s*fixed|inset:\s*0/.test(source) && /onClick=/.test(source)) {
    error(/aria-modal=|role="dialog"/.test(source), relative, 1, 'human', 'Custom modal overlay should expose dialog semantics.');
  }
}

function evaluateFrontendSource(file) {
  const source = readSource(file);
  const relative = rel(file);
  evaluateProgrammerSource(file, 'frontend');

  for (const match of findOpeningTags(source, ['input', 'select', 'textarea'])) {
    totals.controls += 1;
    const attrs = match.attrs;
    const line = lineForOffset(source, match.index);
    error(/aria-label=|aria-labelledby=|id=/.test(attrs), relative, line, 'human', `${match.tag} control is missing an accessible name.`);
  }

  for (const match of findElementBlocks(source, 'button')) {
    totals.buttons += 1;
    const line = lineForOffset(source, match.index);
    error(/\btype=/.test(match.opening), relative, line, 'programmer', 'Native button is missing an explicit type.');
    error(hasAccessibleName(match.opening, match.content), relative, line, 'human', 'Native button has no accessible name.');
  }

  for (const match of findElementBlocks(source, 'Button')) {
    totals.buttons += 1;
    const line = lineForOffset(source, match.index);
    error(hasAccessibleName(match.opening, match.content), relative, line, 'human', 'Polaris Button has no visible label or accessibilityLabel.');
    if (/loading=\{?[A-Za-z_$]/.test(match.opening)) {
      review(/disabled=/.test(match.opening), relative, line, 'user', 'Loading button should usually be disabled to prevent double submission.');
    }
  }

  for (const match of findOpeningTags(source, ['img'])) {
    const line = lineForOffset(source, match.index);
    error(/\balt=/.test(match.attrs), relative, line, 'human', 'Image is missing alt text.');
  }

  for (const match of findOpeningTags(source, ['a'])) {
    const line = lineForOffset(source, match.index);
    if (/target="_blank"/.test(match.attrs)) {
      error(/rel="[^"]*noopener[^"]*noreferrer/.test(match.attrs), relative, line, 'programmer', 'External link opens a new tab without noopener noreferrer.');
    }
    error(!/href=["']#["']/.test(match.attrs), relative, line, 'user', 'Link uses placeholder href="#".');
  }

  for (const match of findOpeningTags(source, ['div', 'span', 'li'])) {
    if (!/\bonClick=/.test(match.attrs)) continue;
    const line = lineForOffset(source, match.index);
    error(/\brole=/.test(match.attrs), relative, line, 'human', `${match.tag} with onClick must declare an interaction role.`);
    if (/role="button"/.test(match.attrs)) {
      error(/tabIndex=|onKeyDown=|onKeyUp=/.test(match.attrs), relative, line, 'human', 'role="button" element needs keyboard support.');
    }
  }

  if (/dangerouslySetInnerHTML/.test(source)) {
    error(/DOMPurify\.sanitize/.test(source), relative, 1, 'programmer', 'dangerouslySetInnerHTML must sanitize content with DOMPurify.');
  }
}

function evaluateProgrammerSource(file, area) {
  const source = readSource(file);
  const relative = rel(file);

  error(!/catch\s*\([^)]*\)\s*\{\s*\}/.test(source), relative, 1, 'programmer', 'Silent empty catch block hides failures.');
  if (/\sas\s+any\b/.test(source)) {
    const check = area === 'frontend' ? error : review;
    check(false, relative, 1, 'programmer', 'Uses `as any` instead of a typed boundary.');
  }
  if (/console\.(log|debug|info|warn|error)\(/.test(source)) {
    const isCliOrTool = relative.includes('/scripts/') || relative.includes('/vault-ui/');
    const check = area === 'frontend' || !isCliOrTool ? error : review;
    check(false, relative, 1, 'programmer', 'Console logging should use project logging or be removed.');
  }
  review(!/environment variable is required in production/.test(source), relative, 1, 'user', 'Production env requirement should be documented and covered by deploy checks.');

  for (const fn of findFunctions(source)) {
    totals.functions += 1;
    const line = lineForOffset(source, fn.index);
    const lineCount = fn.body.split('\n').length;
    const paramCount = fn.params.length;
    if (lineCount > 220) {
      review(false, relative, line, 'programmer', `${fn.name} is ${lineCount} lines; review for extraction once behavior is covered.`);
    }
    if (paramCount > 5) {
      review(false, relative, line, 'programmer', `${fn.name} has ${paramCount} parameters; consider a named options object.`);
    }
    if (area === 'frontend' && /^handle[A-Z]/.test(fn.name) && /apiFetch<|fetch\(/.test(fn.body)) {
      error(/try\s*\{/.test(fn.body) && /catch\s*\(/.test(fn.body), relative, line, 'user', `${fn.name} performs a request without local error handling.`);
    }
  }
}

function walk(dir, extensions) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', 'public'].includes(entry.name)) continue;
      files.push(...walk(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function isIgnoredSource(file) {
  return /\.test\.[tj]sx?$|\.d\.ts$|swagger\.ts$/.test(file) || file.includes(`${path.sep}tests${path.sep}`);
}

function readSource(file) {
  return fs.readFileSync(file, 'utf8');
}

function rel(file) {
  return path.relative(root, file);
}

function findOpeningTags(source, tags) {
  const tagPattern = tags.join('|');
  const regex = new RegExp(`<(${tagPattern})\\b((?:[^>{]|\\{[^}]*\\})*)>`, 'g');
  return [...source.matchAll(regex)].map((match) => ({ tag: match[1], attrs: match[2], index: match.index || 0 }));
}

function findElementBlocks(source, tag) {
  const paired = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'g');
  const selfClosing = new RegExp(`<${tag}\\b([^>]*)\\/>`, 'g');
  const blocks = [...source.matchAll(paired)].map((match) => ({ opening: match[1], content: match[2], index: match.index || 0 }));
  blocks.push(...[...source.matchAll(selfClosing)].map((match) => ({ opening: match[1], content: '', index: match.index || 0 })));
  return blocks;
}

function hasAccessibleName(opening, content) {
  if (/aria-label=|aria-labelledby=|accessibilityLabel=|title=/.test(opening)) return true;
  if (/["'][^"']*[A-Za-z0-9][^"']*["']/.test(content)) return true;
  const text = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return /[A-Za-z0-9]/.test(text);
}

function findFunctions(source) {
  const functions = [];
  const sourceFile = ts.createSourceFile('audit.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visit = (node) => {
    if (isFunctionLike(node)) {
      const body = node.body ? source.slice(node.body.getStart(sourceFile), node.body.getEnd()) : '';
      functions.push({
        name: functionName(node),
        params: node.parameters || [],
        index: node.getStart(sourceFile),
        body,
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return functions;
}

function isFunctionLike(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node);
}

function functionName(node) {
  if (node.name?.getText) return node.name.getText();
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && parent.name?.getText) return parent.name.getText();
  if (ts.isPropertyAssignment(parent) && parent.name?.getText) return parent.name.getText();
  if (ts.isCallExpression(parent)) return '<callback>';
  return '<anonymous>';
}

function lineForOffset(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function error(condition, file, line, lens, message) {
  if (!condition) results.push({ severity: 'ERROR', file, line, lens, message });
}

function review(condition, file, line, lens, message) {
  if (!condition) results.push({ severity: 'REVIEW', file, line, lens, message });
}

function printGroup(label, items) {
  if (items.length === 0) return;
  console.log(`${label}:`);
  for (const item of items) {
    console.log(`  ${item.file}:${item.line} [${item.lens}] ${item.message}`);
  }
}
