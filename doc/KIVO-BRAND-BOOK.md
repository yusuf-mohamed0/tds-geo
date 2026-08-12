# Kivo Brand Book

## Brand Core

**Name:** Kivo

**Pronunciation:** KEE-vo

**Category:** Technical visibility infrastructure

**One-line description:** Kivo helps commerce and content teams become visible to AI search systems, monitor every operational signal, and recover from failures automatically.

**Tagline:** Make search systems see you.

**Positioning:** Technical visibility infrastructure for AI search, commerce content, telemetry, and automated recovery.

## Brand Meaning

Kivo is short, direct, and easy to say. It sounds like a technical product without feeling cold or generic. The name suggests:

- **Key** — the control point for visibility and access.
- **Kinetic** — automation, movement, and recovery.
- **Vector** — semantic search, embeddings, entity relationships, and AI visibility.
- **Voice** — how brands are represented across engines, storefronts, and content.

## Product Architecture

- **Kivo OS** — the command center and core platform.
- **Kivo Geo** — AI search, GEO/AEO, citations, content intelligence, and backlink visibility.
- **Kivo Pulse** — health, telemetry, live activity, and incident monitoring.
- **Kivo Sentinel** — safe auto-fix, incident detection, production recovery, and approval workflows.
- **Kivo Connect** — Shopify, WordPress, Next.js, CMS, and webhook integrations.
- **Kivo Vault** — credentials, secure configuration, and protected client access.
- **Kivo Publish** — content generation, approvals, scheduling, and commerce publishing.

## Brand Personality

- **Technical, not complicated.** Clear language, precise interface, measurable outcomes.
- **Calm under pressure.** Incidents, errors, and alerts should feel contained and actionable.
- **Operator-first.** Every screen should answer: what happened, why, who did it, and what happens next?
- **Search-native.** The brand should feel built for crawlers, vectors, queries, entities, and signals.

## Visual Identity

### Logo Concept

The Kivo mark is a technical **K** built from connected signal routes. It combines:

- A vertical backbone for infrastructure.
- Two branching paths for query and commerce signals.
- Nodes for activity, citation, entity, and recovery events.
- A rounded square container for app icon consistency.

Primary mark file:

`/assets/kivo-mark.svg`

### Color System

| Role | Token | Hex | Use |
|---|---:|---:|---|
| Core black | `obsidian` | `#071013` | Shells, hero backgrounds, high-contrast text |
| Signal green | `signal` | `#22E6A8` | Primary actions, focus, active brand state |
| System blue | `query` | `#3BB5FF` | GEO/search, data, analytics, connector highlights |
| Recovery lime | `recover` | `#B7FF4A` | Success, automation, safe auto-fix indicators |
| Vector violet | `vector` | `#C7B8FF` | AI/model/citation accents |
| Surface mist | `mist` | `#F4FBF8` | App background |
| Border mist | `border` | `#D9E8E2` | Cards, panels, dividers |
| Graphite | `graphite` | `#25343A` | Secondary surfaces and deep UI |
| Muted text | `muted` | `#6D7E86` | Helper copy, timestamps, metadata |

### Typography

Recommended brand stack:

- **Interface:** Inter
- **Display / technical headers:** Space Grotesk
- **Fallback:** system UI stack

Rationale: Inter keeps dense SaaS screens readable. Space Grotesk gives Kivo a technical, memorable edge without becoming hard to read.

### Icon Language

Primary icon family: **Lucide React**.

Icon rules:

- Use line icons, not filled icons.
- Prefer simple engineering metaphors: nodes, activity, search, shield, server, bot, archive, store, graph.
- Use color sparingly; most icons should inherit text color and only key states use Signal Green or Query Blue.

Core icon map:

- System: `Layers3`
- GEO/search: `Search`
- Pulse/health: `HeartPulse`
- Sentinel/AI: `Bot`
- Commerce: `Store`
- Vault/security: `Archive` or `ShieldCheck`
- Infrastructure: `Server`
- Activity: `Activity`

## Voice And Messaging

### Voice

- Direct
- Technical
- Calm
- Operational
- Evidence-led

### Avoid

- AI hype
- Generic growth language
- Overpromising full autonomy for risky actions
- “Magic” metaphors
- Vague claims like “revolutionary” or “next-gen” without proof

### Preferred Phrases

- “Every signal, visible.”
- “Track the action. Detect the fault. Recover safely.”
- “Built for AI search, commerce content, and operational telemetry.”
- “Safe fixes run automatically. Risky fixes require approval.”

## Customer-Facing Review

When a customer first sees Kivo, the product should communicate:

- This is a serious technical platform, not a generic SEO dashboard.
- It watches the real production system, not just marketing metrics.
- It connects Shopify/content/search signals into one operating view.
- It is safe: automation exists, but dangerous changes need approval.
- It is memorable and easy to pronounce.

## Technical Brand Requirements

- All customer-facing Kivo naming should move to Kivo.
- Internal package paths such as `kivo`, historical repository names, API route compatibility, and webhook paths may remain unchanged unless a migration plan exists.
- App manifests, favicons, Shopify app name, public metadata, and frontend brand tokens must use Kivo.
- Existing SEO/GEO, telemetry, Sentinel, Shopify compliance, and OAuth functionality must not regress during rebrand.
