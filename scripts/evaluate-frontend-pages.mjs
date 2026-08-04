#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const pagesDir = path.join(root, 'frontend/src/pages');
const pageFiles = fs.readdirSync(pagesDir)
  .filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
  .sort();

const results = [];

for (const file of pageFiles) {
  const fullPath = path.join(pagesDir, file);
  const source = fs.readFileSync(fullPath, 'utf8');
  const findings = [];

  check(source.includes('export default function'), 'missing default page component export', findings);
  check(/<Page\s+title=|<h1\b/.test(source), 'missing visible page title or h1', findings);
  check(!/catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/.test(source), 'silent empty catch block', findings);
  check(!/\sas\s+any\b/.test(source), 'uses `as any` instead of a typed boundary', findings);

  const fetchesData = /apiFetch<|fetch\(/.test(source);
  if (fetchesData) {
    check(/loading|stage === 'loading'|Skeleton|Spinner/.test(source), 'fetching page has no loading state', findings);
    check(/setError|error &&|Banner tone="critical"|tone="critical"/.test(source), 'fetching page has no user-visible error state', findings);
  }

  const controlMatches = [...source.matchAll(/<(input|select|textarea)\b([^>]*)>/g)];
  for (const match of controlMatches) {
    const attrs = match[2];
    const hasAccessibleName = /aria-label=|aria-labelledby=|id=/.test(attrs);
    check(hasAccessibleName, `${match[1]} control missing accessible label/id`, findings);
  }

  const blankLinks = [...source.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)];
  for (const match of blankLinks) {
    check(/rel="[^"]*noopener[^"]*noreferrer/.test(match[0]), 'target=_blank link missing noopener noreferrer', findings);
  }

  if (/dangerouslySetInnerHTML/.test(source)) {
    check(/DOMPurify\.sanitize/.test(source), 'dangerouslySetInnerHTML without DOMPurify.sanitize', findings);
  }

  results.push({ file, findings });
}

const failures = results.filter((result) => result.findings.length > 0);
console.log(`Frontend page evaluation: ${pageFiles.length} pages checked`);
for (const result of results) {
  if (result.findings.length === 0) {
    console.log(`  PASS ${result.file}`);
    continue;
  }
  console.log(`  FAIL ${result.file}`);
  for (const finding of result.findings) console.log(`    - ${finding}`);
}

if (failures.length > 0) process.exit(1);

function check(condition, message, findings) {
  if (!condition) findings.push(message);
}
