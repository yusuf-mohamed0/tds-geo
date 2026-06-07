## Knowledge Graphs

This project has TWO knowledge graph systems. **graphify** is fully operational with rich structure. **Understand Anything** is installed and ready but needs an AI agent pipeline to generate edges, layers, and tours.

### graphify (Active — use for queries)

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships (1,284 nodes, 2,453 edges, 99 communities).

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

### Understand Anything (Installed — file-level graph only)

Location: `understand-anything-plugin/` and `.understand-anything/knowledge-graph.json`

Status: Plugin installed, core package built, project scanned (520 files, 509 nodes in graph). The graph contains file nodes only (no edges yet) — the full multi-agent pipeline (edges, layers, guided tours) requires running `/understand` in a compatible AI agent (Claude Code, Cursor, Codex, etc.) or using the scripts directly.

Key files:
- `understand-anything-plugin/` — Full plugin source (packages/, skills/, agents/)
- `.understand-anything/knowledge-graph.json` — Basic file-level graph (regenerate: `node skills/understand/scan-project.mjs <root> <out>` → build via GraphBuilder)
- `.understandignore` — Exclusion patterns for scanning
- For the interactive dashboard, build `packages/dashboard/` and run it

To get the full value (import relationships, architectural layers, guided tours, domain analysis):
- Run `/understand` in a compatible AI agent (Claude Code, Codex, etc.)
- Or `node skills/understand/scan-project.mjs /root/my-project /tmp/scan.json` for re-scan
