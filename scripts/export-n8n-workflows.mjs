#!/usr/bin/env node
// <YKS />  YUSUF KO STA  Code. Build. Ship.(TM)
// Export n8n workflows to redacted, versionable JSON files for GitNexus indexing.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const dbPath = process.env.N8N_SQLITE_DB || `${process.env.HOME}/.n8n/database.sqlite`;
const outDir = process.env.N8N_WORKFLOW_EXPORT_DIR || 'n8n/workflows/exported';

mkdirSync(outDir, { recursive: true });

const rowsJson = execFileSync('sqlite3', [
  '-json',
  dbPath,
  `SELECT id, name, active, nodes, connections, settings, pinData, staticData, meta, versionId, triggerCount, createdAt, updatedAt, description
   FROM workflow_entity
   WHERE COALESCE(isArchived, 0) = 0
   ORDER BY name COLLATE NOCASE`,
], { encoding: 'utf8' });

const rows = JSON.parse(rowsJson || '[]');
const manifest = {
  exportedAt: new Date().toISOString(),
  source: basename(dbPath),
  workflowCount: rows.length,
  workflows: [],
};

for (const row of rows) {
  const workflow = {
    id: row.id,
    name: row.name,
    active: Boolean(row.active),
    description: row.description || '',
    versionId: row.versionId,
    triggerCount: row.triggerCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    nodes: parseJson(row.nodes, []),
    connections: parseJson(row.connections, {}),
    settings: parseJson(row.settings, {}),
    pinData: parseJson(row.pinData, {}),
    staticData: parseJson(row.staticData, {}),
    meta: parseJson(row.meta, {}),
  };

  redactWorkflow(workflow);
  const fileName = `${slugify(row.name)}-${row.id.slice(0, 8)}.json`;
  const body = `${JSON.stringify(workflow, null, 2)}\n`;
  writeFileSync(join(outDir, fileName), body, { mode: 0o644 });
  manifest.workflows.push({
    id: row.id,
    name: row.name,
    active: Boolean(row.active),
    file: fileName,
    sha256: createHash('sha256').update(body).digest('hex'),
    updatedAt: row.updatedAt,
  });
}

writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
console.log(`Exported ${rows.length} n8n workflows to ${outDir}`);

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'workflow';
}

function redactWorkflow(value) {
  walk(value, (obj, key) => {
    if (typeof key !== 'string') return;
    if (/password|secret|token|api[_-]?key|credential/i.test(key)) {
      obj[key] = '[REDACTED]';
    }
    if (
      key === 'value' &&
      typeof obj.name === 'string' &&
      /password|secret|token|api[_-]?key|credential/i.test(obj.name)
    ) {
      obj[key] = '[REDACTED]';
    }
  });
}

function walk(value, visitor) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }
  for (const key of Object.keys(value)) {
    visitor(value, key);
    walk(value[key], visitor);
  }
}
